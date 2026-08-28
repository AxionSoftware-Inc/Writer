import {
    normalizeWriterProjectSections,
    type WriterProjectSection,
    type WriterSectionKind,
    type WriterSectionProgressState,
} from "@/lib/writer-project";

export const WRITER_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type WriterDocument = {
    schemaVersion: typeof WRITER_DOCUMENT_SCHEMA_VERSION;
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

export type WriterDocumentPatch = Partial<
    Pick<
        WriterDocument,
        "title" | "abstract" | "authors" | "keywords" | "document_kind" | "branding_enabled" | "branding_label" | "status"
    >
>;
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

const writerSectionKinds = new Set<WriterSectionKind>(["frontmatter", "chapter", "section", "appendix", "references"]);
const writerSectionProgressStates = new Set<WriterSectionProgressState>(["todo", "drafting", "done"]);
const writerDocumentKeys = new Set<keyof WriterDocument>([
    "schemaVersion",
    "title",
    "abstract",
    "content",
    "authors",
    "keywords",
    "document_kind",
    "branding_enabled",
    "branding_label",
    "status",
    "sections",
]);
const writerDocumentPatchKeys = new Set<keyof WriterDocumentPatch>([
    "title",
    "abstract",
    "authors",
    "keywords",
    "document_kind",
    "branding_enabled",
    "branding_label",
    "status",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSection(value: unknown, index: number): WriterProjectSection | null {
    if (!isRecord(value)) return null;
    const id = typeof value.id === "number" || typeof value.id === "string" ? value.id : undefined;
    const title = typeof value.title === "string" ? value.title : `Section ${index + 1}`;
    const slug = typeof value.slug === "string" ? value.slug : "";
    const kind =
        typeof value.kind === "string" && writerSectionKinds.has(value.kind as WriterSectionKind)
            ? (value.kind as WriterSectionKind)
            : "section";
    const progressState =
        typeof value.progress_state === "string" && writerSectionProgressStates.has(value.progress_state as WriterSectionProgressState)
            ? (value.progress_state as WriterSectionProgressState)
            : "todo";
    const order = typeof value.order === "number" && Number.isFinite(value.order) ? value.order : index + 1;
    const content = typeof value.content === "string" ? value.content : "";
    const normalized = { title, slug, kind, progress_state: progressState, order, content } satisfies WriterProjectSection;

    return id === undefined ? normalized : { ...normalized, id };
}

export function isWriterProjectSection(value: unknown): value is WriterProjectSection {
    if (!isRecord(value)) return false;
    if (value.id !== undefined && typeof value.id !== "number" && typeof value.id !== "string") return false;
    return (
        typeof value.title === "string" &&
        typeof value.slug === "string" &&
        typeof value.kind === "string" &&
        writerSectionKinds.has(value.kind as WriterSectionKind) &&
        typeof value.progress_state === "string" &&
        writerSectionProgressStates.has(value.progress_state as WriterSectionProgressState) &&
        typeof value.order === "number" &&
        Number.isFinite(value.order) &&
        typeof value.content === "string"
    );
}

export function isWriterDocument(value: unknown): value is WriterDocument {
    if (!isRecord(value) || value.schemaVersion !== WRITER_DOCUMENT_SCHEMA_VERSION) return false;
    if (Object.keys(value).some((key) => !writerDocumentKeys.has(key as keyof WriterDocument))) return false;
    return (
        typeof value.title === "string" &&
        typeof value.abstract === "string" &&
        typeof value.content === "string" &&
        typeof value.authors === "string" &&
        typeof value.keywords === "string" &&
        typeof value.document_kind === "string" &&
        typeof value.branding_enabled === "boolean" &&
        typeof value.branding_label === "string" &&
        typeof value.status === "string" &&
        Array.isArray(value.sections) &&
        value.sections.every(isWriterProjectSection)
    );
}

export function isWriterDocumentPatch(value: unknown): value is WriterDocumentPatch {
    if (!isRecord(value)) return false;
    if (Object.keys(value).some((key) => !writerDocumentPatchKeys.has(key as keyof WriterDocumentPatch))) return false;
    if (value.title !== undefined && typeof value.title !== "string") return false;
    if (value.abstract !== undefined && typeof value.abstract !== "string") return false;
    if (value.authors !== undefined && typeof value.authors !== "string") return false;
    if (value.keywords !== undefined && typeof value.keywords !== "string") return false;
    if (value.document_kind !== undefined && typeof value.document_kind !== "string") return false;
    if (value.branding_enabled !== undefined && typeof value.branding_enabled !== "boolean") return false;
    if (value.branding_label !== undefined && typeof value.branding_label !== "string") return false;
    if (value.status !== undefined && typeof value.status !== "string") return false;
    return true;
}

export function normalizeWriterDocument(value: unknown): WriterDocument {
    const record = isRecord(value) ? value : {};
    const normalizedSections = Array.isArray(record.sections)
        ? normalizeWriterProjectSections(
              record.sections
                  .map((section, index) => normalizeSection(section, index))
                  .filter((section): section is WriterProjectSection => Boolean(section)),
          )
        : [];

    return {
        schemaVersion: WRITER_DOCUMENT_SCHEMA_VERSION,
        title: typeof record.title === "string" ? record.title : "",
        abstract: typeof record.abstract === "string" ? record.abstract : "",
        content: typeof record.content === "string" ? record.content : "",
        authors: typeof record.authors === "string" ? record.authors : "",
        keywords: typeof record.keywords === "string" ? record.keywords : "",
        document_kind: typeof record.document_kind === "string" ? record.document_kind : "paper",
        branding_enabled: typeof record.branding_enabled === "boolean" ? record.branding_enabled : true,
        branding_label: typeof record.branding_label === "string" ? record.branding_label : "Powered by MathSphere Writer",
        status: typeof record.status === "string" ? record.status : "draft",
        sections: normalizedSections,
    };
}

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
    return normalizeWriterDocument(null);
}
