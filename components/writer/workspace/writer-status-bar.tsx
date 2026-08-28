"use client";

import { getWriterSectionKey } from "@/lib/writer-project";
import type { WriterWorkspaceController } from "./workspace-types";

export function WriterStatusBar({ controller }: { controller: WriterWorkspaceController }) {
    const {
        viewMode,
        normalizedSections,
        activeSection,
        formData,
        words,
        readingTime,
        totalPlots,
        plot3DBlocks,
        saveState,
        saveStatusLabel,
        previewSyncMode,
        previewIsStale,
        performanceModeRecommended,
    } = controller;

    if (viewMode === "edit") return null;

    const activeIndex = normalizedSections.findIndex(
        (section) => getWriterSectionKey(section) === getWriterSectionKey(activeSection),
    );

    return (
        <div className="border-t border-border/60 bg-muted/15 px-4 py-2.5 text-[11px] print:hidden">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto text-muted-foreground">
                <span className="site-status-pill border-accent/20 bg-[var(--accent-soft)] px-3 py-1 text-accent">
                    File {activeIndex + 1}/{normalizedSections.length}
                </span>
                <span className="site-status-pill px-3 py-1 text-foreground">{activeSection.title}</span>
                <span className="site-status-pill px-3 py-1">{formData.document_kind}</span>
                <span className="site-status-pill px-3 py-1">{words} so&apos;z</span>
                <span className="site-status-pill px-3 py-1">{readingTime} min</span>
                <span className="site-status-pill px-3 py-1">Plot {totalPlots}</span>
                {plot3DBlocks ? <span className="site-status-pill px-3 py-1">3D {plot3DBlocks}</span> : null}
                <span className={`site-status-pill px-3 py-1 ${saveState === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : ""}`}>
                    {saveStatusLabel}
                </span>
                <span className="site-status-pill px-3 py-1">
                    {previewSyncMode === "live" ? "Live preview" : "Manual preview"}
                </span>
                {previewSyncMode === "manual" ? (
                    <span className={`site-status-pill px-3 py-1 ${previewIsStale ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                        {previewIsStale ? "Preview stale" : "Preview synced"}
                    </span>
                ) : null}
                {performanceModeRecommended ? (
                    <span className="site-status-pill border-accent/20 bg-[var(--accent-soft)] px-3 py-1 text-accent">
                        Performance mode
                    </span>
                ) : null}
            </div>
        </div>
    );
}
