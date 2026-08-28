"use client";

import { BookText, RefreshCw, Sparkles } from "lucide-react";

import type { WriterWorkspaceController } from "./workspace-types";

export function WriterReviewInspector({ controller }: { controller: WriterWorkspaceController }) {
    const {
        intelligenceReport,
        exportPreflightReport,
        createRevisionSnapshotFromCurrent,
        revisionSnapshots,
        selectedSnapshot,
        revisionComparison,
        setSelectedSnapshotId,
        handleRestoreSnapshot,
    } = controller;

    return (
        <div className="space-y-3">
            <div className="site-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Preflight</div>
                        <div className="mt-1 text-lg font-black">Publication readiness</div>
                    </div>
                    <div className={`site-status-pill px-3 py-1 ${statusTone(intelligenceReport.preflight.status)}`}>
                        {intelligenceReport.preflight.status}
                    </div>
                </div>

                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${intelligenceReport.preflight.score}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label="Score" value={intelligenceReport.preflight.score} />
                    <Metric label="References" value={intelligenceReport.bibliographyKeys.length} />
                </div>

                <div className="mt-4 space-y-2">
                    {intelligenceReport.preflight.blockers.map((item) => (
                        <Notice key={item} tone="danger">{item}</Notice>
                    ))}
                    {intelligenceReport.preflight.warnings.map((item) => (
                        <Notice key={item} tone="warning">{item}</Notice>
                    ))}
                    {!intelligenceReport.preflight.blockers.length && !intelligenceReport.preflight.warnings.length ? (
                        <Notice tone="success">No blocking publication issues detected.</Notice>
                    ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={exportPreflightReport} className="site-btn px-4 text-xs">Export preflight</button>
                    <button type="button" onClick={() => createRevisionSnapshotFromCurrent("Checkpoint snapshot")} className="site-btn-accent px-4 text-xs">Create snapshot</button>
                </div>
            </div>

            <div className="site-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Citation audit</div>
                        <div className="mt-1 text-lg font-black">Reference integrity</div>
                    </div>
                    <BookText className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="grid gap-2 text-sm">
                    <Metric label="In-text citations" value={intelligenceReport.inlineCitationKeys.length} />
                    <Metric label="Bibliography entries" value={intelligenceReport.bibliographyKeys.length} />
                    <Notice tone={intelligenceReport.missingBibliographyKeys.length ? "danger" : "success"}>
                        Missing bibliography keys: {intelligenceReport.missingBibliographyKeys.join(", ") || "none"}
                    </Notice>
                    <Notice tone={intelligenceReport.unusedBibliographyKeys.length ? "warning" : "success"}>
                        Unused bibliography keys: {intelligenceReport.unusedBibliographyKeys.join(", ") || "none"}
                    </Notice>
                </div>
            </div>

            <div className="site-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Revision compare</div>
                        <div className="mt-1 text-lg font-black">Snapshot review</div>
                    </div>
                    <RefreshCw className="h-5 w-5 text-sky-500" />
                </div>

                {revisionSnapshots.length ? (
                    <>
                        <select
                            value={selectedSnapshot?.id ?? ""}
                            onChange={(event) => setSelectedSnapshotId(event.target.value)}
                            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none"
                        >
                            {revisionSnapshots.map((snapshot) => (
                                <option key={snapshot.id} value={snapshot.id}>
                                    {snapshot.label} - {new Date(snapshot.createdAt).toLocaleString()}
                                </option>
                            ))}
                        </select>

                        {revisionComparison ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <Metric label="Added words" value={revisionComparison.addedWords} />
                                <Metric label="Removed words" value={revisionComparison.removedWords} />
                                <Metric label="Heading delta" value={revisionComparison.headingDelta} />
                                <Metric label="Equation delta" value={revisionComparison.equationDelta} />
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => selectedSnapshot && handleRestoreSnapshot(selectedSnapshot)}
                            className="site-btn mt-3 px-4 text-xs"
                            disabled={!selectedSnapshot}
                        >
                            Restore snapshot
                        </button>
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                        Hali snapshot yo&apos;q. Save yoki `Create snapshot` bilan compare bazasini yarating.
                    </div>
                )}
            </div>

            <div className="site-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Intelligence</div>
                        <div className="mt-1 text-lg font-black">Consistency checks</div>
                    </div>
                    <Sparkles className="h-5 w-5 text-teal-500" />
                </div>
                <div className="space-y-2">
                    {intelligenceReport.duplicateHeadingTitles.map((item) => (
                        <Notice key={item.title} tone="warning">Duplicate heading: {item.title} ({item.count}x)</Notice>
                    ))}
                    {intelligenceReport.undefinedSymbolCandidates.map((item) => (
                        <Notice key={item.symbol} tone="neutral">Symbol review: {item.symbol} appears {item.count} times without an obvious definition cue.</Notice>
                    ))}
                    {!intelligenceReport.duplicateHeadingTitles.length && !intelligenceReport.undefinedSymbolCandidates.length ? (
                        <Notice tone="success">No structural consistency issues detected.</Notice>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function statusTone(status: string) {
    if (status === "ready") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    if (status === "review") return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="site-soft-panel rounded-xl bg-background/80 p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-black">{value}</div>
        </div>
    );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "danger" | "warning" | "success" | "neutral" }) {
    const classes = {
        danger: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        neutral: "border-border/60 bg-muted/10 text-muted-foreground",
    }[tone];
    return <div className={`rounded-xl border px-3 py-2.5 text-sm ${classes}`}>{children}</div>;
}
