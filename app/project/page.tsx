"use client";

import React from "react";

import { AxActionLink, AxBadge, AxEmptyState, AxSectionHeader } from "@/components/axion";
import { getEcosystemHref } from "@/lib/ecosystem/apps";
import { listLocalScientificObjects } from "@/lib/ecosystem/local-object-store";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import type { ScientificObject } from "@/lib/ecosystem/contracts";

export default function WriterProjectResultsPage() {
    const [projectId, setProjectId] = React.useState<string | null>(null);
    const [projectTitle, setProjectTitle] = React.useState<string | null>(null);
    const [objects, setObjects] = React.useState<ScientificObject[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const activeProjectId = resolveActiveProjectId();
        setProjectId(activeProjectId);
        setProjectTitle(getLocalProjectTitle(activeProjectId));
        if (!activeProjectId) {
            setLoading(false);
            return;
        }
        listLocalScientificObjects(activeProjectId)
            .then((items) => setObjects(items.filter((item) => item.sourceApp === "math")))
            .catch(() => setObjects([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="min-h-[calc(100vh-36px)] bg-[var(--ax-canvas)] px-4 py-10 text-[var(--ax-text)] sm:px-6">
            <div className="mx-auto max-w-5xl">
                <AxActionLink href={projectId ? `/?project=${encodeURIComponent(projectId)}` : "/"} variant="quiet" size="sm" className="px-0">
                    ← Writer
                </AxActionLink>

                <AxSectionHeader
                    className="mt-6 border-b border-[var(--ax-line)] pb-7"
                    eyebrow="Project results"
                    title={projectTitle || "Active project"}
                    description="Choose a saved result and start a Writer draft from it. The result is read directly from this Project on the device."
                />

                {!projectId ? (
                    <AxEmptyState title="No active Project." description="Open Writer from the Science Hub so the document can keep the same research context." />
                ) : loading ? (
                    <div className="py-12 text-sm text-[var(--ax-text-soft)]">Loading local results…</div>
                ) : objects.length ? (
                    <div className="divide-y divide-[var(--ax-line)]">
                        {objects.map((object) => (
                            <article key={object.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="truncate text-base font-semibold text-[var(--ax-text)]">{object.title}</h2>
                                        <AxBadge>Saved result</AxBadge>
                                    </div>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ax-text-faint)]">{object.domain || object.kind}</div>
                                </div>
                                <AxActionLink href={`/new?source=project&project=${encodeURIComponent(projectId)}&objectId=${encodeURIComponent(object.id)}`} variant="primary">
                                    New document
                                </AxActionLink>
                            </article>
                        ))}
                    </div>
                ) : (
                    <AxEmptyState
                        title="No saved Math results yet."
                        description="Solve something in Laboratory and press Save. The result will appear here without a server-side import step."
                        action={<AxActionLink href={getEcosystemHref("math", "writer", projectId)}>Open Math</AxActionLink>}
                    />
                )}
            </div>
        </main>
    );
}
