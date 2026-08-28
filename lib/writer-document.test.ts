import { describe, expect, it } from "vitest";

import {
    analyzeWriterDocumentContent,
    buildLegacyWriterSnapshotStorageKey,
    buildWriterSnapshotStorageKey,
    createEmptyWriterDocument,
    splitWriterCommaValues,
} from "./writer-document";

describe("Writer document core", () => {
    it("analyzes structural content without React", () => {
        const analysis = analyzeWriterDocumentContent(`# Title\n\nText with $x^2$.\n\n## Plot\n\n\`\`\`plot2d\n{}\n\`\`\``);
        expect(analysis.headings.map((item) => item.title)).toEqual(["Title", "Plot"]);
        expect(analysis.equations).toBe(1);
        expect(analysis.codeBlocks).toBe(1);
        expect(analysis.plot2DBlocks).toBe(1);
        expect(analysis.totalPlots).toBe(1);
    });

    it("uses document identity for stable snapshot storage", () => {
        expect(buildWriterSnapshotStorageKey("edit", "42", "Changing title", "section-a")).toBe(
            "mathsphere_writer_snapshots::id:42",
        );
        expect(buildWriterSnapshotStorageKey("new", "new-draft", "Changing title", "section-a")).toBe(
            "mathsphere_writer_snapshots::id:new-draft",
        );
    });

    it("retains the legacy snapshot key builder for migration", () => {
        expect(buildLegacyWriterSnapshotStorageKey("edit", "My Paper", "section-a")).toBe(
            "mathsphere_writer_snapshots::edit:my-paper",
        );
    });

    it("creates a complete empty document contract", () => {
        const document = createEmptyWriterDocument();
        expect(document.document_kind).toBe("paper");
        expect(document.branding_enabled).toBe(true);
        expect(document.sections).toEqual([]);
    });

    it("normalizes comma metadata", () => {
        expect(splitWriterCommaValues("A, B , , C")).toEqual(["A", "B", "C"]);
    });
});
