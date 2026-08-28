import { describe, expect, it } from "vitest";

import type { WriterImportPayload } from "@/lib/live-writer-bridge";
import {
    buildSavedResultImportSnippet,
    extractSavedResultImports,
    insertCitationAtSelection,
} from "./workspace-transforms";

describe("Writer workspace transforms", () => {
    it("maps legacy Laboratory imports into provider-neutral resource references", () => {
        const payload: WriterImportPayload = {
            version: 1,
            markdown: "Imported result",
            block: {
                id: "block-1",
                status: "ready",
                moduleSlug: "integrals",
                kind: "plot2d",
                title: "Integral result",
                summary: "Result",
                generatedAt: "2026-08-28T00:00:00Z",
                metrics: [],
                savedResultId: "123e4567-e89b-12d3-a456-426614174000",
                savedResultRevision: 4,
                integrity: { resultHash: "sha256:result" },
            },
        };

        const imports = extractSavedResultImports(buildSavedResultImportSnippet(payload));
        expect(imports).toHaveLength(1);
        expect(imports[0].resource).toMatchObject({
            provider: "laboratory",
            resourceType: "saved-result",
            resourceId: "123e4567-e89b-12d3-a456-426614174000",
            revision: 4,
            integrityHash: "sha256:result",
            renderer: "plot2d",
        });
    });

    it("does not duplicate an existing bibliography entry", () => {
        const initial = "Body\n\n## Ishlatilgan adabiyotlar\n- [A1] Existing source";
        const result = insertCitationAtSelection(initial, "Existing source", "A1", 4, 4);
        expect(result.content.match(/\[A1\]/g)).toHaveLength(2);
        expect(result.content.match(/- \[A1\] Existing source/g)).toHaveLength(1);
    });
});
