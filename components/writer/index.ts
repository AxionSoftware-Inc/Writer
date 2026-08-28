export { WriterWorkspace } from "./workspace/writer-workspace";
export type {
    WriterWorkspaceProps,
    WriterWorkspaceSlots,
} from "./workspace/writer-workspace";

export {
    WRITER_DOCUMENT_SCHEMA_VERSION,
    createEmptyWriterDocument,
    isWriterDocument,
    isWriterDocumentPatch,
    normalizeWriterDocument,
} from "@/lib/writer-document";
export type {
    WriterDocument,
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
