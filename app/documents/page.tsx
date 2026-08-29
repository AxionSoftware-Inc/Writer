"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Search, Trash2, X } from "lucide-react";

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

function WriterMark() {
    return (
        <svg viewBox="0 0 36 36" className="h-8 w-8 text-[var(--ax-accent)]" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M10 11h16M10 16h16M10 21h12M10 26h9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.72" />
            <path d="M23 24l4-4 2 2-4 4-3 1z" fill="currentColor" opacity="0.85" />
        </svg>
    );
}

export default function DocumentsPage() {
    const [papers, setPapers] = useState<Paper[]>([]);
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
            const response = await fetchPublic(`/api/builder/papers/?${params.toString()}`);
            if (!response.ok) throw new Error("archive-unavailable");
            setPapers(await response.json());
        } catch (error) {
            setPapers([]);
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

    const counts = useMemo(() => ({
        all: papers.length,
        draft: papers.filter((paper) => paper.status === "draft").length,
        published: papers.filter((paper) => paper.status === "published").length,
    }), [papers]);

    return (
        <div className="min-h-[calc(100vh-32px)] bg-[var(--ax-canvas)] text-[var(--ax-text)]">
            <header className="sticky top-0 z-40 border-b border-[var(--ax-line)] bg-[color-mix(in_srgb,var(--ax-surface)_96%,transparent)] backdrop-blur-xl">
                <div className="mx-auto flex h-16 w-full max-w-[var(--ax-content-max)] items-center justify-between gap-5 px-4 sm:px-6">
                    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-[var(--ax-radius-control)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                        <WriterMark />
                        <span className="truncate text-[19px] font-medium tracking-[-0.025em] sm:text-[20px]">Axion Writer</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link href="/project" className="hidden rounded-[var(--ax-radius-control)] px-3 py-2 text-[11px] font-semibold text-[var(--ax-text-soft)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)] sm:inline-flex">Project results</Link>
                        <AxButton variant="primary" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />New document</AxButton>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[1380px] px-4 py-8 sm:px-6 lg:py-10">
                <section className="grid gap-8 border-b border-[var(--ax-line)] pb-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-accent)]">Documents</p>
                        <h1 className="mt-3 font-serif text-4xl tracking-[-0.045em] sm:text-5xl">Publication workspace.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ax-text-soft)] sm:text-base">Draft papers, reports and books in a quiet writing environment while keeping scientific results close to their source Project.</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ax-text-faint)]" />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" className="h-11 w-full rounded-[var(--ax-radius-control)] border border-[var(--ax-line-strong)] bg-[var(--ax-surface)] pl-10 pr-10 text-sm outline-none focus:border-[var(--ax-accent)] focus:shadow-[var(--ax-focus-ring)]" />
                        {query ? <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ax-text-faint)] hover:text-[var(--ax-text)]" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
                    </div>
                </section>

                <section className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <aside>
                        <div className="sticky top-[92px] space-y-1 border-t border-[var(--ax-line)] pt-3">
                            {([
                                ["all", "All documents"],
                                ["draft", "Drafts"],
                                ["published", "Published"],
                            ] as const).map(([id, label]) => (
                                <button key={id} onClick={() => setFilter(id)} className={`flex w-full items-center justify-between rounded-[var(--ax-radius-control)] px-3 py-2.5 text-left text-[12px] font-semibold transition-colors ${filter === id ? "bg-[var(--ax-accent-soft)] text-[var(--ax-accent-strong)]" : "text-[var(--ax-text-soft)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)]"}`}>
                                    <span>{label}</span><span className="text-[10px] text-[var(--ax-text-faint)]">{counts[id]}</span>
                                </button>
                            ))}
                            <div className="mt-5 border-t border-[var(--ax-line)] pt-4 text-[11px] leading-5 text-[var(--ax-text-faint)]">Writer is manuscript-first. Scientific metadata stays secondary until you need it.</div>
                        </div>
                    </aside>

                    <div className="min-w-0">
                        {notice ? <AxNotice tone="warning" title="Archive unavailable">{notice}</AxNotice> : null}
                        {loading ? (
                            <AxLoadingState label="Loading documents" detail="Reading the current Writer archive." />
                        ) : papers.length === 0 ? (
                            <AxEmptyState title="No documents here yet." description="Start with a clean draft or create one from a saved Project result." action={<AxButton variant="primary" onClick={() => setCreateOpen(true)}>Create document</AxButton>} />
                        ) : (
                            <div className="divide-y divide-[var(--ax-line)] border-y border-[var(--ax-line)]">
                                {papers.map((paper) => (
                                    <article key={paper.id} className="group grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                        <Link href={`/${paper.id}`} className="min-w-0 rounded-[var(--ax-radius-control)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em]">{paper.title || "Untitled document"}</h2>
                                                <AxBadge tone={paper.status === "published" ? "success" : "neutral"}>{paper.status === "published" ? "Published" : "Draft"}</AxBadge>
                                                <AxBadge>{paper.document_kind || "paper"}</AxBadge>
                                            </div>
                                            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--ax-text-soft)]">{paper.abstract || "No abstract yet."}</p>
                                            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-[var(--ax-text-faint)]">
                                                <span>{paper.section_count || 1} sections</span>
                                                <span>Updated {new Date(paper.updated_at).toLocaleDateString()}</span>
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-1">
                                            <Link href={`/${paper.id}`} className="inline-flex h-9 items-center rounded-[var(--ax-radius-control)] border border-[var(--ax-line-strong)] bg-[var(--ax-surface)] px-3 text-[11px] font-semibold hover:bg-[var(--ax-surface-soft)]">Open</Link>
                                            <button onClick={async () => { if (window.confirm(`Delete “${paper.title || "Untitled"}”?`)) { await deleteWriterPaper(paper.id); await fetchPapers(); } }} className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ax-radius-control)] text-[var(--ax-text-faint)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-danger)]" aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>
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
