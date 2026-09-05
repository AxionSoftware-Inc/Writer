"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, X } from "lucide-react";

import { AxBadge, AxButton, AxEmptyState, AxLoadingState, AxNotice } from "@/components/axion";
import { WriteTypeSelector } from "@/components/write-type-selector";
import { fetchPublic, isExpectedBackendOfflineError } from "@/lib/api";
import { deleteWriterPaper } from "@/lib/writer-api";

type Paper = {
    id: number;
    title: string;
    abstract: string;
    status: string;
    document_kind?: string;
    section_count?: number;
    created_at: string;
    updated_at: string;
};

type Filter = "all" | "draft" | "published";
type ArchiveCounts = { all: number; draft: number; published: number };

function WriterMark() {
    return (
        <svg viewBox="0 0 36 36" className="h-8 w-8 text-[var(--ax-accent)]" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.05" />
            <path d="M10 11h16M10 16h16M10 21h12M10 26h9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.68" />
            <path d="M23 24l4-4 2 2-4 4-3 1z" fill="currentColor" opacity="0.85" />
        </svg>
    );
}

function countArchive(papers: Paper[]): ArchiveCounts {
    return {
        all: papers.length,
        draft: papers.filter((paper) => paper.status === "draft").length,
        published: papers.filter((paper) => paper.status === "published").length,
    };
}

export default function DocumentsPage() {
    const [papers, setPapers] = useState<Paper[]>([]);
    const [counts, setCounts] = useState<ArchiveCounts>({ all: 0, draft: 0, published: 0 });
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [createOpen, setCreateOpen] = useState(false);

    const fetchPapers = useCallback(async () => {
        setLoading(true);
        setNotice(null);
        try {
            const params = new URLSearchParams();
            if (filter !== "all") params.set("status", filter);
            if (query.trim()) params.set("q", query.trim());

            const filteredUrl = `/api/builder/papers/?${params.toString()}`;
            const needsArchiveSnapshot = filter !== "all" || Boolean(query.trim());
            const [filteredResponse, archiveResponse] = await Promise.all([
                fetchPublic(filteredUrl),
                needsArchiveSnapshot ? fetchPublic("/api/builder/papers/") : Promise.resolve(null),
            ]);

            if (!filteredResponse.ok || (archiveResponse && !archiveResponse.ok)) {
                throw new Error("archive-unavailable");
            }

            const filteredPapers = await filteredResponse.json() as Paper[];
            const archivePapers = archiveResponse
                ? await archiveResponse.json() as Paper[]
                : filteredPapers;

            setPapers(filteredPapers);
            setCounts(countArchive(archivePapers));
        } catch (error) {
            setPapers([]);
            setCounts({ all: 0, draft: 0, published: 0 });
            setNotice(isExpectedBackendOfflineError(error)
                ? "Document archive is offline. Local drafting and new documents remain available."
                : "The document archive could not be loaded. You can still start a new draft.");
        } finally {
            setLoading(false);
        }
    }, [filter, query]);

    useEffect(() => {
        const timer = window.setTimeout(() => void fetchPapers(), 260);
        return () => window.clearTimeout(timer);
    }, [fetchPapers]);

    return (
        <div className="ax-workspace-root min-h-[calc(100vh-28px)]">
            <header className="ax-work-subnav sticky top-0 z-40">
                <div className="ax-work-container flex h-16 items-center justify-between gap-5">
                    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-[var(--ax-work-control-radius)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                        <WriterMark />
                        <span className="min-w-0 leading-none">
                            <span className="block truncate font-serif text-[19px] font-medium tracking-[-0.03em]">Axion Writer</span>
                            <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--ax-text-faint)]">Publication workspace</span>
                        </span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link href="/project" className="hidden px-3 py-2 text-[11px] font-semibold text-[var(--ax-text-soft)] hover:text-[var(--ax-text)] sm:inline-flex">Project results</Link>
                        <AxButton variant="primary" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />New document</AxButton>
                    </div>
                </div>
            </header>

            <main className="ax-work-container">
                <section className="ax-work-pagehead">
                    <div>
                        <p className="ax-work-kicker">Documents</p>
                        <h1 className="ax-work-title">Publication workspace.</h1>
                        <p className="ax-work-lead">Draft papers, reports and books in a quiet manuscript-first environment while keeping scientific evidence close to its source Project.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ax-text-faint)]" />
                            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" className="ax-work-input h-11 w-full pl-10 pr-10 text-sm" />
                            {query ? <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ax-text-faint)] hover:text-[var(--ax-text)]" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
                        </div>
                        <div className="ax-work-stats">
                            <div className="ax-work-stat"><div className="ax-work-stat-value">{counts.all}</div><div className="ax-work-stat-label">Documents</div></div>
                            <div className="ax-work-stat"><div className="ax-work-stat-value">{counts.draft}</div><div className="ax-work-stat-label">Drafts</div></div>
                            <div className="ax-work-stat"><div className="ax-work-stat-value">{counts.published}</div><div className="ax-work-stat-label">Published</div></div>
                        </div>
                    </div>
                </section>

                <section className="ax-work-section grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)]">
                    <aside>
                        <div className="sticky top-[88px] border-t border-[var(--ax-work-line)] pt-3">
                            {([[
                                "all", "All documents"],
                                ["draft", "Drafts"],
                                ["published", "Published"],
                            ] as const).map(([id, label]) => (
                                <button key={id} onClick={() => setFilter(id)} className={`flex w-full items-center justify-between border-l px-3 py-3 text-left text-[11px] font-semibold transition-colors ${filter === id ? "border-[var(--ax-accent)] text-[var(--ax-text)]" : "border-transparent text-[var(--ax-text-soft)] hover:border-[var(--ax-line-strong)] hover:text-[var(--ax-text)]"}`}>
                                    <span>{label}</span><span className="text-[10px] text-[var(--ax-text-faint)]">{counts[id]}</span>
                                </button>
                            ))}
                            <div className="mt-6 border-t border-[var(--ax-work-line)] pt-5 text-[10px] leading-5 text-[var(--ax-text-faint)]">Manuscript first. Scientific metadata stays secondary until the writing needs it.</div>
                        </div>
                    </aside>

                    <div className="min-w-0">
                        {notice ? <AxNotice tone="warning" title="Archive unavailable">{notice}</AxNotice> : null}
                        {loading ? (
                            <AxLoadingState label="Loading documents" detail="Reading the current Writer archive." />
                        ) : papers.length === 0 ? (
                            <AxEmptyState title="No documents here yet." description="Start with a clean manuscript or create one from a saved Project result." action={<AxButton variant="primary" onClick={() => setCreateOpen(true)}>Create document</AxButton>} />
                        ) : (
                            <div className="ax-work-list">
                                {papers.map((paper) => (
                                    <article key={paper.id} className="ax-work-row group grid gap-4 px-1 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5 lg:px-6">
                                        <Link href={`/${paper.id}`} className="min-w-0 rounded-[var(--ax-work-control-radius)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate font-serif text-[25px] tracking-[-0.035em]">{paper.title || "Untitled document"}</h2>
                                                <AxBadge tone={paper.status === "published" ? "success" : "neutral"}>{paper.status === "published" ? "Published" : "Draft"}</AxBadge>
                                                <AxBadge>{paper.document_kind || "paper"}</AxBadge>
                                            </div>
                                            <p className="mt-2 line-clamp-2 max-w-3xl text-[12px] leading-6 text-[var(--ax-text-soft)]">{paper.abstract || "No abstract yet."}</p>
                                            <div className="mt-3 flex flex-wrap gap-4 text-[9.5px] text-[var(--ax-text-faint)]">
                                                <span>{paper.section_count || 1} sections</span>
                                                <span>Updated {new Date(paper.updated_at).toLocaleDateString()}</span>
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-1">
                                            <Link href={`/${paper.id}`} className="inline-flex h-9 items-center rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line-strong)] bg-[var(--ax-surface)] px-3 text-[10px] font-semibold hover:bg-[var(--ax-work-surface-muted)]">Open</Link>
                                            <button onClick={async () => { if (window.confirm(`Delete “${paper.title || "Untitled"}”?`)) { await deleteWriterPaper(paper.id); await fetchPapers(); } }} className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ax-work-control-radius)] text-[var(--ax-text-faint)] hover:bg-[var(--ax-work-surface-muted)] hover:text-[var(--ax-danger)]" aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <WriteTypeSelector isOpen={createOpen} onClose={() => setCreateOpen(false)} />
        </div>
    );
}
