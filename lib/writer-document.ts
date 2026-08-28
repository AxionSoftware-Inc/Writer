import type { WriterProjectSection } from "@/lib/writer-project";

export type WriterDocument = {
    title: string;
    abstract: string;
    content: string;
    authors: string;
    keywords: string;
    document_kind: string;
    branding_enabled: boolean;
    branding_label: string;
    status: string;
    sections: WriterProjectSection[];
};

export type WriterSaveState = "idle" | "submitting" | "success" | "error";
export type WriterViewMode = "split" | "edit" | "preview";
export type WriterPreviewSyncMode = "live" | "manual";
export type WriterInspectorSection = "navigator" | "tools" | "review" | "document";

export type WriterDocumentAnalysis = {
    words: number;
    characters: number;
    headings: Array<{ level: number; title: string }>;
    equations: number;
    codeBlocks: number;
    plot2DBlocks: number;
    plot3DBlocks: number;
    totalPlots: number;
};

export function analyzeWriterDocumentContent(content: string): WriterDocumentAnalysis {
    const trimmedContent = content.trim();
    const words = trimmedContent ? trimmedContent.split(/\s+/).length : 0;
    const headings = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => ({
        level: match[0].match(/^#+/)?.[0].length ?? 1,
        title: match[1].trim(),
    }));
    const equations = (content.match(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g) || []).length;
    const codeBlocks = Math.floor((content.match(/```/g) || []).length / 2);
    const plot2DBlocks = (content.match(/```plot2d/g) || []).length;
    const plot3DBlocks = (content.match(/```plot3d/g) || []).length;

    return {
        words,
        characters: content.length,
        headings,
        equations,
        codeBlocks,
        plot2DBlocks,
        plot3DBlocks,
        totalPlots: plot2DBlocks + plot3DBlocks,
    };
}

export function splitWriterCommaValues(value: string) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeSnapshotIdentity(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "-")
        .replace(/-+/g, "-");
}

export function buildWriterSnapshotStorageKey(
    mode: "new" | "edit",
    documentId: string | undefined,
    title: string,
    firstSectionKey: string,
) {
    const identity = documentId ? `id:${documentId}` : `${mode}:${title || firstSectionKey || "draft"}`;
    return `mathsphere_writer_snapshots::${normalizeSnapshotIdentity(identity)}`;
}

/** Legacy key used before the modular workspace. Kept for one-way localStorage migration. */
export function buildLegacyWriterSnapshotStorageKey(
    mode: "new" | "edit",
    title: string,
    firstSectionKey: string,
) {
    const identity = `${mode}:${title || firstSectionKey || "draft"}`;
    return `mathsphere_writer_snapshots::${normalizeSnapshotIdentity(identity)}`;
}

export function createEmptyWriterDocument(): WriterDocument {
    return {
        title: "",
        abstract: "",
        content: "",
        authors: "",
        keywords: "",
        document_kind: "paper",
        branding_enabled: true,
        branding_label: "Powered by MathSphere Writer",
        status: "draft",
        sections: [],
    };
}
