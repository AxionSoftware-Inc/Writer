import type { WriterBridgeBlockData, WriterBridgePublicationProfile } from "@/lib/live-writer-bridge";

export const LAB_PUBLICATION_PROFILE_LABELS: Record<WriterBridgePublicationProfile, string> = {
    summary: "Paper Summary",
    full: "Full Packet",
    appendix: "Appendix",
    figures: "Figures Only",
};

export const LAB_PUBLICATION_PROFILE_DESCRIPTIONS: Record<WriterBridgePublicationProfile, string> = {
    summary: "Executive metrics, short notes, and one publication-facing visual.",
    full: "Complete laboratory packet with metrics, notes, visuals, and structured details.",
    appendix: "Method-heavy packet for technical appendix and reproducibility sections.",
    figures: "Visual assets and compact captions without full derivation text.",
};

function takeFirst<T>(items: T[] | undefined, count: number) {
    return items?.slice(0, count);
}

function buildSummaryMarkdown(block: WriterBridgeBlockData) {
    const lines = [
        `# ${block.title}`,
        "",
        "- profile: summary",
        `- module: ${block.moduleSlug}`,
        `- kind: ${block.kind}`,
        `- generated: ${block.generatedAt}`,
        "",
        "## Summary",
        `- ${block.summary}`,
        "",
        "## Key Signals",
        ...(takeFirst(block.metrics, 4) ?? []).map((metric) => `- ${metric.label}: ${metric.value}`),
        ...((takeFirst(block.notes, 3) ?? []).length
            ? ["", "## Notes", ...(takeFirst(block.notes, 3) ?? []).map((note) => `- ${note}`)]
            : []),
    ];

    return lines.join("\n").trim();
}

function buildFiguresMarkdown(block: WriterBridgeBlockData) {
    const figureLabels = [
        ...(block.plotSeries?.map((item) => item.label) ?? []),
        ...(block.matrixTables?.map((item) => item.label) ?? []),
    ];

    return [
        `# ${block.title}`,
        "",
        "- profile: figures",
        `- module: ${block.moduleSlug}`,
        `- visual assets: ${figureLabels.length || 0}`,
        "",
        "## Figure Packet",
        `- ${block.summary}`,
        ...figureLabels.map((label) => `- ${label}`),
    ].join("\n").trim();
}

function buildAppendixMarkdown(baseMarkdown: string, block: WriterBridgeBlockData) {
    const appendixLines = [
        "",
        "## Verification Appendix",
        "- profile: appendix",
        `- module: ${block.moduleSlug}`,
        `- generated: ${block.generatedAt}`,
        `- metric count: ${block.metrics.length}`,
        `- note count: ${block.notes?.length ?? 0}`,
        `- plot count: ${block.plotSeries?.length ?? 0}`,
        `- matrix count: ${block.matrixTables?.length ?? 0}`,
    ];

    return `${baseMarkdown.trim()}\n${appendixLines.join("\n")}`.trim();
}

export function applyPublicationProfileToBlock(
    source: WriterBridgeBlockData,
    profile: WriterBridgePublicationProfile,
): WriterBridgeBlockData {
    const block: WriterBridgeBlockData = {
        ...source,
        profile,
        metrics: [...source.metrics],
        notes: source.notes ? [...source.notes] : undefined,
        coefficients: source.coefficients ? [...source.coefficients] : undefined,
        matrixTables: source.matrixTables ? [...source.matrixTables] : undefined,
        plotSeries: source.plotSeries ? [...source.plotSeries] : undefined,
    };

    if (profile === "full") {
        return block;
    }

    if (profile === "summary") {
        return {
            ...block,
            title: `${block.title} - Summary`,
            summary: `Publication summary from ${block.moduleSlug}. ${block.summary}`,
            metrics: takeFirst(block.metrics, 4) ?? [],
            notes: takeFirst(block.notes, 3),
            coefficients: takeFirst(block.coefficients, 4),
            matrixTables: takeFirst(block.matrixTables, 1),
            plotSeries: takeFirst(block.plotSeries, 1),
        };
    }

    if (profile === "appendix") {
        return {
            ...block,
            title: `${block.title} - Appendix`,
            summary: `Technical appendix packet from ${block.moduleSlug}. ${block.summary}`,
        };
    }

    return {
        ...block,
        title: `${block.title} - Figures`,
        summary: `Figure packet from ${block.moduleSlug}. ${block.summary}`,
        metrics: takeFirst(block.metrics, 3) ?? [],
        notes:
            block.plotSeries?.length || block.matrixTables?.length
                ? ["Visual profile selected for publication figures."]
                : ["No figure assets were present in the saved laboratory packet."],
        coefficients: undefined,
        plotSeries: block.plotSeries,
        matrixTables: block.matrixTables,
    };
}

export function applyPublicationProfileToMarkdown(
    baseMarkdown: string,
    block: WriterBridgeBlockData,
    profile: WriterBridgePublicationProfile,
) {
    if (profile === "full") {
        return baseMarkdown;
    }
    if (profile === "summary") {
        return buildSummaryMarkdown(block);
    }
    if (profile === "appendix") {
        return buildAppendixMarkdown(baseMarkdown, block);
    }
    return buildFiguresMarkdown(block);
}
