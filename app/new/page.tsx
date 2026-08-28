"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { WriterWorkspace } from "@/components/writer";
import { normalizeWriterDocument, type WriterDocument } from "@/lib/writer-document";
import { readQueuedWriterImport, removeQueuedWriterImport, serializeWriterBridgeBlock } from "@/lib/live-writer-bridge";
import { createWriterPaper } from "@/lib/writer-api";
import { compileWriterProjectSections } from "@/lib/writer-project";
import { reconcileWriterTemplateApplication } from "@/lib/writer-template-application";
import { createDraftFromTemplate, getDefaultWriterTemplate, getWriterTemplate, getWriterTemplatePreset } from "@/lib/writer-templates";

function NewPaperPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const importedFromLaboratory = useRef(false);

    const presetId = searchParams.get("preset");
    const templateId = searchParams.get("template");
    const source = searchParams.get("source");
    const importId = searchParams.get("importId") || undefined;
    const selectedPreset = getWriterTemplatePreset(presetId);
    const addOnIds = (searchParams.get("addons") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const selectedTemplate = getWriterTemplate(templateId || selectedPreset?.templateId) ?? getDefaultWriterTemplate();
    const resolvedAddOnIds = addOnIds.length ? addOnIds : selectedPreset?.addOnIds ?? [];

    const [formData, setFormData] = useState<WriterDocument>(() =>
        normalizeWriterDocument(createDraftFromTemplate(selectedTemplate, resolvedAddOnIds)),
    );
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleFormChange = useCallback((next: WriterDocument) => {
        setFormData(reconcileWriterTemplateApplication(next));
    }, []);

    useEffect(() => {
        if (importedFromLaboratory.current || typeof window === "undefined") return;
        if (source !== "laboratory") return;

        const laboratoryExport = readQueuedWriterImport(importId);
        if (!laboratoryExport) return;

        importedFromLaboratory.current = true;
        removeQueuedWriterImport(importId);
        const timer = window.setTimeout(() => {
            const importedSections = [
                laboratoryExport.block ? serializeWriterBridgeBlock(laboratoryExport.block) : "",
                laboratoryExport.markdown,
            ].filter(Boolean);

            setFormData((current) => {
                const nextSections = current.sections.length
                    ? current.sections.map((section, index) =>
                          index === 0
                              ? { ...section, content: `${importedSections.join("\n\n")}\n\n---\n\n${section.content}` }
                              : section,
                      )
                    : current.sections;

                return {
                    ...current,
                    sections: nextSections,
                    title:
                        current.title === getDefaultWriterTemplate().titleTemplate
                            ? laboratoryExport.title || "Laboratoriya hisoboti asosidagi maqola"
                            : current.title,
                    abstract:
                        current.abstract ||
                        laboratoryExport.abstract ||
                        "Ushbu qoralama matematik laboratoriyadan eksport qilingan hisob-kitob va vizual natijalarga tayangan holda shakllantirildi.",
                    content: compileWriterProjectSections(nextSections, {
                        brandingEnabled: current.branding_enabled,
                        brandingLabel: current.branding_label,
                    }),
                    keywords: current.keywords || laboratoryExport.keywords || "mathematics, laboratory",
                };
            });
        }, 0);

        return () => window.clearTimeout(timer);
    }, [importId, source]);

    async function handleSubmit(nextData?: WriterDocument) {
        setStatus("submitting");
        setErrorMessage("");
        try {
            const payload = reconcileWriterTemplateApplication(nextData ?? formData);
            const created = await createWriterPaper(payload);
            setStatus("success");
            router.replace(`/${created.id}`);
        } catch (error) {
            console.error("Submission error:", error);
            setErrorMessage(error instanceof Error ? error.message : "Tarmoq xatosi. Server bilan bog‘lanishda muammo.");
            setStatus("error");
        }
    }

    return (
        <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
            <WriterWorkspace
                formData={formData}
                onChange={handleFormChange}
                onSubmit={handleSubmit}
                saveState={status}
                errorMessage={errorMessage}
                mode="new"
                documentId="new-draft"
            />
        </div>
    );
}

function NewPaperPageFallback() {
    return (
        <div className="flex h-dvh min-h-0 w-full flex-col items-center justify-center overflow-hidden bg-background text-muted-foreground">
            <p>Writer yuklanmoqda…</p>
        </div>
    );
}

export default function NewPaperPage() {
    return (
        <Suspense fallback={<NewPaperPageFallback />}>
            <NewPaperPageContent />
        </Suspense>
    );
}
