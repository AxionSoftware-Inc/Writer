"use client";

import { useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Copy,
    FilePlus2,
    Filter,
    MoreHorizontal,
    Search,
    Trash2,
} from "lucide-react";

import { type WriterProjectSection, getWriterSectionKey } from "@/lib/writer-project";

function progressDot(progressState: WriterProjectSection["progress_state"]) {
    if (progressState === "done") return "bg-emerald-500";
    if (progressState === "drafting") return "bg-amber-500";
    return "bg-sky-500";
}

export function WriterProjectPanel({
    sections,
    activeSectionId,
    activeSection,
    documentKind,
    onSelectSection,
    onUpdateActiveSection,
    onAddSection,
    onDuplicateSection,
    onMoveSection,
    onRemoveSection,
}: {
    sections: WriterProjectSection[];
    activeSectionId: string;
    activeSection: WriterProjectSection;
    documentKind: string;
    onSelectSection: (sectionId: string) => void;
    onUpdateActiveSection: (patch: Partial<WriterProjectSection>) => void;
    onAddSection: () => void;
    onDuplicateSection: () => void;
    onMoveSection: (sectionId: string, direction: "up" | "down") => void;
    onRemoveSection: (sectionId: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [kindFilter, setKindFilter] = useState<WriterProjectSection["kind"] | "all">("all");
    const [hideDone, setHideDone] = useState(false);

    const visibleSections = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return sections.filter((section) => {
            if (hideDone && section.progress_state === "done") return false;
            if (kindFilter !== "all" && section.kind !== kindFilter) return false;
            if (!normalizedSearch) return true;
            return `${section.title} ${section.kind} ${section.progress_state}`.toLowerCase().includes(normalizedSearch);
        });
    }, [hideDone, kindFilter, search, sections]);

    return (
        <div className="writer-project-panel flex min-h-0 flex-col rounded-2xl border border-border/60 bg-background/75">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3.5 py-3">
                <div className="min-w-0">
                    <div className="text-xs font-black tracking-tight">Sections</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {documentKind} · {sections.length} files
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onAddSection}
                        className="writer-icon-button"
                        title="New section"
                        aria-label="New section"
                    >
                        <FilePlus2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicateSection}
                        className="writer-icon-button"
                        title="Duplicate active section"
                        aria-label="Duplicate active section"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="border-b border-border/50 p-2.5">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search sections"
                        className="h-9 w-full rounded-xl border border-border/60 bg-muted/10 pl-9 pr-3 text-xs font-medium outline-none transition-colors focus:border-accent/35 focus:bg-background"
                    />
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <div className="relative">
                        <Filter className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <select
                            value={kindFilter}
                            onChange={(event) => setKindFilter(event.target.value as WriterProjectSection["kind"] | "all")}
                            className="h-8 w-full appearance-none rounded-lg border border-border/50 bg-background pl-8 pr-7 text-[11px] font-semibold outline-none focus:border-accent/35"
                        >
                            <option value="all">All types</option>
                            <option value="frontmatter">Frontmatter</option>
                            <option value="chapter">Chapter</option>
                            <option value="section">Section</option>
                            <option value="appendix">Appendix</option>
                            <option value="references">References</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <button
                        type="button"
                        onClick={() => setHideDone((value) => !value)}
                        className={`h-8 rounded-lg border px-2.5 text-[10px] font-bold transition-colors ${
                            hideDone
                                ? "border-accent/25 bg-[var(--accent-soft)] text-accent"
                                : "border-border/50 bg-background text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {hideDone ? "Done hidden" : "Hide done"}
                    </button>
                </div>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {visibleSections.map((section) => {
                    const sectionId = getWriterSectionKey(section);
                    const index = sections.findIndex((entry) => getWriterSectionKey(entry) === sectionId);
                    const active = sectionId === activeSectionId;

                    return (
                        <div
                            key={sectionId}
                            className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors ${
                                active
                                    ? "border-foreground/15 bg-foreground text-background"
                                    : "border-transparent hover:border-border/60 hover:bg-muted/25"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onSelectSection(sectionId)}
                                className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left"
                            >
                                <span className={`h-2 w-2 shrink-0 rounded-full ${progressDot(section.progress_state)}`} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-bold">{section.title}</span>
                                    <span className={`mt-0.5 block truncate text-[9px] uppercase tracking-[0.14em] ${active ? "text-background/60" : "text-muted-foreground"}`}>
                                        {section.kind} · {section.progress_state}
                                    </span>
                                </span>
                            </button>

                            <div className={`flex items-center gap-0.5 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                <button
                                    type="button"
                                    onClick={() => onMoveSection(sectionId, "up")}
                                    disabled={index === 0}
                                    className="writer-row-action"
                                    title="Move up"
                                    aria-label="Move up"
                                >
                                    <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMoveSection(sectionId, "down")}
                                    disabled={index === sections.length - 1}
                                    className="writer-row-action"
                                    title="Move down"
                                    aria-label="Move down"
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRemoveSection(sectionId)}
                                    disabled={sections.length === 1}
                                    className="writer-row-action hover:text-rose-500"
                                    title="Remove section"
                                    aria-label="Remove section"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {!visibleSections.length && (
                    <div className="rounded-xl border border-dashed border-border/60 px-3 py-5 text-center text-xs text-muted-foreground">
                        No sections match this filter.
                    </div>
                )}
            </div>

            <details className="group border-t border-border/60">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[11px] font-bold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <span>Active section settings</span>
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </summary>
                <div className="space-y-2 border-t border-border/40 p-2.5">
                    <input
                        value={activeSection.title}
                        onChange={(event) => onUpdateActiveSection({ title: event.target.value })}
                        className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold outline-none focus:border-accent/35"
                        placeholder="Section title"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={activeSection.kind}
                            onChange={(event) => onUpdateActiveSection({ kind: event.target.value as WriterProjectSection["kind"] })}
                            className="h-9 min-w-0 rounded-xl border border-border/60 bg-background px-2.5 text-[11px] font-semibold outline-none focus:border-accent/35"
                        >
                            <option value="frontmatter">Frontmatter</option>
                            <option value="chapter">Chapter</option>
                            <option value="section">Section</option>
                            <option value="appendix">Appendix</option>
                            <option value="references">References</option>
                        </select>
                        <select
                            value={activeSection.progress_state}
                            onChange={(event) =>
                                onUpdateActiveSection({
                                    progress_state: event.target.value as WriterProjectSection["progress_state"],
                                })
                            }
                            className="h-9 min-w-0 rounded-xl border border-border/60 bg-background px-2.5 text-[11px] font-semibold outline-none focus:border-accent/35"
                        >
                            <option value="todo">Todo</option>
                            <option value="drafting">Drafting</option>
                            <option value="done">Done</option>
                        </select>
                    </div>
                </div>
            </details>
        </div>
    );
}
