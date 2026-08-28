import type { WriterDocument } from "@/lib/writer-document";
import {
    compileWriterProjectSections,
    createWriterProjectSection,
} from "@/lib/writer-project";
import { writerTemplates } from "@/lib/writer-templates";

function sameContent(left: string | null | undefined, right: string | null | undefined) {
    return (left || "").trim() === (right || "").trim();
}

/**
 * Reconcile the legacy transition where a template replaces compiled `content`
 * while an older section array is still attached. Writer is section-authoritative,
 * so integrations must normalize that transition before persistence.
 */
export function reconcileWriterTemplateApplication(next: WriterDocument): WriterDocument {
    if (!next.sections.length || !next.content.trim()) return next;

    const compiledWithBranding = compileWriterProjectSections(next.sections, {
        brandingEnabled: next.branding_enabled,
        brandingLabel: next.branding_label,
    });
    const compiledWithoutBranding = compileWriterProjectSections(next.sections);

    if (sameContent(next.content, compiledWithBranding) || sameContent(next.content, compiledWithoutBranding)) {
        return next;
    }

    const matchedTemplate = writerTemplates.find(
        (template) => template.titleTemplate === next.title && sameContent(template.contentTemplate, next.content),
    );
    if (!matchedTemplate) return next;

    const sections = [
        createWriterProjectSection({
            title: matchedTemplate.title,
            kind: matchedTemplate.category === "book" || matchedTemplate.category === "thesis" ? "chapter" : "section",
            progress_state: "drafting",
            content: matchedTemplate.contentTemplate,
            order: 1,
        }),
    ];

    return {
        ...next,
        document_kind:
            matchedTemplate.category === "book" || matchedTemplate.category === "thesis"
                ? "book"
                : "paper",
        sections,
        content: compileWriterProjectSections(sections, {
            brandingEnabled: next.branding_enabled,
            brandingLabel: next.branding_label,
        }),
    };
}
