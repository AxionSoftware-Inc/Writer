import type { WriterDocument, WriterInspectorSection, WriterViewMode } from "@/lib/writer-document";

export type WriterHostCapabilities = {
    navigation?: boolean;
    persistence?: boolean;
    imports?: boolean;
    exports?: boolean;
    telemetry?: boolean;
};

export type WriterHostContext = {
    documentId?: string;
    mode: "new" | "edit";
    hostId: string;
};

export type WriterHostCommand =
    | { type: "insert-markdown"; markdown: string }
    | { type: "replace-document"; document: WriterDocument }
    | { type: "patch-document"; patch: Partial<WriterDocument> }
    | { type: "open-panel"; panel: WriterInspectorSection }
    | { type: "set-view"; view: WriterViewMode }
    | { type: "refresh-preview" }
    | { type: "request-save" }
    | { type: "focus-editor" };

export type WriterHostEvent =
    | { type: "writer.ready"; context: WriterHostContext }
    | { type: "writer.document.changed"; context: WriterHostContext; document: WriterDocument }
    | { type: "writer.document.save-requested"; context: WriterHostContext; document: WriterDocument }
    | { type: "writer.document.saved"; context: WriterHostContext; document: WriterDocument }
    | { type: "writer.section.changed"; context: WriterHostContext; sectionId: string }
    | { type: "writer.view.changed"; context: WriterHostContext; view: WriterViewMode }
    | { type: "writer.preview.refreshed"; context: WriterHostContext }
    | { type: "writer.export.requested"; context: WriterHostContext; format: "pdf" | "preflight" }
    | { type: "writer.integration.error"; context: WriterHostContext; message: string };

export interface WriterHostAdapter {
    id: string;
    capabilities?: WriterHostCapabilities;
    emit?: (event: WriterHostEvent) => void | Promise<void>;
    subscribe?: (listener: (command: WriterHostCommand) => void) => () => void;
    resolveBackHref?: (context: WriterHostContext) => string | undefined;
}

export const defaultWriterHost: WriterHostAdapter = {
    id: "writer-web",
    capabilities: {
        navigation: true,
        persistence: true,
        imports: true,
        exports: true,
        telemetry: false,
    },
};

/**
 * Browser bridge for products that embed Writer without sharing React state.
 *
 * Host -> Writer commands:
 *   window.dispatchEvent(new CustomEvent(`${channel}:command`, { detail: command }))
 *
 * Writer -> Host events:
 *   window.addEventListener(`${channel}:event`, listener)
 */
export function createWindowWriterHost(
    channel = "mathsphere-writer",
    options: { id?: string; capabilities?: WriterHostCapabilities } = {},
): WriterHostAdapter {
    return {
        id: options.id || channel,
        capabilities: options.capabilities,
        emit(event) {
            if (typeof window === "undefined") return;
            window.dispatchEvent(new CustomEvent(`${channel}:event`, { detail: event }));
        },
        subscribe(listener) {
            if (typeof window === "undefined") return () => undefined;
            const handler = (event: Event) => {
                const detail = (event as CustomEvent<WriterHostCommand>).detail;
                if (detail && typeof detail === "object" && "type" in detail) listener(detail);
            };
            window.addEventListener(`${channel}:command`, handler);
            return () => window.removeEventListener(`${channel}:command`, handler);
        },
    };
}

export async function emitWriterHostEvent(host: WriterHostAdapter | undefined, event: WriterHostEvent) {
    if (!host?.emit) return;
    try {
        await host.emit(event);
    } catch (error) {
        console.error("Writer host event failed:", error);
    }
}
