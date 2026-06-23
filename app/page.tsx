"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    Plus,
    FileText,
    Pencil,
    Trash2,
    Calendar,
    Clock,
    BookOpen,
    Layers,
    Search,
    X,
    ScrollText,
} from "lucide-react";

import { WriteTypeSelector } from "@/components/write-type-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchPublic, isExpectedBackendOfflineError } from "@/lib/api";
import { deleteWriterPaper } from "@/lib/writer-api";

interface Paper {
    id: number;
    title: string;
    abstract: string;
    status: string;
    document_kind?: string;
    section_count?: number;
    created_at: string;
    updated_at: string;
}

const filterOptions: Array<{
    id: "all" | "published" | "draft";
    label: string;
    icon: typeof Layers;
    description: string;
}> = [
    { id: "all", label: "Barcha maqolalar", icon: Layers, description: "Arxivdagi barcha hujjatlar" },
    { id: "published", label: "Nashr etilgan", icon: BookOpen, description: "Final holatdagi materiallar" },
    { id: "draft", label: "Qoralamalar", icon: FileText, description: "Hali ishlanayotgan fayllar" },
];

export default function WriteIndexPage() {
    const [papers, setPapers] = useState<Paper[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isWriteSelectorOpen, setIsWriteSelectorOpen] = useState(false);

    const fetchPapers = useCallback(async () => {
        setIsLoading(true);
        setArchiveNotice(null);
        try {
            const query = new URLSearchParams();
            if (filterStatus !== "all") query.append("status", filterStatus);
            if (searchQuery.trim()) query.append("q", searchQuery.trim());

            const res = await fetchPublic(`/api/builder/papers/?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPapers(data);
            } else {
                setPapers([]);
                setArchiveNotice("Arxiv servisi hozir javob bermayapti. Yangi hujjat yaratish va lokal workspace ishlashda davom etadi.");
            }
        } catch (error) {
            setPapers([]);
            if (isExpectedBackendOfflineError(error)) {
                setArchiveNotice("Backend ulanmagan. Writer arxivi vaqtincha yuklanmadi, lekin yangi hujjat yaratish mumkin.");
            } else {
                console.error(error);
                setArchiveNotice("Arxivni yuklashda xatolik yuz berdi. Sahifa qayta urinib ko'rmoqda.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [filterStatus, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPapers();
        }, 400);
        return () => clearTimeout(timer);
    }, [fetchPapers]);

    const handleDelete = async (id: number) => {
        if (!confirm("Haqiqatan ham ushbu maqolani o'chirib tashlamoqchimisiz?")) return;

        try {
            await deleteWriterPaper(id);
            fetchPapers();
        } catch (e) {
            console.error("Xatolik", e);
        }
    };

    const publishedCount = papers.filter((paper) => paper.status === "published").length;
    const draftCount = papers.filter((paper) => paper.status === "draft").length;

    return (
        <div className="site-shell min-h-screen">
            <div className="border-b border-border/60 bg-background">
                <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background font-serif text-sm font-black shadow-md">
                            M
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                                MathSphere Writer
                            </div>
                            <div className="text-sm font-semibold md:text-base">Draft Archive & Editorial Workspace</div>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
                        <ThemeToggle />
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Maqola, abstract yoki tur bo&apos;yicha izlash..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-[48px] w-full rounded-full border border-border/70 bg-background px-11 pr-10 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                            />
                            {searchQuery ? (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    type="button"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            ) : null}
                        </div>
                        <button
                            onClick={() => setIsWriteSelectorOpen(true)}
                            className="site-button-primary h-[48px] shrink-0 cursor-pointer shadow-none"
                            type="button"
                        >
                            <Plus className="h-4 w-4" />
                            Create
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto flex w-full max-w-[1600px] gap-8 px-4 py-8 md:px-6">
                <aside className="hidden w-72 shrink-0 lg:block">
                    <div className="sticky top-[152px] space-y-5">
                        <div className="site-panel-strong p-5">
                            <div className="site-eyebrow">Workspace Control</div>
                            <div className="mt-4 space-y-2">
                                {filterOptions.map((item) => {
                                    const active = item.id === filterStatus;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setFilterStatus(item.id)}
                                            className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition-colors ${
                                                active
                                                    ? "border-[var(--accent)]/35 bg-[var(--accent-soft)]"
                                                    : "border-border/60 bg-background/70 hover:bg-background"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                                                    <item.icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold">{item.label}</div>
                                                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="site-panel p-5">
                            <div className="site-eyebrow">Archive Pulse</div>
                            <div className="mt-4 grid gap-3">
                                <div className="site-metric-card p-4">
                                    <div className="site-display text-3xl">{papers.length}</div>
                                    <div className="mt-2 text-sm font-semibold text-muted-foreground">Jami hujjatlar</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="site-outline-card p-4">
                                        <div className="text-sm font-bold">{draftCount}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Draft</div>
                                    </div>
                                    <div className="site-outline-card p-4">
                                        <div className="text-sm font-bold">{publishedCount}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Published</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    <div className="flex shrink-0 flex-wrap gap-2 lg:hidden">
                        {filterOptions.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setFilterStatus(item.id)}
                                className={`site-chip ${filterStatus === item.id ? "site-chip-active" : ""}`}
                                type="button"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-4">
                        <div>
                            <div className="site-eyebrow">Document Shelf</div>
                            <h2 className="mt-2 text-2xl font-black tracking-tight">
                                {filterStatus === "all" && "Hujjatlar arxivi"}
                                {filterStatus === "published" && "Nashr etilgan maqolalar"}
                                {filterStatus === "draft" && "Qoralamalar"}
                            </h2>
                        </div>
                        <div className="hidden rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm font-semibold text-muted-foreground sm:block">
                            {papers.length} ta hujjat
                        </div>
                    </div>

                    {archiveNotice ? (
                        <div className="mt-5 rounded-3xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-800 dark:text-amber-200">
                            {archiveNotice}
                        </div>
                    ) : null}

                    {isLoading ? (
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="site-panel h-[280px] animate-pulse" />
                            ))}
                        </div>
                    ) : papers.length === 0 ? (
                        <div className="mt-8 site-panel-strong flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
                            <div className="flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-[var(--accent-soft)] text-[var(--accent)]">
                                <ScrollText className="h-8 w-8" />
                            </div>
                            <h3 className="mt-6 font-serif text-4xl font-black">Hali ilmiy hujjatlar yo&apos;q</h3>
                            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                                Yangi loyiha boshlang. Writer endi template, metadata va preview bilan tartibli ishlab
                                beradigan premium workflow sifatida ishlaydi.
                            </p>
                            <button
                                onClick={() => setIsWriteSelectorOpen(true)}
                                className="site-button-primary mt-8 cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Yangi qoralama yaratish
                            </button>
                        </div>
                    ) : (
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {papers.map((paper) => (
                                <div
                                    key={paper.id}
                                    className="site-panel group relative flex h-full flex-col overflow-hidden p-5 transition-colors"
                                    style={{ contentVisibility: "auto", containIntrinsicSize: "280px" }}
                                >
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.04),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(15,118,110,0.05),transparent_22%)] opacity-0 transition-opacity group-hover:opacity-100" />
                                    <div className="relative flex flex-1 flex-col">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                                                        paper.status === "published"
                                                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                    }`}
                                                >
                                                    {paper.status === "draft" ? "Qoralama" : "Nashr qilingan"}
                                                </span>
                                                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                    {paper.document_kind || "paper"}
                                                </span>
                                            </div>

                                            <div className="relative z-20 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                                <button
                                                    onClick={() => handleDelete(paper.id)}
                                                    className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                    title="O'chirish"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <Link
                                                    href={`/${paper.id}`}
                                                    className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                    title="Tahrirlash"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        </div>

                                        <h3 className="mt-5 pr-6 text-xl font-black leading-snug tracking-tight text-foreground">
                                            {paper.title || "Nomsiz maqola"}
                                        </h3>
                                        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-7 text-muted-foreground">
                                            {paper.abstract || "Annotatsiya kiritilmagan yoki hali shakllanmoqda."}
                                        </p>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                                {paper.section_count || 1} sections
                                            </span>
                                        </div>

                                        <div className="mt-6 border-t border-border/60 pt-4 text-xs font-medium text-muted-foreground">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {new Date(paper.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {new Date(paper.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Link href={`/${paper.id}`} className="absolute inset-0 z-10" />
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            <WriteTypeSelector isOpen={isWriteSelectorOpen} onClose={() => setIsWriteSelectorOpen(false)} />
        </div>
    );
}
