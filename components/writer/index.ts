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
    createWindowWriterHost,
    defaultWriterHost,
} from "@/lib/writer-integration";
export type {
    WriterHostAdapter,
    WriterHostCapabilities,
    WriterHostCommand,
    WriterHostContext,
    WriterHostEvent,
} from "@/lib/writer-integration";
