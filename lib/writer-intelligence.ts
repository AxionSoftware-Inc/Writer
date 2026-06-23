import type { WriterProjectSection } from "@/lib/writer-project";

type WriterReferenceEntry = {
    key: string;
    line: number;
    text: string;
};

type WriterSymbolIssue = {
    symbol: string;
    count: number;
};

type WriterDuplicateHeading = {
    title: string;
    count: number;
};

export type WriterIntelligenceReport = {
    inlineCitationKeys: string[];
    bibliographyKeys: string[];
    missingBibliographyKeys: string[];
    unusedBibliographyKeys: string[];
    duplicateHeadingTitles: WriterDuplicateHeading[];
    undefinedSymbolCandidates: WriterSymbolIssue[];
    sectionStats: Array<{
        id: string;
        title: string;
        words: number;
        equations: number;
        references: number;
    }>;
    preflight: {
        score: number;
        status: "ready" | "review" | "blocked";
        blockers: string[];
        warnings: string[];
        strengths: string[];
    };
};

const INLINE_CITATION_REGEX = /\[([A-Za-z][A-Za-z0-9_-]{1,40})\]/g;
const BIBLIOGRAPHY_ENTRY_REGEX = /^\s*[-*]\s+\[([A-Za-z][A-Za-z0-9_-]{1,40})\]\s+/gm;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;
const INLINE_MATH_SYMBOL_REGEX = /(?<![A-Za-z])([A-Za-z](?:_[A-Za-z0-9]+)?)(?![A-Za-z])/g;
const DEFINED_SYMBOL_REGEX = /\b(let|where|for|given|define|denote|set)\s+([A-Za-z](?:_[A-Za-z0-9]+)?)/gi;

function unique<T>(items: T[]) {
    return Array.from(new Set(items));
}

function countWords(text: string) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

function countEquations(text: string) {
    return (text.match(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g) || []).length;
}

function extractInlineCitationKeys(content: string) {
    const contentWithoutBibliographyEntries = content.replace(BIBLIOGRAPHY_ENTRY_REGEX, "");
    const keys: string[] = [];
    for (const match of contentWithoutBibliographyEntries.matchAll(INLINE_CITATION_REGEX)) {
        keys.push(match[1]);
    }
    return keys;
}

function extractBibliographyEntries(content: string): WriterReferenceEntry[] {
    const entries: WriterReferenceEntry[] = [];
    for (const match of content.matchAll(BIBLIOGRAPHY_ENTRY_REGEX)) {
        const prefix = content.slice(0, match.index ?? 0);
        entries.push({
            key: match[1],
            line: prefix.split(/\r?\n/).length,
            text: match[0].trim(),
        });
    }
    return entries;
}

function extractDuplicateHeadings(content: string) {
    const counts = new Map<string, number>();
    for (const match of content.matchAll(HEADING_REGEX)) {
        const title = match[2].trim();
        counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([title, count]) => ({ title, count }))
        .sort((left, right) => right.count - left.count);
}

function extractUndefinedSymbolCandidates(content: string) {
    const defined = new Set<string>();
    for (const match of content.matchAll(DEFINED_SYMBOL_REGEX)) {
        defined.add(match[2]);
    }

    const candidateCounts = new Map<string, number>();
    for (const mathBlock of content.match(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g) || []) {
        for (const match of mathBlock.matchAll(INLINE_MATH_SYMBOL_REGEX)) {
            const symbol = match[1];
            if (["x", "y", "z", "n", "m", "i", "j", "k", "t"].includes(symbol)) {
                continue;
            }
            if (defined.has(symbol)) {
                continue;
            }
            candidateCounts.set(symbol, (candidateCounts.get(symbol) ?? 0) + 1);
        }
    }

    return Array.from(candidateCounts.entries())
        .filter(([, count]) => count >= 2)
        .map(([symbol, count]) => ({ symbol, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8);
}

export function analyzeWriterDocument(content: string, sections: WriterProjectSection[]): WriterIntelligenceReport {
    const inlineCitationKeys = unique(extractInlineCitationKeys(content));
    const bibliographyEntries = extractBibliographyEntries(content);
    const bibliographyKeys = unique(bibliographyEntries.map((entry) => entry.key));
    const missingBibliographyKeys = inlineCitationKeys.filter((key) => !bibliographyKeys.includes(key));
    const unusedBibliographyKeys = bibliographyKeys.filter((key) => !inlineCitationKeys.includes(key));
    const duplicateHeadingTitles = extractDuplicateHeadings(content);
    const undefinedSymbolCandidates = extractUndefinedSymbolCandidates(content);

    const sectionStats = sections.map((section) => ({
        id: String(section.id ?? section.slug),
        title: section.title,
        words: countWords(section.content),
        equations: countEquations(section.content),
        references: extractInlineCitationKeys(section.content).length,
    }));

    const blockers: string[] = [];
    const warnings: string[] = [];
    const strengths: string[] = [];

    if (!content.trim()) {
        blockers.push("Document body is empty.");
    }
    if (missingBibliographyKeys.length) {
        blockers.push(`Missing bibliography entries for ${missingBibliographyKeys.length} in-text citation(s).`);
    }
    if (!/##\s+Ishlatilgan adabiyotlar|##\s+References/i.test(content)) {
        warnings.push("Reference section is missing.");
    } else {
        strengths.push("Reference section is present.");
    }
    if (duplicateHeadingTitles.length) {
        warnings.push(`${duplicateHeadingTitles.length} duplicate heading label(s) detected.`);
    } else {
        strengths.push("Heading structure is unique.");
    }
    if (undefinedSymbolCandidates.length) {
        warnings.push(`${undefinedSymbolCandidates.length} symbol definition candidate(s) need review.`);
    } else {
        strengths.push("No repeated undefined symbol candidates were detected.");
    }
    if (unusedBibliographyKeys.length) {
        warnings.push(`${unusedBibliographyKeys.length} bibliography entry is not referenced in the text.`);
    }
    if (sectionStats.filter((section) => section.words >= 180).length >= Math.max(1, Math.ceil(sectionStats.length / 3))) {
        strengths.push("Document has substantive section coverage.");
    } else {
        warnings.push("Several sections are still very short.");
    }

    const scoreBase = 100
        - blockers.length * 22
        - warnings.length * 8
        + Math.min(strengths.length * 4, 12);
    const score = Math.max(8, Math.min(100, scoreBase));
    const status = blockers.length ? "blocked" : warnings.length > 2 ? "review" : "ready";

    return {
        inlineCitationKeys,
        bibliographyKeys,
        missingBibliographyKeys,
        unusedBibliographyKeys,
        duplicateHeadingTitles,
        undefinedSymbolCandidates,
        sectionStats,
        preflight: {
            score,
            status,
            blockers,
            warnings,
            strengths,
        },
    };
}

export type WriterRevisionSnapshot = {
    id: string;
    createdAt: string;
    label: string;
    title: string;
    abstract: string;
    content: string;
    sectionCount: number;
    wordCount: number;
};

export function createWriterRevisionSnapshot(params: {
    id: string;
    label: string;
    title: string;
    abstract: string;
    content: string;
    sectionCount: number;
}): WriterRevisionSnapshot {
    return {
        id: params.id,
        createdAt: new Date().toISOString(),
        label: params.label,
        title: params.title,
        abstract: params.abstract,
        content: params.content,
        sectionCount: params.sectionCount,
        wordCount: countWords(params.content),
    };
}

export type WriterRevisionComparison = {
    addedWords: number;
    removedWords: number;
    headingDelta: number;
    equationDelta: number;
    plotDelta: number;
    changedAbstract: boolean;
};

export function compareWriterRevisions(current: string, previous: string, currentAbstract: string, previousAbstract: string): WriterRevisionComparison {
    const currentWords = countWords(current);
    const previousWords = countWords(previous);
    const currentHeadings = (current.match(HEADING_REGEX) || []).length;
    const previousHeadings = (previous.match(HEADING_REGEX) || []).length;
    const currentEquations = countEquations(current);
    const previousEquations = countEquations(previous);
    const currentPlots = (current.match(/```plot(?:2d|3d)/g) || []).length;
    const previousPlots = (previous.match(/```plot(?:2d|3d)/g) || []).length;

    return {
        addedWords: Math.max(0, currentWords - previousWords),
        removedWords: Math.max(0, previousWords - currentWords),
        headingDelta: currentHeadings - previousHeadings,
        equationDelta: currentEquations - previousEquations,
        plotDelta: currentPlots - previousPlots,
        changedAbstract: currentAbstract.trim() !== previousAbstract.trim(),
    };
}
