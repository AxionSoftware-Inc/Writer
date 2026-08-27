import { describe, expect, it } from "vitest";

import { compileWriterProjectSections, createWriterProjectSection } from "./writer-project";
import { reconcileWriterTemplateApplication } from "./writer-template-application";
import { createDraftFromTemplate, getWriterTemplate } from "./writer-templates";

describe("Writer template application reconciliation", () => {
    it("preserves a consistent section-based document by identity", () => {
        const template = getWriterTemplate("research-paper");
        if (!template) throw new Error("research-paper template missing");

        const draft = createDraftFromTemplate(template);
        const reconciled = reconcileWriterTemplateApplication(draft);

        expect(reconciled).toBe(draft);
    });

    it("rebuilds stale sections when the workspace replaces content with a known template", () => {
        const template = getWriterTemplate("research-paper");
        if (!template) throw new Error("research-paper template missing");

        const oldSection = createWriterProjectSection({
            title: "Old section",
            content: "Old body that must not survive template replacement.",
            order: 1,
        });

        const transitionalState = {
            title: template.titleTemplate,
            abstract: template.abstractTemplate,
            content: template.contentTemplate,
            authors: "A. Author",
            keywords: template.keywords,
            document_kind: "paper",
            branding_enabled: false,
            branding_label: "Powered by MathSphere Writer",
            status: "draft",
            sections: [oldSection],
        };

        const reconciled = reconcileWriterTemplateApplication(transitionalState);

        expect(reconciled).not.toBe(transitionalState);
        expect(reconciled.sections).toHaveLength(1);
        expect(reconciled.sections[0].title).toBe(template.title);
        expect(reconciled.sections[0].content).toBe(template.contentTemplate);
        expect(reconciled.content).toBe(compileWriterProjectSections(reconciled.sections));
        expect(reconciled.content).not.toContain("Old body");
    });

    it("does not reinterpret arbitrary unsynchronized content as a template", () => {
        const section = createWriterProjectSection({ title: "Main", content: "Section body" });
        const state = {
            title: "Custom title",
            abstract: "",
            content: "Transient custom content",
            authors: "",
            keywords: "",
            document_kind: "paper",
            branding_enabled: false,
            branding_label: "",
            status: "draft",
            sections: [section],
        };

        expect(reconcileWriterTemplateApplication(state)).toBe(state);
    });
});
