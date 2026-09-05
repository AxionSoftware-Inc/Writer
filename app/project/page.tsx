"use client";

import React from "react";

import { AxActionLink, AxBadge, AxEmptyState, AxLoadingState } from "@/components/axion";
import { getEcosystemHref, getEcosystemRouteHref } from "@/lib/ecosystem/apps";
import { listLocalScientificObjects } from "@/lib/ecosystem/local-object-store";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import type { ScientificObject } from "@/lib/ecosystem/contracts";

function WriterMark() {
    return (
        <svg viewBox="0 0 36 36" className="h-8 w-8 text-[var(--ax-accent)]" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.05" />
            <path d="M10 11h16M10 16h16M10 21h12M10 26h9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.68" />
            <path d="M23 24l4-4 2 2-4 4-3 1z" fill="currentColor" opacity="0.85" />
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
            .then((items) => setObjects(items.filter((item) => item.sourceApp !== "writer")))
            .catch(() => setObjects([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="ax-workspace-root min-h-[calc(100vh-28px)]">
            <header className="ax-work-subnav sticky top-0 z-40">
                <div className="ax-work-container flex h-16 items-center justify-between gap-5">
                    <a href="/" className="flex min-w-0 items-center gap-3 rounded-[var(--ax-work-control-radius)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                        <WriterMark />
                        <span className="min-w-0 leading-none"><span className="block truncate font-serif text-[19px] font-medium tracking-[-0.03em]">Axion Writer</span><span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--ax-text-faint)]">Project evidence</span></span>
                    </a>
                    <nav className="flex items-center gap-1.5" aria-label="Writer">
                        <AxActionLink href={projectId ? `/documents?project=${encodeURIComponent(projectId)}` : "/documents"} variant="quiet" size="sm">Documents</AxActionLink>
                        <AxActionLink href={projectId ? `/new?project=${encodeURIComponent(projectId)}` : "/new"} variant="primary" size="sm">Blank document</AxActionLink>
                    </nav>
                </div>
            </header>

            <main className="ax-work-container">
                <section className="ax-work-pagehead">
                    <div>
                        <p className="ax-work-kicker">Project evidence</p>
                        <h1 className="ax-work-title">{projectTitle || "Active project"}</h1>
                        <p className="ax-work-lead">Choose a scientific object and start a manuscript with that evidence already inserted. The source Project and object identity remain part of the draft context.</p>
                    </div>
                    <div className="ax-work-stats">
                        <div className="ax-work-stat"><div className="ax-work-stat-value">{objects.length}</div><div className="ax-work-stat-label">Objects</div></div>
                        <div className="ax-work-stat"><div className="ax-work-stat-value">Live</div><div className="ax-work-stat-label">Evidence</div></div>
                        <div className="ax-work-stat"><div className="ax-work-stat-value">Local</div><div className="ax-work-stat-label">Context</div></div>
                    </div>
                </section>

                <section className="ax-work-section">
                    {!projectId ? (
                        <AxEmptyState title="No active Project." description="Open Writer from Science so the manuscript can preserve the same research context and provenance." />
                    ) : loading ? (
                        <AxLoadingState label="Loading Project evidence" detail="Reading scientific objects saved on this device." />
                    ) : objects.length ? (
                        <div className="ax-work-list">
                            {objects.map((object, index) => (
                                <article key={object.id} className="ax-work-row grid gap-4 px-1 py-6 sm:px-5 md:grid-cols-[54px_minmax(0,1fr)_auto] md:items-center lg:px-6">
                                    <div className="font-serif text-[20px] text-[var(--ax-text-faint)]">{String(index + 1).padStart(2, "0")}</div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate font-serif text-[26px] tracking-[-0.035em] text-[var(--ax-text)]">{object.title}</h2>
                                            <AxBadge>{String(object.sourceApp)}</AxBadge>
                                            <AxBadge>rev {object.currentRevision}</AxBadge>
                                        </div>
                                        <div className="mt-2 text-[9.5px] uppercase tracking-[0.13em] text-[var(--ax-text-faint)]">{object.domain || object.kind} · Project evidence</div>
                                    </div>
                                    <AxActionLink
                                        href={getEcosystemRouteHref("writer", "/new", "writer", projectId, { source: "project", objectId: object.id })}
                                        variant="primary"
                                    >
                                        Use as evidence
                                    </AxActionLink>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <AxEmptyState title="No scientific evidence yet." description="Save a result in Mathematics or add a finding in another instrument. It will appear here as a structured Project object." action={<AxActionLink href={getEcosystemHref("math", "writer", projectId)}>Open Mathematics</AxActionLink>} />
                    )}
                </section>
            </main>
        </div>
    );
}
