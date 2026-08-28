import { describe, expect, it, vi } from "vitest";

import { emitWriterHostEvent, type WriterHostAdapter } from "./writer-integration";

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
});
