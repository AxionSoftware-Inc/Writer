export { WriterWorkspace } from "./workspace/writer-workspace";
export type {
    WriterWorkspaceProps,
    WriterWorkspaceSlots,
} from "./workspace/writer-workspace";

export type {
    WriterDocument,
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
