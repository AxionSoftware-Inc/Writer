"use client";

import { useMemo, useState } from "react";
import {
    AlertTriangle,
    BookMarked,
    CheckCircle2,
    ChevronDown,
    Copy,
    ExternalLink,
    FileText,
    Loader2,
    PlusCircle,
    Quote,
    Search,
} from "lucide-react";

type CitationFormat = "APA" | "IEEE" | "Harvard" | "Chicago";
type InsertMode = "reference" | "bibtex";

export type CitationResult = {
    DOI: string;
    URL?: string;
    type?: string;
    title?: string[];
    author?: { given?: string; family?: string }[];
    "container-title"?: string[];
    issued?: { "date-parts"?: number[][] };
    "is-referenced-by-count"?: number;
    publisher?: string;
};

function getYear(item: CitationResult) {
    return item.issued?.["date-parts"]?.[0]?.[0] || "";
}

function getTitle(item: CitationResult) {
    return item.title?.[0] || "Nomsiz maqola";
}

function getVenue(item: CitationResult) {
    return item["container-title"]?.[0] || item.publisher || "";
}

function getInlineRef(item: CitationResult) {
    const authorKey = item.author?.[0]?.family?.replace(/[^A-Za-z0-9]+/g, "") || "Ref";
    const year = getYear(item);
    return `${authorKey}${year || ""}`;
}

function getQuality(item: CitationResult) {
    const warnings: string[] = [];
    if (!item.author?.length) warnings.push("muallif yo'q");
    if (!getVenue(item)) warnings.push("jurnal/nashr yo'q");
    if (!getYear(item)) warnings.push("yil yo'q");
    if (!item.DOI) warnings.push("DOI yo'q");
    if (item.type && !["journal-article", "proceedings-article", "book-chapter", "book"].includes(item.type)) {
        warnings.push(`type: ${item.type}`);
    }

    if (warnings.length === 0) {
        return { label: "Strong metadata", tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/25", warnings };
    }
    if (warnings.length <= 2) {
        return { label: "Review metadata", tone: "text-amber-700 bg-amber-500/10 border-amber-500/25", warnings };
    }
    return { label: "Weak metadata", tone: "text-rose-700 bg-rose-500/10 border-rose-500/25", warnings };
}

export function CitationManager({ onInsert }: { onInsert: (citation: string, inlineRef: string) => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CitationResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [format, setFormat] = useState<CitationFormat>("APA");
    const [insertMode, setInsertMode] = useState<InsertMode>("reference");
    const [copiedDOI, setCopiedDOI] = useState<string | null>(null);
    const [rows, setRows] = useState<10 | 20 | 30>(10);

    const searchUrl = useMemo(() => {
        const params = new URLSearchParams({
            query,
            select: "author,title,container-title,issued,DOI,URL,type,is-referenced-by-count,publisher",
            rows: String(rows),
        });
        return `https://api.crossref.org/works?${params.toString()}`;
    }, [query, rows]);

    const searchCitations = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch(searchUrl);
            if (!response.ok) throw new Error("Qidiruv xizmatida xatolik yuz berdi");
            const data = (await response.json()) as { message?: { items?: CitationResult[] } };
            setResults(data.message?.items || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
        } finally {
            setIsLoading(false);
        }
    };

    const formatCitation = (item: CitationResult) => {
        const title = getTitle(item);
        const journal = getVenue(item);
        const year = getYear(item) || "n.d.";

        let authors = "Noma'lum muallif";
        if (item.author?.length) {
            const mapped = item.author.map((author) => `${author.family || ""} ${author.given ? `${author.given[0]}.` : ""}`.trim());
            if (format === "IEEE") {
                authors = item.author.length > 3
                    ? `${item.author[0].given ? `${item.author[0].given[0]}. ` : ""}${item.author[0].family}, et al.`
                    : item.author.map((author) => `${author.given ? `${author.given[0]}. ` : ""}${author.family}`).join(", ");
            } else if (format === "APA") {
                authors = mapped.length > 20
                    ? `${mapped.slice(0, 19).join(", ")}, ... ${mapped[mapped.length - 1]}`
                    : mapped.length > 1
                      ? `${mapped.slice(0, -1).join(", ")} & ${mapped[mapped.length - 1]}`
                      : mapped[0];
            } else {
                authors = mapped.length > 3 ? `${mapped[0]} et al.` : mapped.join(", ");
            }
        }

        if (format === "IEEE") {
            return `${authors}, "${title}," ${journal ? `*${journal}*` : ""}, ${year}. [Online]. Available: https://doi.org/${item.DOI}`;
        }
        if (format === "Harvard") {
            return `${authors} (${year}) '${title}', ${journal ? `*${journal}*` : ""}. doi: ${item.DOI}.`;
        }
        if (format === "Chicago") {
            return `${authors}. "${title}." ${journal ? `*${journal}*` : ""} (${year}). https://doi.org/${item.DOI}.`;
        }
        return `${authors} (${year}). ${title}. ${journal ? `*${journal}*` : ""}. https://doi.org/${item.DOI}`;
    };

    const getBibTeX = (item: CitationResult) => {
        const authors = item.author?.map((author) => `${author.family || ""}, ${author.given || ""}`.trim()).join(" and ") || "Unknown";
        return `@article{${getInlineRef(item)},
  title={${getTitle(item)}},
  author={${authors}},
  journal={${getVenue(item)}},
  year={${getYear(item)}},
  doi={${item.DOI}}
}`;
    };

    const copyBibtex = (item: CitationResult) => {
        navigator.clipboard.writeText(getBibTeX(item));
        setCopiedDOI(item.DOI);
        setTimeout(() => setCopiedDOI(null), 2000);
    };

    const handleInsert = (item: CitationResult) => {
        const inlineRef = getInlineRef(item);
        if (insertMode === "bibtex") {
            onInsert(`\n\`\`\`bibtex\n${getBibTeX(item)}\n\`\`\``, inlineRef);
            return;
        }
        onInsert(formatCitation(item), inlineRef);
    };

    return (
        <div className="rounded-[2rem] border border-border/60 bg-background/80 p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Crossref Global DB</div>
                    <div className="mt-1 flex items-center gap-2 text-xl font-black text-indigo-500">
                        <Quote className="h-5 w-5" />
                        Iqtiboslar
                    </div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground">
                        Professional workflow: manba sifatini tekshiring, formatni tanlang, keyin reference yoki BibTeX sifatida kiriting.
                    </div>
                </div>
                <div className="grid shrink-0 gap-2">
                    <SelectShell>
                        <select value={format} onChange={(event) => setFormat(event.target.value as CitationFormat)} className="appearance-none rounded-xl border border-border/60 bg-muted/20 py-1.5 pl-3 pr-8 text-xs font-bold uppercase tracking-wider text-foreground outline-none transition-colors focus:border-indigo-500/40">
                            <option value="APA">APA</option>
                            <option value="IEEE">IEEE</option>
                            <option value="Harvard">Harvard</option>
                            <option value="Chicago">Chicago</option>
                        </select>
                    </SelectShell>
                    <SelectShell>
                        <select value={insertMode} onChange={(event) => setInsertMode(event.target.value as InsertMode)} className="appearance-none rounded-xl border border-border/60 bg-muted/20 py-1.5 pl-3 pr-8 text-xs font-bold uppercase tracking-wider text-foreground outline-none transition-colors focus:border-indigo-500/40">
                            <option value="reference">Reference</option>
                            <option value="bibtex">BibTeX</option>
                        </select>
                    </SelectShell>
                </div>
            </div>

            <form onSubmit={searchCitations} className="relative mb-3">
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Muallif, paper title yoki DOI yozing..."
                    className="w-full rounded-2xl border border-border/60 bg-muted/10 py-3 pl-4 pr-12 text-sm outline-none transition-colors focus:border-indigo-500/40"
                />
                <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
            </form>

            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-xs leading-5 text-muted-foreground">
                    Reference mode cursor joyiga <code>[KeyYear]</code>, adabiyotlarga esa formatted citation qo&apos;shadi.
                </div>
                <SelectShell>
                    <select value={rows} onChange={(event) => setRows(Number(event.target.value) as 10 | 20 | 30)} className="appearance-none rounded-xl border border-border/60 bg-muted/20 py-1.5 pl-3 pr-8 text-xs font-bold uppercase tracking-wider text-foreground outline-none transition-colors focus:border-indigo-500/40">
                        <option value={10}>Top 10</option>
                        <option value={20}>Top 20</option>
                        <option value={30}>Top 30</option>
                    </select>
                </SelectShell>
            </div>

            {error ? <div className="mb-4 text-xs font-semibold text-destructive">{error}</div> : null}

            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    <BookMarked className="h-3.5 w-3.5" />
                    {results.length} natija
                </div>
                <div className="text-[11px] font-semibold text-muted-foreground">Metadata sifati past natijalarni tekshirib qo&apos;shing</div>
            </div>

            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {results.map((item) => {
                    const inlineRef = getInlineRef(item);
                    const quality = getQuality(item);
                    const formattedCitation = formatCitation(item);
                    const bibtex = getBibTeX(item);

                    return (
                        <div key={item.DOI} className="rounded-2xl border border-border/60 bg-muted/10 p-3 transition-colors hover:border-indigo-500/30">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="line-clamp-2 text-xs font-bold leading-snug" title={getTitle(item)}>
                                        {getTitle(item)}
                                    </div>
                                    <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                                        {[item.author?.map((author) => author.family || "").filter(Boolean).join(", "), getYear(item), getVenue(item)]
                                            .filter(Boolean)
                                            .join(" | ")}
                                    </div>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${quality.tone}`}>
                                    {quality.label}
                                </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {item.type ? <MetaBadge>{item.type}</MetaBadge> : null}
                                {item["is-referenced-by-count"] ? <MetaBadge>Cited by {item["is-referenced-by-count"]}</MetaBadge> : null}
                                {item.publisher ? <MetaBadge>{item.publisher}</MetaBadge> : null}
                            </div>

                            {quality.warnings.length ? (
                                <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>Tekshiring: {quality.warnings.join(", ")}.</span>
                                </div>
                            ) : null}

                            <div className="mt-3 rounded-xl border border-border/50 bg-background/75 p-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5" />
                                    Paperga kiritiladi
                                </div>
                                {insertMode === "reference" ? (
                                    <div className="mt-2 space-y-2 text-[11px] leading-5">
                                        <div>
                                            <span className="font-bold text-foreground">Matn ichiga:</span>{" "}
                                            <code className="rounded-md bg-muted px-1.5 py-0.5">[{inlineRef}]</code>
                                        </div>
                                        <div>
                                            <span className="font-bold text-foreground">Adabiyotlarga:</span>
                                            <div className="mt-1 line-clamp-3 text-muted-foreground">- [{inlineRef}] {formattedCitation}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <pre className="mt-2 max-h-28 overflow-auto rounded-xl bg-muted/60 p-2 text-[10px] leading-5 text-muted-foreground">
                                        {bibtex}
                                    </pre>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                                <div className="flex items-center gap-3">
                                    <a
                                        href={`https://doi.org/${item.DOI}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-indigo-500"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        DOI
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => copyBibtex(item)}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-indigo-500"
                                    >
                                        {copiedDOI === item.DOI ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                        Copy BibTeX
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleInsert(item)}
                                    className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 transition-colors hover:bg-indigo-500/20 active:scale-95 dark:text-indigo-400"
                                >
                                    <PlusCircle className="h-3.5 w-3.5" />
                                    {insertMode === "reference" ? "Insert reference" : "Insert BibTeX"}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {results.length === 0 && !isLoading && !error ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-center text-sm text-muted-foreground">
                        Crossref’dan maqola qidiring. Eng yaxshi natija uchun to‘liq sarlavha, DOI yoki muallif familiyasini yozing.
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function SelectShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative">
            {children}
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
    );
}

function MetaBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="max-w-[180px] truncate rounded-md bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {children}
        </span>
    );
}
