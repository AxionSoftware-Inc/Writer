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
    if (active) {
        return "border-foreground bg-foreground text-background";
    }

    if (progressState === "done") {
        return "border-emerald-500/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.02))]";
    }

    if (progressState === "drafting") {
        return "border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(255,255,255,0.02))]";
    }

    return "border-sky-500/20 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.02))]";
}

function getProgressDotTone(progressState: WriterProjectSection["progress_state"], active: boolean) {
    if (active) {
        return "bg-background/80";
    }

    if (progressState === "done") {
        return "bg-emerald-500";
    }

    if (progressState === "drafting") {
        return "bg-amber-500";
    }

    return "bg-sky-500";
}

function HoverHint({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="group relative">
            {children}
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-[11px] font-medium leading-5 text-foreground opacity-0 shadow-lg transition-all delay-700 duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                {label}
            </div>
        </div>
    );
}

function ActionIcon({
    icon: Icon,
    label,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}) {
    return (
        <HoverHint label={label}>
            <button
                type="button"
                onClick={onClick}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={label}
            >
                <Icon className="h-3.5 w-3.5" />
            </button>
        </HoverHint>
    );
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
        return sections.filter((section) => {
            if (hideDone && section.progress_state === "done") {
                return false;
            }
            if (kindFilter !== "all" && section.kind !== kindFilter) {
                return false;
            }
            if (!search.trim()) {
                return true;
            }
            const haystack = `${section.title} ${section.kind} ${section.progress_state}`.toLowerCase();
            return haystack.includes(search.trim().toLowerCase());
        });
    }, [hideDone, kindFilter, search, sections]);

    return (
        <div className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-background/85 p-3 shadow-sm">
            <div className="rounded-[1.2rem] border border-border/50 bg-muted/10 p-3">
                <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            <FolderTree className="h-3.5 w-3.5 text-teal-500" />
                            Files
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 font-bold uppercase tracking-[0.14em]">
                                {documentKind}
                            </span>
                            <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 font-bold uppercase tracking-[0.14em]">
                                {sections.length}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <ActionIcon icon={FilePlus2} label="Yangi file yaratish" onClick={onAddSection} />
                    <ActionIcon icon={Copy} label="Hozirgi file nusxasini yaratish" onClick={onDuplicateSection} />
                </div>
            </div>

            <div className="mt-3 rounded-[1.2rem] border border-border/50 bg-muted/10 p-3">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <Search className="h-3.5 w-3.5 text-accent" />
                    Navigation
                </div>
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="File qidirish..."
                            className="w-full rounded-2xl border border-border/60 bg-background px-9 py-2.5 text-sm font-medium outline-none transition-colors focus:border-accent/40"
                        />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <div className="relative">
                            <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <select
                                value={kindFilter}
                                onChange={(event) => setKindFilter(event.target.value as WriterProjectSection["kind"] | "all")}
                                className="w-full appearance-none rounded-2xl border border-border/60 bg-background px-9 py-2.5 text-sm font-medium outline-none transition-colors focus:border-accent/40"
                            >
                                <option value="all">All file kinds</option>
                                <option value="frontmatter">Frontmatter</option>
                                <option value="chapter">Chapter</option>
                                <option value="section">Section</option>
                                <option value="appendix">Appendix</option>
                                <option value="references">References</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <button
                            type="button"
                            onClick={() => setHideDone((value) => !value)}
                            className={`rounded-2xl border px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                                hideDone
                                    ? "border-accent/25 bg-[var(--accent-soft)] text-accent"
                                    : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Hide done
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-3 rounded-[1.2rem] border border-border/50 bg-muted/10 p-3">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Active file
                </div>
                <div className="space-y-2.5">
                    <input
                        value={activeSection.title}
                        onChange={(event) => onUpdateActiveSection({ title: event.target.value })}
                        className="w-full rounded-2xl border border-border/60 bg-background px-3.5 py-2 text-sm font-semibold outline-none transition-colors focus:border-accent/40"
                        placeholder="File nomi"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={activeSection.kind}
                            onChange={(event) => onUpdateActiveSection({ kind: event.target.value as WriterProjectSection["kind"] })}
                            className="min-w-0 rounded-2xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold outline-none transition-colors focus:border-accent/40"
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
                            className="min-w-0 rounded-2xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold outline-none transition-colors focus:border-accent/40"
                        >
                            <option value="todo">Todo</option>
                            <option value="drafting">Drafting</option>
                            <option value="done">Done</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="mt-3 max-h-[52vh] space-y-2 overflow-x-hidden overflow-y-auto pr-1">
                {visibleSections.map((section) => {
                    const index = sections.findIndex((entry) => getWriterSectionKey(entry) === getWriterSectionKey(section));
                    const sectionId = getWriterSectionKey(section);
                    const active = sectionId === activeSectionId;

                    return (
                        <div
                            key={sectionId}
                            className={`overflow-hidden rounded-2xl border px-3 py-2.5 transition ${getProgressTone(section.progress_state, active)}`}
                        >
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                                <button
                                    type="button"
                                    onClick={() => onSelectSection(sectionId)}
                                    className="flex min-w-0 items-center gap-2 text-left"
                                >
                                    <div
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                            active ? "bg-background/10" : "bg-background/70 text-foreground"
                                        }`}
                                    >
                                        <BookOpen className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getProgressDotTone(section.progress_state, active)}`} />
                                            <div className="truncate text-sm font-bold">{section.title}</div>
                                        </div>
                                        <div
                                            className={`mt-1 truncate text-[10px] uppercase tracking-[0.16em] ${
                                                active ? "text-background/70" : "text-muted-foreground"
                                            }`}
                                        >
                                            {section.kind} | {section.progress_state} | {index + 1}
                                        </div>
                                    </div>
                                </button>
                                <div className="grid shrink-0 grid-cols-3 gap-1">
                                    <HoverHint label="File'ni yuqoriga surish">
                                        <button
                                            type="button"
                                            onClick={() => onMoveSection(sectionId, "up")}
                                            disabled={index === 0}
                                            className={`rounded-lg border p-1.5 ${
                                                active ? "border-background/20 text-background" : "border-border/60 text-muted-foreground"
                                            } disabled:opacity-40`}
                                            aria-label="Move up"
                                        >
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        </button>
                                    </HoverHint>
                                    <HoverHint label="File'ni pastga surish">
                                        <button
                                            type="button"
                                            onClick={() => onMoveSection(sectionId, "down")}
                                            disabled={index === sections.length - 1}
                                            className={`rounded-lg border p-1.5 ${
                                                active ? "border-background/20 text-background" : "border-border/60 text-muted-foreground"
                                            } disabled:opacity-40`}
                                            aria-label="Move down"
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </button>
                                    </HoverHint>
                                    <HoverHint label="File'ni o'chirish">
                                        <button
                                            type="button"
                                            onClick={() => onRemoveSection(sectionId)}
                                            disabled={sections.length === 1}
                                            className={`rounded-lg border p-1.5 ${
                                                active ? "border-background/20 text-background" : "border-border/60 text-muted-foreground"
                                            } disabled:opacity-40`}
                                            aria-label="Remove file"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </HoverHint>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!visibleSections.length ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                        Hozirgi filter bo&apos;yicha file topilmadi.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
