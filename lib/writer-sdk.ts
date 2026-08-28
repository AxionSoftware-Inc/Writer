export {
    WRITER_DOCUMENT_SCHEMA_VERSION,
    analyzeWriterDocumentContent,
    buildLegacyWriterSnapshotStorageKey,
    buildWriterSnapshotStorageKey,
    createEmptyWriterDocument,
    isWriterDocument,
    isWriterDocumentPatch,
    isWriterProjectSection,
    normalizeWriterDocument,
    splitWriterCommaValues,
} from "@/lib/writer-document";
export type {
    WriterDocument,
    WriterDocumentAnalysis,
    WriterDocumentPatch,
    WriterInspectorSection,
    WriterPreviewSyncMode,
    WriterSaveState,
    WriterViewMode,
} from "@/lib/writer-document";

export {
    createPostMessageWriterHost,
    createWindowWriterHost,
    defaultWriterHost,
    emitWriterHostEvent,
    isWriterHostCommand,
    isWriterHostEvent,
    isWriterPostMessageEnvelope,
} from "@/lib/writer-integration";
export type {
    WriterHostAdapter,
    WriterHostCapabilities,
    WriterHostCommand,
    WriterHostContext,
    WriterHostEvent,
    WriterPostMessageEnvelope,
    WriterPostMessageHostOptions,
} from "@/lib/writer-integration";

export {
    WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION,
    createWriterExternalResourceReference,
    isWriterExternalResourceReference,
} from "@/lib/writer-external-resource";
export type { WriterExternalResourceReference } from "@/lib/writer-external-resource";

export {
    compileWriterProjectSections,
    createWriterProjectSection,
    ensureWriterProjectSections,
    getWriterSectionKey,
    normalizeWriterProjectSections,
} from "@/lib/writer-project";
export type {
    WriterProjectSection,
    WriterSectionKind,
    WriterSectionProgressState,
} from "@/lib/writer-project";
