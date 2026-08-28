"use client";

import { useEffect, useMemo } from "react";

import {
    buildLegacyWriterSnapshotStorageKey,
    buildWriterSnapshotStorageKey,
} from "@/lib/writer-document";
import { ensureWriterProjectSections, getWriterSectionKey } from "@/lib/writer-project";
import type { WriterWorkspaceProps } from "./workspace-types";

/**
 * The old workspace keyed revision snapshots by the document title. Embedded
 * hosts need a stable identity, so the modular workspace uses documentId.
 * Copy the old value forward once so an architecture upgrade never hides a
 * user's local revision history.
 */
export function useWriterSnapshotMigration(props: WriterWorkspaceProps) {
    const firstSectionKey = useMemo(() => {
        const first = ensureWriterProjectSections(props.formData)[0];
        return first ? getWriterSectionKey(first) : "draft";
    }, [props.formData]);

    const stableKey = useMemo(
        () => buildWriterSnapshotStorageKey(
            props.mode ?? "new",
            props.documentId,
            props.formData.title,
            firstSectionKey,
        ),
        [firstSectionKey, props.documentId, props.formData.title, props.mode],
    );

    const legacyKey = useMemo(
        () => buildLegacyWriterSnapshotStorageKey(
            props.mode ?? "new",
            props.formData.title,
            firstSectionKey,
        ),
        [firstSectionKey, props.formData.title, props.mode],
    );

    useEffect(() => {
        if (typeof window === "undefined" || stableKey === legacyKey) return;
        try {
            if (window.localStorage.getItem(stableKey)) return;
            const legacyValue = window.localStorage.getItem(legacyKey);
            if (legacyValue) window.localStorage.setItem(stableKey, legacyValue);
        } catch {
            // Local revision history is a convenience layer; storage failures
            // must never block the editor or a host application.
        }
    }, [legacyKey, stableKey]);
}
