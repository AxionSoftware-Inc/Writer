"use client";

import { useEffect, useRef } from "react";

import type { WriterDocument, WriterDocumentPatch, WriterInspectorSection, WriterViewMode } from "@/lib/writer-document";
import { emitWriterHostEvent, type WriterHostAdapter, type WriterHostContext } from "@/lib/writer-integration";

type WriterHostBridgeHandlers = {
    insertMarkdown: (markdown: string) => void;
    replaceDocument: (document: WriterDocument) => void;
    patchDocument: (patch: WriterDocumentPatch) => void;
    openPanel: (panel: WriterInspectorSection) => void;
    setView: (view: WriterViewMode) => void;
    refreshPreview: () => void;
    requestSave: () => void | Promise<void>;
    focusEditor: () => void;
};

export function useWriterHostBridge(
    host: WriterHostAdapter,
    context: WriterHostContext,
    handlers: WriterHostBridgeHandlers,
) {
    const readyKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const readyKey = `${host.id}:${context.mode}:${context.documentId ?? ""}`;
        if (readyKeyRef.current === readyKey) return;
        readyKeyRef.current = readyKey;
        void emitWriterHostEvent(host, { type: "writer.ready", context });
    }, [context, host]);

    useEffect(() => {
        if (!host.subscribe) return;
        return host.subscribe((command) => {
            switch (command.type) {
                case "insert-markdown":
                    handlers.insertMarkdown(command.markdown);
                    break;
                case "replace-document":
                    handlers.replaceDocument(command.document);
                    break;
                case "patch-document":
                    handlers.patchDocument(command.patch);
                    break;
                case "open-panel":
                    handlers.openPanel(command.panel);
                    break;
                case "set-view":
                    handlers.setView(command.view);
                    break;
                case "refresh-preview":
                    handlers.refreshPreview();
                    break;
                case "request-save":
                    void handlers.requestSave();
                    break;
                case "focus-editor":
                    handlers.focusEditor();
                    break;
            }
        });
    }, [handlers, host]);
}
