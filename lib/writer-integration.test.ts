import { describe, expect, it, vi } from "vitest";

import { createEmptyWriterDocument } from "./writer-document";
import {
    createPostMessageWriterHost,
    emitWriterHostEvent,
    isWriterHostCommand,
    isWriterHostEvent,
    isWriterPostMessageEnvelope,
    type WriterHostAdapter,
} from "./writer-integration";

describe("Writer host integration port", () => {
    it("emits typed events through the host adapter", async () => {
        const emit = vi.fn();
        const host: WriterHostAdapter = { id: "test-host", emit };
        const event = {
            type: "writer.ready" as const,
            context: { hostId: "test-host", mode: "edit" as const, documentId: "42" },
        };

        await emitWriterHostEvent(host, event);
        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenCalledWith(event);
    });

    it("treats hosts without event sinks as valid no-op integrations", async () => {
        await expect(
            emitWriterHostEvent(
                { id: "minimal-host" },
                {
                    type: "writer.preview.refreshed",
                    context: { hostId: "minimal-host", mode: "new", documentId: "new-draft" },
                },
            ),
        ).resolves.toBeUndefined();
    });

    it("contains host event failures so editing is not blocked", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const host: WriterHostAdapter = {
            id: "failing-host",
            emit: () => {
                throw new Error("host unavailable");
            },
        };

        await expect(
            emitWriterHostEvent(host, {
                type: "writer.preview.refreshed",
                context: { hostId: "failing-host", mode: "edit", documentId: "7" },
            }),
        ).resolves.toBeUndefined();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("validates command-specific payloads", () => {
        const validDocument = createEmptyWriterDocument();
        expect(isWriterHostCommand({ type: "insert-markdown", markdown: "## Result" })).toBe(true);
        expect(isWriterHostCommand({ type: "insert-markdown" })).toBe(false);
        expect(isWriterHostCommand({ type: "replace-document", document: validDocument })).toBe(true);
        expect(isWriterHostCommand({ type: "replace-document", document: {} })).toBe(false);
        expect(isWriterHostCommand({ type: "patch-document", patch: { title: "New title" } })).toBe(true);
        expect(isWriterHostCommand({ type: "patch-document", patch: { title: 17 } })).toBe(false);
        expect(isWriterHostCommand({ type: "patch-document", patch: { content: "direct body mutation" } })).toBe(false);
        expect(isWriterHostCommand({ type: "patch-document", patch: { sections: [] } })).toBe(false);
        expect(isWriterHostCommand({ type: "patch-document", patch: { unknown: true } })).toBe(false);
        expect(isWriterHostCommand({ type: "open-panel", panel: "tools" })).toBe(true);
        expect(isWriterHostCommand({ type: "open-panel", panel: "unknown" })).toBe(false);
        expect(isWriterHostCommand({ type: "set-view", view: "split" })).toBe(true);
        expect(isWriterHostCommand({ type: "set-view", view: "fullscreen" })).toBe(false);
    });

    it("validates event payloads instead of trusting writer-prefixed strings", () => {
        const context = { hostId: "test-host", mode: "edit" as const, documentId: "42" };
        expect(isWriterHostEvent({ type: "writer.ready", context })).toBe(true);
        expect(isWriterHostEvent({ type: "writer.document.changed", context, document: createEmptyWriterDocument() })).toBe(true);
        expect(isWriterHostEvent({ type: "writer.document.changed", context, document: {} })).toBe(false);
        expect(isWriterHostEvent({ type: "writer.fake", context })).toBe(false);
    });

    it("validates postMessage envelopes", () => {
        expect(
            isWriterPostMessageEnvelope({
                source: "mathsphere-writer",
                channel: "writer",
                kind: "command",
                payload: { type: "focus-editor" },
            }),
        ).toBe(true);
        expect(
            isWriterPostMessageEnvelope({
                source: "mathsphere-writer",
                channel: "writer",
                kind: "command",
                payload: { type: "insert-markdown" },
            }),
        ).toBe(false);
        expect(
            isWriterPostMessageEnvelope({
                source: "mathsphere-writer",
                channel: "writer",
                kind: "event",
                payload: { type: "writer.fake", context: { hostId: "x", mode: "new" } },
            }),
        ).toBe(false);
    });

    it("rejects wildcard postMessage targets", () => {
        expect(() => createPostMessageWriterHost({ targetOrigin: "*" })).toThrow(/explicit targetOrigin/);
    });
});
