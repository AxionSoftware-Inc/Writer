"use client";

import { useRef, useState } from "react";
import {
    AlertTriangle,
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
    DOI?: string;
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
    const doiSuffix = item.DOI?.replace(/[^A-Za-z0-9]+/g, "").slice(-4) || "";
    return `${authorKey}${year || ""}${doiSuffix}`;
}

function getQuality(item: CitationResult) {
    const warnings: string[] = [];
    if (!item.author?.length) warnings.push("muallif yo‘q");
    if (!getVenue(item)) warnings.push("jurnal/nashr yo‘q");
    if (!getYear(item)) warnings.push("yil yo‘q");
    if (!item.DOI && !item.URL) warnings.push("DOI/URL yo‘q");
    if (item.type && !["journal-article", "proceedings-article", "book-chapter", "book"].includes(item.type)) {
        warnings.push(`type: ${item.type}`);
    }

    if (warnings.length === 0) return { label: "Strong", tone: "text-emerald-700 bg-emerald-500/10", warnings };
    if (warnings.length <= 2) return { label: "Review", tone: "text-amber-700 bg-amber-500/10", warnings };
    return { label: "Weak", tone: "text-rose-700 bg-rose-500/10", warnings };
}

function getResourceUrl(item: CitationResult) {
    if (item.DOI) return `https://doi.org/${encodeURIComponent(item.DOI)}`;
    return item.URL || "";
}

function getBibType(item: CitationResult) {
    if (item.type === "book") return "book";
    if (item.type === "book-chapter") return "incollection";
    if (item.type === "proceedings-article") return "inproceedings";
    return "article";
}

function escapeBibValue(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

export function CitationManager({ onInsert }: { onInsert: (citation: string, inlineRef: string) => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CitationResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [format, setFormat] = useState<CitationFormat>("APA");
    const [insertMode, setInsertMode] = useState<InsertMode>("reference");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [rows, setRows] = useState<10 | 20 | 30>(10);
    const requestRef = useRef<AbortController | null>(null);

    const formatCitation = (item: CitationResult) => {
        const title = getTitle(item);
        const journal = getVenue(item);
        const year = getYear(item) || "n.d.";
        const resourceUrl = getResourceUrl(item);

        let authors = "Noma’lum muallif";
        if (item.author?.length) {
            const mapped = item.author.map((author) => `${author.family || ""} ${author.given ? `${author.given[0]}.` : ""}`.trim());
            if (format === "IEEE") {
                authors = item.author.length > 3
                    ? `${item.author[0].given ? `${item.author[0].given[0]}. ` : ""}${item.author[0].family || ""}, et al.`
                    : item.author.map((author) => `${author.given ? `${author.given[0]}. ` : ""}${author.family || ""}`.trim()).join(", ");
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

        const source = journal ? `*${journal}*` : "";
        const linkText = resourceUrl ? ` ${resourceUrl}` : "";

        if (format === "IEEE") return `${authors}, "${title}," ${source}, ${year}.${resourceUrl ? ` [Online]. Available:${linkText}` : ""}`;
        if (format === "Harvard") return `${authors} (${year}) '${title}', ${source}.${item.DOI ? ` doi: ${item.DOI}.` : linkText}`;
        if (format === "Chicago") return `${authors}. "${title}." ${source} (${year}).${linkText}`;
        return `${authors} (${year}). ${title}. ${source}.${linkText}`;
    };

    const getBibTeX = (item: CitationResult) => {
        const authors = item.author?.map((author) => `${author.family || ""}, ${author.given || ""}`.trim()).join(" and ") || "Unknown";
        const fields = [
            `  title={${escapeBibValue(getTitle(item))}}`,
            `  author={${escapeBibValue(authors)}}`,
            getVenue(item) ? `  ${item.type === "book" ? "publisher" : "journal"}={${escapeBibValue(getVenue(item))}}` : "",
            getYear(item) ? `  year={${getYear(item)}}` : "",
            item.DOI ? `  doi={${escapeBibValue(item.DOI)}}` : "",
            !item.DOI && item.URL ? `  url={${escapeBibValue(item.URL)}}` : "",
        ].filter(Boolean);

        return `@${getBibType(item)}{${getInlineRef(item)},\n${fields.join(",\n")}\n}`;
    };

    const searchCitations = async (event: React.FormEvent) => {
        event.preventDefault();
        const normalizedQuery = query.trim();
        if (!normalizedQuery) return;

        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;

        setIsLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({
                query: normalizedQuery,
                select: "author,title,container-title,issued,DOI,URL,type,is-referenced-by-count,publisher",
                rows: String(rows),
            });
            const response = await fetch(`https://api.crossref.org/works?${params.toString()}`, { signal: controller.signal });
            if (!response.ok) throw new Error("Crossref qidiruv xizmatida xatolik yuz berdi");

            const data = (await response.json()) as { message?: { items?: CitationResult[] } };
            if (requestRef.current !== controller) return;
            setResults(Array.isArray(data.message?.items) ? data.message?.items || [] : []);
        } catch (caughtError: unknown) {
            if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
            setError(caughtError instanceof Error ? caughtError.message : "Qidiruvda xatolik yuz berdi");
        } finally {
            if (requestRef.current === controller) {
                requestRef.current = null;
                setIsLoading(false);
            }
        }
    };

    const copyBibtex = async (item: CitationResult) => {
        const key = getInlineRef(item);
        try {
            await navigator.clipboard.writeText(getBibTeX(item));
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
        } catch {
            setError("Clipboardga nusxalash amalga oshmadi.");
        }
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
        <section className="rounded-xl border border-border/60 bg-background">
            <div className="flex flex-col gap-3 border-b border-border/50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-black tracking-tight">
                            <Quote className="h-4 w-4 text-muted-foreground" />
                            Citations
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Crossref’dan manba toping va tekshirib hujjatga kiriting.</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                        <SelectShell>
                            <select value={format} onChange={(event) => setFormat(event.target.value as CitationFormat)} className="h-8 appearance-none rounded-lg border border-border/60 bg-background py-1 pl-2.5 pr-7 text-[10px] font-bold outline-none">
                                <option value="APA">APA</option>
                                <option value="IEEE">IEEE</option>
                                <option value="Harvard">Harvard</option>
                                <option value="Chicago">Chicago</option>
                            </select>
                        </SelectShell>
                        <SelectShell>
                            <select value={insertMode} onChange={(event) => setInsertMode(event.target.value as InsertMode)} className="h-8 appearance-none rounded-lg border border-border/60 bg-background py-1 pl-2.5 pr-7 text-[10px] font-bold outline-none">
                                <option value="reference">Reference</option>
                                <option value="bibtex">BibTeX</option>
                            </select>
                        </SelectShell>
                    </div>
                </div>

                <form onSubmit={searchCitations} className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Paper title, DOI yoki muallif…"
                            className="h-9 w-full rounded-lg border border-border/60 bg-muted/5 pl-9 pr-3 text-xs outline-none focus:border-foreground/20"
                        />
                    </div>
                    <SelectShell>
                        <select value={rows} onChange={(event) => setRows(Number(event.target.value) as 10 | 20 | 30)} className="h-9 appearance-none rounded-lg border border-border/60 bg-background py-1 pl-2.5 pr-7 text-[10px] font-bold outline-none">
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                        </select>
                    </SelectShell>
                    <button type="submit" disabled={isLoading || !query.trim()} className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-40" aria-label="Citation qidirish">
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    </button>
                </form>
            </div>

            {error ? <div className="border-b border-border/50 px-3.5 py-2.5 text-[11px] font-semibold text-destructive">{error}</div> : null}

            <div className="max-h-[480px] space-y-1 overflow-y-auto p-2 scrollbar-thin">
                {results.map((item, index) => {
                    const inlineRef = getInlineRef(item);
                    const quality = getQuality(item);
                    const resourceUrl = getResourceUrl(item);
                    const resultKey = item.DOI || item.URL || `${inlineRef}-${index}`;

                    return (
                        <article key={resultKey} className="rounded-lg border border-transparent p-2.5 transition-colors hover:border-border/60 hover:bg-muted/15">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="line-clamp-2 text-xs font-bold leading-5">{getTitle(item)}</div>
                                    <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                                        {[item.author?.map((author) => author.family || "").filter(Boolean).join(", "), getYear(item), getVenue(item)]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </div>
                                </div>
                                <span className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${quality.tone}`}>{quality.label}</span>
                            </div>

                            {quality.warnings.length ? (
                                <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                    {quality.warnings.join(", ")}
                                </div>
                            ) : null}

                            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        <FileText className="h-3 w-3" />[{inlineRef}]
                                    </span>
                                    {resourceUrl ? (
                                        <a href={resourceUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Manbani ochish">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    ) : null}
                                    <button type="button" onClick={() => void copyBibtex(item)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="BibTeX nusxalash">
                                        {copiedKey === inlineRef ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                                <button type="button" onClick={() => handleInsert(item)} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-background">
                                    <PlusCircle className="h-3 w-3" />
                                    Insert
                                </button>
                            </div>
                        </article>
                    );
                })}

                {!results.length && !isLoading && !error ? (
                    <div className="px-3 py-5 text-center text-[11px] leading-5 text-muted-foreground">
                        To‘liq sarlavha yoki DOI bilan qidirsangiz aniqroq metadata chiqadi.
                    </div>
                ) : null}
            </div>
        </section>
    );
}

function SelectShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative">
            {children}
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        </div>
    );
}
