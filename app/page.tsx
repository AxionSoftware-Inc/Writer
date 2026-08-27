"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    BookOpen,
    Calendar,
    Clock,
    FileText,
    Layers,
    Plus,
    Search,
    ScrollText,
    Trash2,
    X,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { WriteTypeSelector } from "@/components/write-type-selector";
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

type ArchiveFilter = "all" | "published" | "draft";

const filterOptions: Array<{
    id: ArchiveFilter;
    label: string;
    icon: typeof Layers;
}> = [
    { id: "all", label: "Barchasi", icon: Layers },
    { id: "draft", label: "Qoralama", icon: FileText },
    { id: "published", label: "Nashr qilingan", icon: BookOpen },
];

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function WriteIndexPage() {
    const [papers, setPapers] = useState<Paper[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<ArchiveFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isWriteSelectorOpen, setIsWriteSelectorOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const fetchPapers = useCallback(async () => {
        setIsLoading(true);
        setArchiveNotice(null);

        try {
            const query = new URLSearchParams();
            if (filterStatus !== "all") query.append("status", filterStatus);
            if (searchQuery.trim()) query.append("q", searchQuery.trim());

            const response = await fetchPublic(`/api/builder/papers/?${query.toString()}`);
            if (!response.ok) {
                setPapers([]);
                setArchiveNotice(
                    "Arxiv servisi hozir javob bermayapti. Yangi hujjat yaratish va lokal workspace ishlashda davom etadi.",
                );
                return;
            }

            const data = await response.json();
            setPapers(Array.isArray(data) ? data : []);
        } catch (error) {
            setPapers([]);
            if (isExpectedBackendOfflineError(error)) {
                setArchiveNotice(
                    "Backend ulanmagan. Writer arxivi vaqtincha yuklanmadi, lekin yangi hujjat yaratish mumkin.",
                );
            } else {
                console.error(error);
                setArchiveNotice("Arxivni yuklashda xatolik yuz berdi. Qidiruv yoki filtrni o‘zgartirib qayta urinib ko‘ring.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [filterStatus, searchQuery]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchPapers();
        }, searchQuery.trim() ? 320 : 0);

        return () => window.clearTimeout(timer);
    }, [fetchPapers, searchQuery]);

    const handleDelete = async (paper: Paper) => {
        if (deletingId !== null) return;
        if (!window.confirm(`“${paper.title || "Nomsiz hujjat"}” o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.`)) return;

        setDeletingId(paper.id);
        try {
            await deleteWriterPaper(paper.id);
            setPapers((current) => current.filter((item) => item.id !== paper.id));
        } catch (error) {
            console.error("Writer document delete failed", error);
            setArchiveNotice("Hujjatni o‘chirish amalga oshmadi. Server bilan aloqa tiklangach qayta urinib ko‘ring.");
        } finally {
            setDeletingId(null);
        }
    };

    const archiveTitle =
        filterStatus === "published" ? "Nashr qilingan hujjatlar" : filterStatus === "draft" ? "Qoralamalar" : "Hujjatlar";

    return (
        <div className="site-shell min-h-screen">
            <header className="border-b border-border/60 bg-background/95">
                <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-3 px-4 py-3 md:px-6 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 items-center gap-3 lg:w-[300px]">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground font-serif text-sm font-black text-background">
                            M
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-black tracking-tight">MathSphere Writer</div>
                            <div className="truncate text-[11px] text-muted-foreground">Scientific document workspace</div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="Hujjatlarni qidirish…"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="h-10 w-full rounded-xl border border-border/60 bg-muted/10 pl-9 pr-9 text-sm outline-none transition-colors focus:border-foreground/20 focus:bg-background"
                                aria-label="Hujjatlarni qidirish"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label="Qidiruvni tozalash"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                        </div>
                        <ThemeToggle />
                        <button
                            type="button"
                            onClick={() => setIsWriteSelectorOpen(true)}
                            className="site-button-primary h-10 shrink-0 !gap-2 !px-3.5 shadow-none"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Yangi hujjat</span>
                            <span className="sm:hidden">Yangi</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[1380px] px-4 py-6 md:px-6 md:py-8">
                <div className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Library</div>
                        <h1 className="mt-1.5 text-2xl font-black tracking-tight md:text-3xl">{archiveTitle}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {isLoading ? "Arxiv yangilanmoqda…" : `${papers.length} ta natija`}
                        </p>
                    </div>

                    <div className="inline-flex w-fit items-center rounded-xl border border-border/60 bg-background p-1">
                        {filterOptions.map((item) => {
                            const Icon = item.icon;
                            const active = filterStatus === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setFilterStatus(item.id)}
                                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-colors ${
                                        active
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {archiveNotice ? (
                    <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
                        {archiveNotice}
                    </div>
                ) : null}

                {isLoading ? (
                    <div className="mt-5 overflow-hidden rounded-xl border border-border/60 bg-background">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="flex min-h-28 animate-pulse gap-4 border-b border-border/50 p-4 last:border-b-0">
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
                                <div className="flex-1 space-y-3 py-1">
                                    <div className="h-4 w-1/3 rounded bg-muted" />
                                    <div className="h-3 w-2/3 rounded bg-muted/70" />
                                    <div className="h-3 w-1/2 rounded bg-muted/60" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : papers.length === 0 ? (
                    <div className="mt-8 flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/70 px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-muted-foreground">
                            <ScrollText className="h-5 w-5" />
                        </div>
                        <h2 className="mt-5 text-xl font-black tracking-tight">
                            {searchQuery ? "Mos hujjat topilmadi" : "Hali hujjatlar yo‘q"}
                        </h2>
                        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                            {searchQuery
                                ? "Qidiruv so‘zini o‘zgartiring yoki boshqa filtrni tanlang."
                                : "Template tanlab yangi ilmiy hujjat, hisobot, maqola yoki kitob qoralamasini boshlang."}
                        </p>
                        {!searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setIsWriteSelectorOpen(true)}
                                className="site-button-primary mt-5 !gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Yangi hujjat
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="mt-5 overflow-hidden rounded-xl border border-border/60 bg-background">
                        {papers.map((paper) => (
                            <article
                                key={paper.id}
                                className="group grid min-h-[118px] grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/50 p-4 transition-colors last:border-b-0 hover:bg-muted/15 md:p-5"
                                style={{ contentVisibility: "auto", containIntrinsicSize: "118px" }}
                            >
                                <Link href={`/${paper.id}`} className="min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-foreground/20">
                                    <div className="flex min-w-0 gap-3.5">
                                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/15 text-muted-foreground">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="min-w-0 truncate text-sm font-black tracking-tight md:text-base">
                                                    {paper.title || "Nomsiz hujjat"}
                                                </h2>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                                                        paper.status === "published"
                                                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                    }`}
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    {paper.status === "published" ? "Published" : "Draft"}
                                                </span>
                                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                    {paper.document_kind || "paper"}
                                                </span>
                                            </div>

                                            <p className="mt-2 line-clamp-2 max-w-4xl text-xs leading-5 text-muted-foreground md:text-sm md:leading-6">
                                                {paper.abstract || "Annotatsiya hali kiritilmagan."}
                                            </p>

                                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium text-muted-foreground md:text-[11px]">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(paper.updated_at || paper.created_at)}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(paper.updated_at || paper.created_at)}
                                                </span>
                                                <span>{paper.section_count || 1} section</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                <div className="flex items-start">
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(paper)}
                                        disabled={deletingId !== null}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-colors hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                                        title="Hujjatni o‘chirish"
                                        aria-label={`${paper.title || "Hujjat"}ni o‘chirish`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>

            <WriteTypeSelector isOpen={isWriteSelectorOpen} onClose={() => setIsWriteSelectorOpen(false)} />
        </div>
    );
}
