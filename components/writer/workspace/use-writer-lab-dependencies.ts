"use client";

import { useEffect, useMemo, useState } from "react";

import { buildChangeImpactMap } from "@/lib/computational-integrity";
import { fetchSavedLaboratoryResult } from "@/lib/laboratory-results";
import type { OutdatedLabImport } from "./workspace-types";
import { extractSavedResultImports } from "./workspace-transforms";

export function useWriterLabDependencies(compiledContent: string) {
    const [outdated, setOutdated] = useState<OutdatedLabImport[]>([]);
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
    const imports = useMemo(() => extractSavedResultImports(compiledContent), [compiledContent]);

    useEffect(() => {
        let cancelled = false;

        async function checkRevisions() {
            const uniqueImports = Array.from(new Map(imports.map((item) => [item.savedResultId, item])).values());
            if (!uniqueImports.length) {
                setOutdated([]);
                return;
            }

            const nextOutdated: OutdatedLabImport[] = [];
            await Promise.all(
                uniqueImports.map(async (item) => {
                    try {
                        const latest = await fetchSavedLaboratoryResult(item.savedResultId);
                        const dismissKey = `${item.savedResultId}:${latest.revision}`;
                        if (latest.revision <= item.revision || dismissedKeys.has(dismissKey)) return;

                        nextOutdated.push({
                            savedResultId: item.savedResultId,
                            currentRevision: item.revision,
                            latest,
                            impact: buildChangeImpactMap({
                                currentRevision: item.revision,
                                latestRevision: latest.revision,
                                latestMetadata: latest.metadata,
                                currentIntegrity: item.integrity,
                            }),
                        });
                    } catch {
                        // Advisory only: a disconnected lab must never block Writer.
                    }
                }),
            );

            if (!cancelled) setOutdated(nextOutdated);
        }

        void checkRevisions();
        return () => {
            cancelled = true;
        };
    }, [dismissedKeys, imports]);

    function dismiss(item: OutdatedLabImport) {
        setDismissedKeys((current) => {
            const next = new Set(current);
            next.add(`${item.savedResultId}:${item.latest.revision}`);
            return next;
        });
    }

    return { outdated, dismiss };
}
