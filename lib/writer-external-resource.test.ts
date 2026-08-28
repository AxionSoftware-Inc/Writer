import { describe, expect, it } from "vitest";

import {
    WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION,
    createWriterExternalResourceReference,
    isWriterExternalResourceReference,
} from "./writer-external-resource";

describe("Writer external resource contract", () => {
    it("creates portable provider-neutral resource references", () => {
        const reference = createWriterExternalResourceReference({
            provider: "mathematics",
            resourceType: "solver-result",
            resourceId: "result-42",
            revision: 3,
            integrityHash: "sha256:abc",
            renderer: "plot2d",
        });

        expect(reference.schemaVersion).toBe(WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION);
        expect(isWriterExternalResourceReference(reference)).toBe(true);
    });

    it("rejects malformed resource references", () => {
        expect(
            isWriterExternalResourceReference({
                schemaVersion: WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION,
                provider: "",
                resourceType: "saved-result",
                resourceId: "x",
            }),
        ).toBe(false);
        expect(
            isWriterExternalResourceReference({
                schemaVersion: 99,
                provider: "laboratory",
                resourceType: "saved-result",
                resourceId: "x",
            }),
        ).toBe(false);
    });
});
