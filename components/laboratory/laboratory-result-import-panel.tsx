"use client";

import React from "react";
import { DatabaseZap, RefreshCw, Search } from "lucide-react";

import {
    createWriterImportPayloadFromSavedResult,
    fetchSavedLaboratoryResults,
    type SavedLaboratoryResult,
} from "@/lib/laboratory-results";
import type { WriterImportPayload, WriterBridgePublicationProfile } from "@/lib/live-writer-bridge";
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

    const loadResults = React.useCallback(async (query = "", moduleSlug = moduleFilter, ordering = sortOrder) => {
        setLoading(true);
        setError(null);
        try {
            const nextResults = await fetchSavedLaboratoryResults({
                search: query.trim() || undefined,
                moduleSlug: moduleSlug !== "all" ? moduleSlug : undefined,
                ordering,
            });
            setResults(nextResults);
            setSelectedId((current) => (current && nextResults.some((item) => item.id === current) ? current : nextResults[0]?.id ?? null));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load laboratory results.");
        } finally {
            setLoading(false);
        }
    }, [moduleFilter, sortOrder]);

    React.useEffect(() => {
        void loadResults();
    }, [loadResults]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadResults(search, moduleFilter, sortOrder);
        }, 280);
        return () => window.clearTimeout(timer);
    }, [loadResults, moduleFilter, search, sortOrder]);

    const selectedResult = React.useMemo(
        () => results.find((result) => result.id === selectedId) ?? null,
        [results, selectedId],
    );
    const moduleOptions = React.useMemo(() => {
        const modules = Array.from(new Set(results.map((item) => item.module_slug)));
        return ["all", ...modules];
    }, [results]);
    const selectedTrust = selectedResult ? summarizeComputationalTrust(selectedResult.metadata) : null;

    return (
        <div className="site-panel p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                        Laboratory Assets
                    </div>
                    <div className="mt-1 text-lg font-black">Import Saved Result</div>
                </div>
                <button
                    type="button"
                    onClick={() => void loadResults(search)}
                    className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-accent/25 hover:text-foreground"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Integral, matrix, probability..."
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent/30"
                />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                    value={moduleFilter}
                    onChange={(event) => setModuleFilter(event.target.value)}
                    className="h-11 rounded-2xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-accent/30"
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
                    className="h-11 rounded-2xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-accent/30"
                >
                    <option value="-updated_at">Newest first</option>
                    <option value="updated_at">Oldest first</option>
                    <option value="title">Title A-Z</option>
                    <option value="-title">Title Z-A</option>
                </select>
            </div>
            <div className="mt-3">
                <select
                    value={publicationProfile}
                    onChange={(event) => setPublicationProfile(event.target.value as WriterBridgePublicationProfile)}
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-accent/30"
                >
                    {(Object.keys(LAB_PUBLICATION_PROFILE_LABELS) as WriterBridgePublicationProfile[]).map((profile) => (
                        <option key={profile} value={profile}>
                            {LAB_PUBLICATION_PROFILE_LABELS[profile]}
                        </option>
                    ))}
                </select>
                <div className="mt-2 text-xs leading-6 text-muted-foreground">
                    {LAB_PUBLICATION_PROFILE_DESCRIPTIONS[publicationProfile]}
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {loading ? (
                    <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                        Laboratory resultlar yuklanmoqda...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-5 text-sm text-rose-700 dark:text-rose-300">
                        {error}
                    </div>
                ) : results.length === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                        Hozircha saved laboratory result yo&apos;q. Avval lab report ichida `Save Result` bosing.
                    </div>
                ) : (
                    <>
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {results.map((result) => {
                                const active = result.id === selectedId;
                                return (
                                    <button
                                        key={result.id}
                                        type="button"
                                        onClick={() => setSelectedId(result.id)}
                                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                                            active
                                                ? "border-accent/30 bg-[var(--accent-soft)]"
                                                : "border-border/60 bg-background hover:border-accent/20"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-bold text-foreground">{result.title}</div>
                                                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    {result.module_title} / {result.mode || "report"}
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                r{result.revision}
                                            </div>
                                        </div>
                                        <div className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                            {result.summary || "Saved laboratory asset"}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedResult ? (
                            <div className="rounded-[1.6rem] border border-border/60 bg-muted/10 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                                            Selected Asset
                                        </div>
                                        <div className="mt-1 text-base font-black">{selectedResult.title}</div>
                                    </div>
                                    <DatabaseZap className="mt-1 h-4 w-4 text-accent" />
                                </div>
                                <div className="mt-3 text-sm leading-6 text-muted-foreground">
                                    {selectedResult.summary || "No summary provided."}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                                    <span className="rounded-full border border-border/60 bg-background px-3 py-1.5">
                                        {selectedResult.module_title}
                                    </span>
                                    <span className="rounded-full border border-border/60 bg-background px-3 py-1.5">
                                        {new Date(selectedResult.updated_at).toLocaleString()}
                                    </span>
                                    {selectedTrust ? (
                                        <span className="rounded-full border border-border/60 bg-background px-3 py-1.5">
                                            Trust: {selectedTrust.label}
                                            {selectedTrust.score === null ? "" : ` ${selectedTrust.score}/100`}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-3 rounded-2xl border border-border/60 bg-background px-3 py-3 text-xs leading-5 text-muted-foreground">
                                    <div className="font-black text-foreground">Import includes</div>
                                    <div className="mt-1">- saved result snapshot with revision tracking</div>
                                    <div>- result-backed computational citation</div>
                                    <div>- trust/certificate summary</div>
                                    {publicationProfile === "summary" || publicationProfile === "figures" ? null : (
                                        <div>- reproducibility appendix with source/result hashes</div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onImport(createWriterImportPayloadFromSavedResult(selectedResult, publicationProfile))}
                                    className="site-btn-accent mt-4 w-full justify-center px-4"
                                >
                                    Import into Current Section
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
