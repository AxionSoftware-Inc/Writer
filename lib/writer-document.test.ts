import { describe, expect, it } from "vitest";

import {
    WRITER_DOCUMENT_SCHEMA_VERSION,
    analyzeWriterDocumentContent,
    buildLegacyWriterSnapshotStorageKey,
    buildWriterSnapshotStorageKey,
    createEmptyWriterDocument,
    isWriterDocument,
    isWriterDocumentPatch,
    normalizeWriterDocument,
    splitWriterCommaValues,
} from "./writer-document";
import { createWriterProjectSection } from "./writer-project";

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

    it("creates a versioned empty document contract", () => {
        const document = createEmptyWriterDocument();
        expect(document.schemaVersion).toBe(WRITER_DOCUMENT_SCHEMA_VERSION);
        expect(document.document_kind).toBe("paper");
        expect(document.branding_enabled).toBe(true);
        expect(document.sections).toEqual([]);
        expect(isWriterDocument(document)).toBe(true);
    });

    it("upgrades legacy server-shaped documents into the current schema", () => {
        const section = createWriterProjectSection({ title: "Main", content: "Body" });
        const document = normalizeWriterDocument({
            title: "Legacy",
            content: "Body",
            sections: [section],
        });
        expect(document.schemaVersion).toBe(WRITER_DOCUMENT_SCHEMA_VERSION);
        expect(document.title).toBe("Legacy");
        expect(document.sections).toHaveLength(1);
        expect(isWriterDocument(document)).toBe(true);
    });

    it("rejects unknown or malformed document patches", () => {
        expect(isWriterDocumentPatch({ title: "Updated" })).toBe(true);
        expect(isWriterDocumentPatch({ branding_enabled: false })).toBe(true);
        expect(isWriterDocumentPatch({ branding_enabled: "no" })).toBe(false);
        expect(isWriterDocumentPatch({ arbitraryField: true })).toBe(false);
    });

    it("normalizes comma metadata", () => {
        expect(splitWriterCommaValues("A, B , , C")).toEqual(["A", "B", "C"]);
    });
});
