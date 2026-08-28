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

/** Same-window bridge for hosts that do not share React state with Writer. */
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
                const detail = (event as CustomEvent<unknown>).detail;
                if (isWriterHostCommand(detail)) listener(detail);
            };
            window.addEventListener(`${channel}:command`, handler);
            return () => window.removeEventListener(`${channel}:command`, handler);
        },
    };
}

export type WriterPostMessageEnvelope =
    | {
          source: "mathsphere-writer";
          channel: string;
          kind: "command";
          payload: WriterHostCommand;
      }
    | {
          source: "mathsphere-writer";
          channel: string;
          kind: "event";
          payload: WriterHostEvent;
      };

export type WriterPostMessageHostOptions = {
    /** Exact target origin. Intentionally required; `*` is rejected. */
    targetOrigin: string;
    /** Origin allowed to send commands to this Writer instance. Defaults to targetOrigin. */
    allowedOrigin?: string;
    channel?: string;
    id?: string;
    capabilities?: WriterHostCapabilities;
    /** Parent, opener, iframe contentWindow or a desktop WebView bridge window. */
    getTargetWindow?: () => Window | null;
    /** Optional source-window check in addition to the origin check. */
    getAllowedSource?: () => MessageEventSource | null;
};

/**
 * Cross-window bridge for iframe, microfrontend and WebView embedding.
 * Wildcard target origins are rejected. Incoming commands are accepted only
 * from the configured origin, channel, optional source window and valid payload.
 */
export function createPostMessageWriterHost(options: WriterPostMessageHostOptions): WriterHostAdapter {
    const channel = options.channel || "mathsphere-writer";
    const allowedOrigin = options.allowedOrigin || options.targetOrigin;

    if (!options.targetOrigin || options.targetOrigin === "*") {
        throw new Error("Writer postMessage integration requires an explicit targetOrigin.");
    }

    const getTargetWindow = options.getTargetWindow ?? (() => {
        if (typeof window === "undefined") return null;
        if (window.parent && window.parent !== window) return window.parent;
        return window.opener ?? null;
    });

    return {
        id: options.id || `${channel}-post-message`,
        capabilities: options.capabilities,
        emit(event) {
            if (typeof window === "undefined") return;
            const target = getTargetWindow();
            if (!target) return;
            const envelope: WriterPostMessageEnvelope = {
                source: "mathsphere-writer",
                channel,
                kind: "event",
                payload: event,
            };
            target.postMessage(envelope, options.targetOrigin);
        },
        subscribe(listener) {
            if (typeof window === "undefined") return () => undefined;
            const handler = (event: MessageEvent<unknown>) => {
                if (event.origin !== allowedOrigin) return;
                const allowedSource = options.getAllowedSource?.();
                if (allowedSource && event.source !== allowedSource) return;
                if (!isWriterPostMessageEnvelope(event.data)) return;
                if (event.data.channel !== channel || event.data.kind !== "command") return;
                if (isWriterHostCommand(event.data.payload)) listener(event.data.payload);
            };
            window.addEventListener("message", handler);
            return () => window.removeEventListener("message", handler);
        },
    };
}

const panelValues = new Set<WriterInspectorSection>(["navigator", "tools", "review", "document"]);
const viewValues = new Set<WriterViewMode>(["edit", "split", "preview"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isWriterHostCommand(value: unknown): value is WriterHostCommand {
    if (!isRecord(value) || typeof value.type !== "string") return false;

    switch (value.type) {
        case "insert-markdown":
            return typeof value.markdown === "string";
        case "replace-document":
            return isRecord(value.document);
        case "patch-document":
            return isRecord(value.patch);
        case "open-panel":
            return typeof value.panel === "string" && panelValues.has(value.panel as WriterInspectorSection);
        case "set-view":
            return typeof value.view === "string" && viewValues.has(value.view as WriterViewMode);
        case "refresh-preview":
        case "request-save":
        case "focus-editor":
            return true;
        default:
            return false;
    }
}

export function isWriterPostMessageEnvelope(value: unknown): value is WriterPostMessageEnvelope {
    if (!isRecord(value)) return false;
    if (value.source !== "mathsphere-writer" || typeof value.channel !== "string") return false;
    if (value.kind === "command") return isWriterHostCommand(value.payload);
    if (value.kind === "event") {
        return isRecord(value.payload) && typeof value.payload.type === "string" && value.payload.type.startsWith("writer.");
    }
    return false;
}

export async function emitWriterHostEvent(host: WriterHostAdapter | undefined, event: WriterHostEvent) {
    if (!host?.emit) return;
    try {
        await host.emit(event);
    } catch (error) {
        console.error("Writer host event failed:", error);
    }
}
