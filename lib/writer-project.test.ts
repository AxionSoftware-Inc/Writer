import { describe, expect, it } from "vitest";

import {
    compileWriterProjectSections,
    createWriterProjectSection,
    ensureWriterProjectSections,
    normalizeWriterProjectSections,
} from "./writer-project";

describe("writer project compilation", () => {
    it("compiles normalized sections in order", () => {
        const sections = [
            createWriterProjectSection({ title: "Second", order: 2, content: "Second body" }),
            createWriterProjectSection({ title: "First", order: 1, content: "First body" }),
        ];

        expect(compileWriterProjectSections(sections)).toBe(
            "## First\n\nFirst body\n\n---\n\n## Second\n\nSecond body",
        );
    });

    it("does not duplicate a heading when section content already starts with one", () => {
        const section = createWriterProjectSection({
            title: "Research",
            content: "# Existing heading\n\nBody",
        });

        expect(compileWriterProjectSections([section])).toBe("# Existing heading\n\nBody");
    });

    it("adds branding only when enabled and escapes markdown control characters", () => {
        const section = createWriterProjectSection({ title: "Main", content: "Body" });

        expect(
            compileWriterProjectSections([section], {
                brandingEnabled: true,
                brandingLabel: "Powered by *Writer* [beta]",
            }),
        ).toBe("## Main\n\nBody\n\n---\n\n_Powered by \\*Writer\\* \\[beta\\]_" );

        expect(
            compileWriterProjectSections([section], {
                brandingEnabled: false,
                brandingLabel: "Hidden",
            }),
        ).toBe("## Main\n\nBody");
    });

    it("normalizes section order without mutating the caller array", () => {
        const first = createWriterProjectSection({ title: "First", order: 10, content: "A" });
        const second = createWriterProjectSection({ title: "Second", order: 2, content: "B" });
        const input = [first, second];

        const normalized = normalizeWriterProjectSections(input);

        expect(normalized.map((section) => section.title)).toEqual(["Second", "First"]);
        expect(normalized.map((section) => section.order)).toEqual([1, 2]);
        expect(input[0]).toBe(first);
    });

    it("creates a fallback section for legacy content-only documents", () => {
        const sections = ensureWriterProjectSections({
            title: "Legacy",
            content: "Legacy body",
            sections: [],
        });

        expect(sections).toHaveLength(1);
        expect(sections[0].title).toBe("Legacy");
        expect(sections[0].content).toBe("Legacy body");
    });
});
