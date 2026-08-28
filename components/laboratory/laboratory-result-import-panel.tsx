"use client";

import React from "react";
import { DatabaseZap, RefreshCw, Search } from "lucide-react";

import {
    createWriterImportPayloadFromSavedResult,
    fetchSavedLaboratoryResults,
    type SavedLaboratoryResult,
} from "@/lib/laboratory-results";
import type { WriterBridgePublicationProfile, WriterImportPayload } from "@/lib/live-writer-bridge";
import {
    LAB_PUBLICATION_PROFILE_DESCRIPTIONS,
    LAB_PUBLICATION_PROFILE_LABELS,
} from "@/lib/laboratory-publication-profile";
import { summarizeComputationalTrust } from "@/lib/computational-integrity";

export function LaboratoryResultImportPanel({
    onImport,
}: {
    onImport: (payload: WriterImportPayload) => void;
}) {
    const [results, setResults] = React.useState<SavedLaboratoryResult[]>([]);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState("");
    const [moduleFilter, setModuleFilter] = React.useState("all");
    const [sortOrder, setSortOrder] = React.useState("-updated_at");
    const [publicationProfile, setPublicationProfile] = React.useState<WriterBridgePublicationProfile>("summary");
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const requestIdRef = React.useRef(0);

    const loadResults = React.useCallback(async (options?: { immediate?: boolean }) => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);

        try {
            const nextResults = await fetchSavedLaboratoryResults({
                search: search.trim() || undefined,
                moduleSlug: moduleFilter !== "all" ? moduleFilter : undefined,
                ordering: sortOrder,
            });

            if (requestId !== requestIdRef.current) return;
            setResults(nextResults);
            setSelectedId((current) =>
                current && nextResults.some((item) => item.id === current)
                    ? current
                    : nextResults[0]?.id ?? null,
            );
        } catch (loadError) {
            if (requestId !== requestIdRef.current) return;
            setError(loadError instanceof Error ? loadError.message : "Laboratory resultlarini yuklab bo‘lmadi.");
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }

        void options;
    }, [moduleFilter, search, sortOrder]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadResults();
        }, search.trim() ? 280 : 0);

        return () => window.clearTimeout(timer);
    }, [loadResults, search]);

    const selectedResult = React.useMemo(
        () => results.find((result) => result.id === selectedId) ?? null,
        [results, selectedId],
    );

    const moduleOptions = React.useMemo(() => {
        const modules = Array.from(new Set(results.map((item) => item.module_slug).filter(Boolean)));
        return ["all", ...modules];
    }, [results]);

    const selectedTrust = selectedResult ? summarizeComputationalTrust(selectedResult.metadata) : null;

    return (
        <section className="rounded-xl border border-border/60 bg-background">
            <div className="flex items-start justify-between gap-3 border-b border-border/50 p-3.5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-black tracking-tight">
                        <DatabaseZap className="h-4 w-4 text-muted-foreground" />
                        Lab results
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Saqlangan hisob-kitobni revision va trust metadata bilan joriy sectionga kiriting.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadResults({ immediate: true })}
                    disabled={loading}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-40"
                    aria-label="Lab resultlarini yangilash"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="space-y-2 border-b border-border/50 p-2.5">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Result qidirish…"
                        className="h-9 w-full rounded-lg border border-border/60 bg-muted/5 pl-9 pr-3 text-xs outline-none focus:border-foreground/20"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={moduleFilter}
                        onChange={(event) => setModuleFilter(event.target.value)}
                        className="h-9 min-w-0 rounded-lg border border-border/60 bg-background px-2.5 text-[11px] font-semibold outline-none focus:border-foreground/20"
                    >
                        {moduleOptions.map((option) => (
                            <option key={option} value={option}>
                                {option === "all" ? "All modules" : option}
                            </option>
                        ))}
                    </select>
                    <select
                        value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value)}
                        className="h-9 min-w-0 rounded-lg border border-border/60 bg-background px-2.5 text-[11px] font-semibold outline-none focus:border-foreground/20"
                    >
                        <option value="-updated_at">Newest</option>
                        <option value="updated_at">Oldest</option>
                        <option value="title">Title A–Z</option>
                        <option value="-title">Title Z–A</option>
                    </select>
                </div>

                <select
                    value={publicationProfile}
                    onChange={(event) => setPublicationProfile(event.target.value as WriterBridgePublicationProfile)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-2.5 text-[11px] font-semibold outline-none focus:border-foreground/20"
                >
                    {(Object.keys(LAB_PUBLICATION_PROFILE_LABELS) as WriterBridgePublicationProfile[]).map((profile) => (
                        <option key={profile} value={profile}>
                            {LAB_PUBLICATION_PROFILE_LABELS[profile]}
                        </option>
                    ))}
                </select>
                <div className="px-1 text-[10px] leading-4 text-muted-foreground">
                    {LAB_PUBLICATION_PROFILE_DESCRIPTIONS[publicationProfile]}
                </div>
            </div>

            {error ? (
                <div className="border-b border-border/50 bg-rose-500/10 px-3.5 py-2.5 text-[11px] text-rose-700 dark:text-rose-300">
                    {error}
                </div>
            ) : null}

            <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin">
                {loading && !results.length ? (
                    <div className="px-3 py-5 text-center text-[11px] text-muted-foreground">Lab resultlari yuklanmoqda…</div>
                ) : !results.length ? (
                    <div className="px-3 py-5 text-center text-[11px] leading-5 text-muted-foreground">
                        Mos saved result topilmadi. Laboratory’da natijani avval saqlang.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {results.map((result) => {
                            const active = result.id === selectedId;
                            return (
                                <button
                                    key={result.id}
                                    type="button"
                                    onClick={() => setSelectedId(result.id)}
                                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                                        active
                                            ? "border-foreground/15 bg-foreground text-background"
                                            : "border-transparent hover:border-border/60 hover:bg-muted/20"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-bold">{result.title}</div>
                                            <div className={`mt-1 truncate text-[9px] uppercase tracking-[0.1em] ${active ? "text-background/60" : "text-muted-foreground"}`}>
                                                {result.module_title} · {result.mode || "report"}
                                            </div>
                                        </div>
                                        <span className={`shrink-0 text-[9px] font-bold ${active ? "text-background/60" : "text-muted-foreground"}`}>
                                            r{result.revision}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedResult ? (
                <div className="border-t border-border/50 p-3">
                    <div className="text-xs font-black tracking-tight">{selectedResult.title}</div>
                    <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-muted-foreground">
                        {selectedResult.summary || "Saved laboratory asset"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold text-muted-foreground">
                        <span className="rounded-md bg-muted/40 px-2 py-1">r{selectedResult.revision}</span>
                        {selectedTrust ? (
                            <span className="rounded-md bg-muted/40 px-2 py-1">
                                Trust {selectedTrust.label}{selectedTrust.score === null ? "" : ` ${selectedTrust.score}/100`}
                            </span>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={() => onImport(createWriterImportPayloadFromSavedResult(selectedResult, publicationProfile))}
                        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-background"
                    >
                        <DatabaseZap className="h-3.5 w-3.5" />
                        Import into section
                    </button>
                </div>
            ) : null}
        </section>
    );
}
