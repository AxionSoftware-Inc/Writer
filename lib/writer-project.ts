export type WriterSectionKind = "frontmatter" | "chapter" | "section" | "appendix" | "references";
export type WriterSectionProgressState = "todo" | "drafting" | "done";

export type WriterProjectSection = {
    id?: number | string;
    title: string;
    slug: string;
    kind: WriterSectionKind;
    progress_state: WriterSectionProgressState;
    order: number;
    content: string;
};

type WriterProjectLike = {
    title?: string | null;
    content?: string | null;
    sections?: WriterProjectSection[] | null;
};

type WriterProjectCompileOptions = {
    brandingEnabled?: boolean;
    brandingLabel?: string | null;
};

function buildTempId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugifySectionTitle(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
}

export function getWriterSectionKey(section: WriterProjectSection) {
    return String(section.id ?? section.slug ?? section.title);
}

export function createWriterProjectSection(params: {
    title?: string;
    kind?: WriterSectionKind;
    progress_state?: WriterSectionProgressState;
    content?: string;
    order?: number;
}) {
    const title = (params.title || "").trim() || "New Section";
    const order = params.order ?? 1;

    return {
        id: buildTempId(),
        title,
        slug: `${slugifySectionTitle(title)}-${order}`,
        kind: params.kind ?? "section",
        progress_state: params.progress_state ?? "todo",
        order,
        content: params.content ?? "",
    } satisfies WriterProjectSection;
}

export function normalizeWriterProjectSections(sections: WriterProjectSection[]) {
    return [...sections]
        .sort((left, right) => left.order - right.order)
        .map((section, index) => {
            const order = index + 1;
            const title = (section.title || "").trim() || `Section ${order}`;
            return {
                ...section,
                title,
                order,
                slug: section.slug || `${slugifySectionTitle(title)}-${order}`,
                kind: section.kind || "section",
                progress_state: section.progress_state || "todo",
                content: section.content || "",
            };
        });
}

export function compileWriterProjectSections(
    sections: WriterProjectSection[],
    options: WriterProjectCompileOptions = {},
) {
    const body = normalizeWriterProjectSections(sections)
        .map((section) => {
            const content = (section.content || "").trim();
            if (!content) {
                return "";
            }

            if (content.startsWith("#")) {
                return content;
            }

            return `## ${section.title}\n\n${content}`;
        })
        .filter(Boolean)
        .join("\n\n---\n\n")
        .trim();
    void options;
    return body;
}

export function ensureWriterProjectSections(project: WriterProjectLike) {
    if (project.sections?.length) {
        return normalizeWriterProjectSections(project.sections);
    }

    return [
        createWriterProjectSection({
            title: project.title || "Main Draft",
            kind: "section",
            content: project.content || "",
            order: 1,
        }),
    ];
}
