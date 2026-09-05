"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
    BookOpen,
    ChevronDown,
    ChevronUp,
    Copy,
    Filter,
    FilePlus2,
    FolderTree,
    Search,
    Trash2,
    type LucideIcon,
} from "lucide-react";

import { type WriterProjectSection, getWriterSectionKey } from "@/lib/writer-project";

function getProgressTone(progressState: WriterProjectSection["progress_state"], active: boolean) {
    if (active) return "border-[var(--ax-accent)] bg-[var(--ax-accent-soft)]";
    if (progressState === "done") return "border-[var(--ax-work-line)] bg-emerald-500/[0.025]";
    if (progressState === "drafting") return "border-[var(--ax-work-line)] bg-amber-500/[0.025]";
    return "border-[var(--ax-work-line)] bg-[var(--ax-surface)]";
}

function getProgressDotTone(progressState: WriterProjectSection["progress_state"], active: boolean) {
    if (active) return "bg-[var(--ax-accent)]";
    if (progressState === "done") return "bg-emerald-500";
    if (progressState === "drafting") return "bg-amber-500";
    return "bg-sky-500";
}

function HoverHint({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="group relative">
            {children}
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[220px] -translate-x-1/2 rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line)] bg-[var(--ax-surface)] px-2.5 py-1.5 text-[10px] font-medium leading-4 text-[var(--ax-text)] opacity-0 shadow-[var(--ax-work-shadow)] transition-opacity delay-500 group-hover:opacity-100">
                {label}
            </div>
        </div>
    );
}

function ActionIcon({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
    return (
        <HoverHint label={label}>
            <button
                type="button"
                onClick={onClick}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line)] bg-[var(--ax-surface)] text-[var(--ax-text-soft)] transition-colors hover:bg-[var(--ax-work-surface-muted)] hover:text-[var(--ax-text)]"
                aria-label={label}
            >
                <Icon className="h-3.5 w-3.5" />
            </button>
        </HoverHint>
    );
}

const controlClass = "w-full rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line-strong)] bg-[var(--ax-surface)] px-3 py-2 text-xs font-semibold text-[var(--ax-text)] outline-none transition-colors focus:border-[var(--ax-accent)] focus:shadow-[var(--ax-focus-ring)]";

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

    const visibleSections = useMemo(() => sections.filter((section) => {
        if (hideDone && section.progress_state === "done") return false;
        if (kindFilter !== "all" && section.kind !== kindFilter) return false;
        if (!search.trim()) return true;
        const haystack = `${section.title} ${section.kind} ${section.progress_state}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
    }), [hideDone, kindFilter, search, sections]);

    return (
        <div className="overflow-hidden rounded-[var(--ax-work-panel-radius)] border border-[var(--ax-work-line)] bg-[var(--ax-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ax-work-line)] px-4 py-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ax-text-faint)]">
                        <FolderTree className="h-3.5 w-3.5 text-[var(--ax-accent)]" />
                        Document structure
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--ax-text-soft)]">
                        <span>{documentKind}</span><span>·</span><span>{sections.length} sections</span>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    <ActionIcon icon={FilePlus2} label="Add section" onClick={onAddSection} />
                    <ActionIcon icon={Copy} label="Duplicate current section" onClick={onDuplicateSection} />
                </div>
            </div>

            <div className="border-b border-[var(--ax-work-line)] p-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ax-text-faint)]" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sections" className={`${controlClass} pl-9`} />
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <div className="relative">
                        <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ax-text-faint)]" />
                        <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as WriterProjectSection["kind"] | "all")} className={`${controlClass} appearance-none pl-9 pr-8`}>
                            <option value="all">All section kinds</option>
                            <option value="frontmatter">Frontmatter</option>
                            <option value="chapter">Chapter</option>
                            <option value="section">Section</option>
                            <option value="appendix">Appendix</option>
                            <option value="references">References</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ax-text-faint)]" />
                    </div>
                    <button type="button" onClick={() => setHideDone((value) => !value)} className={`rounded-[var(--ax-work-control-radius)] border px-3 text-[10px] font-semibold ${hideDone ? "border-[var(--ax-accent)] bg-[var(--ax-accent-soft)] text-[var(--ax-accent-strong)]" : "border-[var(--ax-work-line)] bg-[var(--ax-surface)] text-[var(--ax-text-soft)] hover:bg-[var(--ax-work-surface-muted)]"}`}>
                        Hide done
                    </button>
                </div>
            </div>

            <div className="border-b border-[var(--ax-work-line)] p-3">
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-text-faint)]">Active section</div>
                <input value={activeSection.title} onChange={(event) => onUpdateActiveSection({ title: event.target.value })} className={controlClass} placeholder="Section title" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <select value={activeSection.kind} onChange={(event) => onUpdateActiveSection({ kind: event.target.value as WriterProjectSection["kind"] })} className={controlClass}>
                        <option value="frontmatter">Frontmatter</option><option value="chapter">Chapter</option><option value="section">Section</option><option value="appendix">Appendix</option><option value="references">References</option>
                    </select>
                    <select value={activeSection.progress_state} onChange={(event) => onUpdateActiveSection({ progress_state: event.target.value as WriterProjectSection["progress_state"] })} className={controlClass}>
                        <option value="todo">Todo</option><option value="drafting">Drafting</option><option value="done">Done</option>
                    </select>
                </div>
            </div>

            <div className="max-h-[52vh] overflow-x-hidden overflow-y-auto">
                {visibleSections.map((section) => {
                    const index = sections.findIndex((entry) => getWriterSectionKey(entry) === getWriterSectionKey(section));
                    const sectionId = getWriterSectionKey(section);
                    const active = sectionId === activeSectionId;
                    return (
                        <div key={sectionId} className={`border-b px-3 py-3 last:border-b-0 ${getProgressTone(section.progress_state, active)}`}>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                                <button type="button" onClick={() => onSelectSection(sectionId)} className="flex min-w-0 items-center gap-2.5 text-left">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line)] bg-[var(--ax-surface)] text-[var(--ax-text-soft)]"><BookOpen className="h-3.5 w-3.5" /></div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${getProgressDotTone(section.progress_state, active)}`} /><div className="truncate text-xs font-semibold text-[var(--ax-text)]">{section.title}</div></div>
                                        <div className="mt-1 truncate text-[9px] uppercase tracking-[0.13em] text-[var(--ax-text-faint)]">{section.kind} · {section.progress_state} · {index + 1}</div>
                                    </div>
                                </button>
                                <div className="flex shrink-0 gap-1">
                                    <HoverHint label="Move up"><button type="button" onClick={() => onMoveSection(sectionId, "up")} disabled={index === 0} className="rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line)] p-1.5 text-[var(--ax-text-soft)] disabled:opacity-30" aria-label="Move up"><ChevronUp className="h-3.5 w-3.5" /></button></HoverHint>
                                    <HoverHint label="Move down"><button type="button" onClick={() => onMoveSection(sectionId, "down")} disabled={index === sections.length - 1} className="rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line)] p-1.5 text-[var(--ax-text-soft)] disabled:opacity-30" aria-label="Move down"><ChevronDown className="h-3.5 w-3.5" /></button></HoverHint>
                                    <HoverHint label="Remove section"><button type="button" onClick={() => onRemoveSection(sectionId)} disabled={sections.length === 1} className="rounded-[var(--ax-work-control-radius)] border border-[var(--ax-work-line)] p-1.5 text-[var(--ax-text-soft)] disabled:opacity-30" aria-label="Remove section"><Trash2 className="h-3.5 w-3.5" /></button></HoverHint>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!visibleSections.length ? <div className="px-4 py-8 text-center text-[11px] text-[var(--ax-text-soft)]">No sections match the current filters.</div> : null}
            </div>
        </div>
    );
}
