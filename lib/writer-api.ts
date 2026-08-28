import { fetchPublic } from "@/lib/api";
import type { WriterDocument } from "@/lib/writer-document";

export type WriterPaperRecord = {
    id: number;
    title: string;
    abstract: string;
    content: string;
    authors: string;
    keywords: string;
    document_kind: string;
    branding_enabled: boolean;
    branding_label: string;
    status: string;
    sections: WriterDocument["sections"];
    section_count?: number;
    created_at: string;
    updated_at: string;
};

async function parseApiError(response: Response) {
    try {
        const data = await response.json();
        if (typeof data?.detail === "string") return data.detail;
        return JSON.stringify(data);
    } catch {
        return `Request failed with status ${response.status}`;
    }
}

function normalizeWriterPayload(payload: WriterDocument) {
    return {
        ...payload,
        sections: payload.sections.map((section, index) => {
            const normalized: Record<string, unknown> = {
                title: section.title,
                slug: section.slug,
                kind: section.kind,
                progress_state: section.progress_state,
                order: section.order || index + 1,
                content: section.content,
            };

            if (typeof section.id === "number") normalized.id = section.id;
            else if (typeof section.id === "string" && /^\d+$/.test(section.id.trim())) normalized.id = Number(section.id);

            return normalized;
        }),
    };
}

export async function fetchWriterPaper(id: string | number) {
    const response = await fetchPublic(`/api/builder/papers/${id}/`);
    if (!response.ok) throw new Error(await parseApiError(response));
    return (await response.json()) as WriterPaperRecord;
}

export async function createWriterPaper(payload: WriterDocument) {
    const response = await fetchPublic("/api/builder/papers/", {
        method: "POST",
        body: JSON.stringify(normalizeWriterPayload(payload)),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    return (await response.json()) as WriterPaperRecord;
}

export async function updateWriterPaper(id: string | number, payload: WriterDocument) {
    const response = await fetchPublic(`/api/builder/papers/${id}/`, {
        method: "PUT",
        body: JSON.stringify(normalizeWriterPayload(payload)),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
    return (await response.json()) as WriterPaperRecord;
}

export async function deleteWriterPaper(id: string | number) {
    const response = await fetchPublic(`/api/builder/papers/${id}/`, { method: "DELETE" });
    if (!response.ok) throw new Error(await parseApiError(response));
}
