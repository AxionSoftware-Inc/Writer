export {
    analyzeWriterDocumentContent,
    buildLegacyWriterSnapshotStorageKey,
    buildWriterSnapshotStorageKey,
    createEmptyWriterDocument,
    splitWriterCommaValues,
} from "@/lib/writer-document";
export type {
    WriterDocument,
    WriterDocumentAnalysis,
    WriterInspectorSection,
    WriterPreviewSyncMode,
    WriterSaveState,
    WriterViewMode,
} from "@/lib/writer-document";

export {
    createWindowWriterHost,
    defaultWriterHost,
    emitWriterHostEvent,
} from "@/lib/writer-integration";
export type {
    WriterHostAdapter,
    WriterHostCapabilities,
    WriterHostCommand,
    WriterHostContext,
    WriterHostEvent,
} from "@/lib/writer-integration";

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
