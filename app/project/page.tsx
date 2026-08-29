"use client";

import React from "react";

import { AxActionLink, AxBadge, AxEmptyState, AxLoadingState, AxSectionHeader } from "@/components/axion";
import { getEcosystemHref } from "@/lib/ecosystem/apps";
import { listLocalScientificObjects } from "@/lib/ecosystem/local-object-store";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import type { ScientificObject } from "@/lib/ecosystem/contracts";

function WriterMark() {
    return (
        <svg viewBox="0 0 36 36" className="h-8 w-8 text-[var(--ax-accent)]" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <ellipse cx="18" cy="18" rx="7" ry="15.5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
            <ellipse cx="18" cy="18" rx="15.5" ry="6.8" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.72" />
            <path d="M3 18h30M18 2.5v31" stroke="currentColor" strokeWidth="0.75" opacity="0.55" />
        </svg>
    );
}

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
        <>
            <header className="sticky top-0 z-40 border-b border-[var(--ax-line)] bg-[color-mix(in_srgb,var(--ax-surface)_96%,transparent)] backdrop-blur-xl">
                <div className="mx-auto flex h-[64px] w-full max-w-[var(--ax-content-max)] items-center justify-between gap-5 px-4 sm:px-6">
                    <a href="/" className="flex min-w-0 items-center gap-3 rounded-[var(--ax-radius-control)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                        <WriterMark />
                        <span className="truncate text-[19px] font-medium tracking-[-0.025em] text-[var(--ax-text)] sm:text-[20px]">Axion Writer</span>
                    </a>
                    <nav className="flex items-center gap-2" aria-label="Writer">
                        <AxActionLink href={projectId ? `/documents?project=${encodeURIComponent(projectId)}` : "/documents"} variant="quiet" size="sm">Documents</AxActionLink>
                        <AxActionLink href={projectId ? `/new?project=${encodeURIComponent(projectId)}` : "/new"} variant="primary" size="sm">New document</AxActionLink>
                    </nav>
                </div>
            </header>

            <main className="min-h-[calc(100vh-96px)] bg-[var(--ax-canvas)] px-4 py-10 text-[var(--ax-text)] sm:px-6">
                <div className="mx-auto max-w-5xl">
                    <AxSectionHeader className="border-b border-[var(--ax-line)] pb-7" eyebrow="Project results" title={projectTitle || "Active project"} description="Choose a saved result and start a Writer draft from it. The result is read directly from this Project on the device." />

                    {!projectId ? (
                        <AxEmptyState title="No active Project." description="Open Writer from the Science Hub so the document can keep the same research context." />
                    ) : loading ? (
                        <AxLoadingState label="Loading Project results" detail="Reading saved scientific objects from this device." />
                    ) : objects.length ? (
                        <div className="divide-y divide-[var(--ax-line)] border-y border-[var(--ax-line)]">
                            {objects.map((object) => (
                                <article key={object.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-[var(--ax-text)]">{object.title}</h2><AxBadge>Saved result</AxBadge></div>
                                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ax-text-faint)]">{object.domain || object.kind}</div>
                                    </div>
                                    <AxActionLink href={`/new?source=project&project=${encodeURIComponent(projectId)}&objectId=${encodeURIComponent(object.id)}`} variant="primary">New document</AxActionLink>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <AxEmptyState title="No saved Math results yet." description="Solve something in Laboratory and press Save. The result will appear here without a server-side import step." action={<AxActionLink href={getEcosystemHref("math", "writer", projectId)}>Open Math</AxActionLink>} />
                    )}
                </div>
            </main>
        </>
    );
}
