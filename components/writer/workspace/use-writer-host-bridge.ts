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
    const {
        insertMarkdown,
        replaceDocument,
        patchDocument,
        openPanel,
        setView,
        refreshPreview,
        requestSave,
        focusEditor,
    } = handlers;

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
                    insertMarkdown(command.markdown);
                    break;
                case "replace-document":
                    replaceDocument(command.document);
                    break;
                case "patch-document":
                    patchDocument(command.patch);
                    break;
                case "open-panel":
                    openPanel(command.panel);
                    break;
                case "set-view":
                    setView(command.view);
                    break;
                case "refresh-preview":
                    refreshPreview();
                    break;
                case "request-save":
                    void requestSave();
                    break;
                case "focus-editor":
                    focusEditor();
                    break;
            }
        });
    }, [focusEditor, host, insertMarkdown, openPanel, patchDocument, refreshPreview, replaceDocument, requestSave, setView]);
}
