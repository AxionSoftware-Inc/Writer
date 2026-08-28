import { extractWriterBridgeBlocks, serializeWriterBridgeBlock, type WriterImportPayload } from "@/lib/live-writer-bridge";
import { createWriterProjectSection, type WriterProjectSection } from "@/lib/writer-project";
import type { WriterDocument } from "@/lib/writer-document";
import type { WriterRevisionSnapshot } from "@/lib/writer-intelligence";
import type { WriterTemplate } from "@/lib/writer-templates";

const LAB_IMPORT_BLOCK_REGEX = /<!-- lab-result-import:([a-f0-9-]+):(\d+):start -->([\s\S]*?)<!-- lab-result-import:\1:end -->/gi;

export type SavedResultImportReference = {
    savedResultId: string;
    revision: number;
    integrity?: { sourceHash?: string; resultHash?: string; method?: string } | null;
};

export function buildSavedResultImportSnippet(payload: WriterImportPayload) {
    const body = [payload.block ? serializeWriterBridgeBlock(payload.block) : "", payload.markdown]
        .filter(Boolean)
        .join("\n\n");

    if (!payload.block?.savedResultId || !payload.block.savedResultRevision) return body;

    return [
        `<!-- lab-result-import:${payload.block.savedResultId}:${payload.block.savedResultRevision}:start -->`,
        body,
        `<!-- lab-result-import:${payload.block.savedResultId}:end -->`,
    ].join("\n\n");
}

export function extractSavedResultImports(content: string): SavedResultImportReference[] {
    const imports: SavedResultImportReference[] = [];
    for (const match of content.matchAll(LAB_IMPORT_BLOCK_REGEX)) {
        const block = extractWriterBridgeBlocks(match[3])[0];
        imports.push({
            savedResultId: match[1],
            revision: Number(match[2]),
            integrity: block?.integrity ?? null,
        });
    }
    return imports;
}

export function replaceSavedResultImport(
    content: string,
    savedResultId: string,
    currentRevision: number,
    nextSnippet: string,
) {
    return content.replace(
        new RegExp(
            `<!-- lab-result-import:${savedResultId}:${currentRevision}:start -->[\\s\\S]*?<!-- lab-result-import:${savedResultId}:end -->`,
            "i",
        ),
        nextSnippet,
    );
}

export function insertAtSelection(content: string, snippet: string, start: number, end: number) {
    return {
        content: `${content.slice(0, start)}${snippet}${content.slice(end)}`,
        cursor: start + snippet.length,
    };
}

export function insertCitationAtSelection(
    content: string,
    citation: string,
    inlineRef: string,
    start: number,
    end: number,
) {
    const inlineText = ` [${inlineRef}]`;
    let nextContent = `${content.slice(0, start)}${inlineText}${content.slice(end)}`;

    if (!nextContent.includes("## Ishlatilgan adabiyotlar")) {
        nextContent += "\n\n## Ishlatilgan adabiyotlar\n";
    }

    const bibliographyEntry = `- [${inlineRef}] ${citation}`;
    const escapedRef = inlineRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const alreadyPresent = new RegExp(`^\\s*[-*]\\s+\\[${escapedRef}\\]\\s+`, "m").test(nextContent);
    if (!alreadyPresent) nextContent += `\n${bibliographyEntry}`;

    return { content: nextContent, cursor: start + inlineText.length };
}

export function createTemplateDocument(current: WriterDocument, template: WriterTemplate) {
    const section = createWriterProjectSection({
        title: template.title,
        kind: template.category === "book" || template.category === "thesis" ? "chapter" : "section",
        progress_state: "drafting",
        content: template.contentTemplate,
        order: 1,
    });

    return {
        document: {
            ...current,
            title: template.titleTemplate,
            abstract: template.abstractTemplate,
            keywords: template.keywords,
            document_kind: template.category === "book" || template.category === "thesis" ? "book" : "paper",
            sections: [section],
            content: template.contentTemplate,
        } satisfies WriterDocument,
        section,
    };
}

export function createSnapshotDocument(current: WriterDocument, snapshot: WriterRevisionSnapshot) {
    const section = createWriterProjectSection({
        title: current.title || snapshot.title || "Main Draft",
        kind: current.document_kind === "book" ? "chapter" : "section",
        progress_state: "drafting",
        content: snapshot.content,
        order: 1,
    });

    return {
        document: {
            ...current,
            title: snapshot.title,
            abstract: snapshot.abstract,
            sections: [section],
            content: snapshot.content,
        } satisfies WriterDocument,
        section,
    };
}

export function replaceActiveSectionContent(
    sections: WriterProjectSection[],
    activeSectionKey: string,
    content: string,
) {
    return sections.map((section) =>
        String(section.id ?? section.slug ?? section.title) === activeSectionKey
            ? { ...section, content }
            : section,
    );
}
