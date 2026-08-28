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
                const detail = (event as CustomEvent<WriterHostCommand>).detail;
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
 * The adapter refuses wildcard target origins and validates incoming origin,
 * channel, envelope kind and (optionally) source window before accepting commands.
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

export function isWriterHostCommand(value: unknown): value is WriterHostCommand {
    if (!value || typeof value !== "object" || !("type" in value)) return false;
    const type = (value as { type?: unknown }).type;
    return typeof type === "string" && [
        "insert-markdown",
        "replace-document",
        "patch-document",
        "open-panel",
        "set-view",
        "refresh-preview",
        "request-save",
        "focus-editor",
    ].includes(type);
}

export function isWriterPostMessageEnvelope(value: unknown): value is WriterPostMessageEnvelope {
    if (!value || typeof value !== "object") return false;
    const envelope = value as Partial<WriterPostMessageEnvelope>;
    return (
        envelope.source === "mathsphere-writer" &&
        typeof envelope.channel === "string" &&
        (envelope.kind === "command" || envelope.kind === "event") &&
        Boolean(envelope.payload)
    );
}

export async function emitWriterHostEvent(host: WriterHostAdapter | undefined, event: WriterHostEvent) {
    if (!host?.emit) return;
    try {
        await host.emit(event);
    } catch (error) {
        console.error("Writer host event failed:", error);
    }
}
