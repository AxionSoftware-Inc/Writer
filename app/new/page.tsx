"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PaperEditorWorkspace, type PaperFormData } from "@/components/paper-editor-workspace";
import { getLocalScientificObject } from "@/lib/ecosystem/local-object-store";
import { readQueuedWriterImport, removeQueuedWriterImport, serializeWriterBridgeBlock } from "@/lib/live-writer-bridge";
import { createWriterPaper } from "@/lib/writer-api";
import { compileWriterProjectSections } from "@/lib/writer-project";
import { createDraftFromTemplate, getDefaultWriterTemplate, getWriterTemplate, getWriterTemplatePreset } from "@/lib/writer-templates";

function prependToFirstSection(current: PaperFormData, importedContent: string, title?: string, abstract?: string, provenanceMarker?: string) {
    const contentWithProvenance = [provenanceMarker, importedContent].filter(Boolean).join("\n\n");
    const nextSections = current.sections.length
        ? current.sections.map((section, index) => index === 0 ? { ...section, content: `${contentWithProvenance}\n\n---\n\n${section.content}` } : section)
        : current.sections;

    return {
        ...current,
        sections: nextSections,
        title: current.title === getDefaultWriterTemplate().titleTemplate && title ? title : current.title,
        abstract: current.abstract || abstract || "This draft was started from scientific evidence in the active Project.",
        content: compileWriterProjectSections(nextSections, { brandingEnabled: current.branding_enabled, brandingLabel: current.branding_label }),
    };
}

function NewPaperPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const importedFromSource = useRef(false);

    const presetId = searchParams.get("preset");
    const templateId = searchParams.get("template");
    const source = searchParams.get("source");
    const importId = searchParams.get("importId") || undefined;
    const objectId = searchParams.get("objectId") || undefined;
    const selectedPreset = getWriterTemplatePreset(presetId);
    const addOnIds = (searchParams.get("addons") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const selectedTemplate = getWriterTemplate(templateId || selectedPreset?.templateId) ?? getDefaultWriterTemplate();
    const resolvedAddOnIds = addOnIds.length ? addOnIds : selectedPreset?.addOnIds ?? [];

    const [formData, setFormData] = useState<PaperFormData>(createDraftFromTemplate(selectedTemplate, resolvedAddOnIds));
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (importedFromSource.current || typeof window === "undefined") return;

        if (source === "project" && objectId) {
            importedFromSource.current = true;
            void getLocalScientificObject(objectId)
                .then((object) => {
                    if (!object?.revision?.payload || typeof object.revision.payload !== "object") {
                        setErrorMessage("Project evidence could not be opened on this device.");
                        return;
                    }
                    const payload = object.revision.payload as Record<string, unknown>;
                    const markdown = typeof payload.report_markdown === "string" ? payload.report_markdown : "";
                    const summary = typeof payload.summary === "string" ? payload.summary : "";
                    const importedContent = markdown.trim() || summary.trim() || object.title;
                    const reference = {
                        projectId: object.projectId,
                        objectId: object.id,
                        mode: "live",
                        revision: object.currentRevision,
                        sourceApp: object.sourceApp,
                        domain: object.domain || object.kind,
                    };
                    const provenanceMarker = `<!-- axion-scientific-reference:${JSON.stringify(reference)} -->`;
                    setFormData((current) => prependToFirstSection(current, importedContent, object.title, summary, provenanceMarker));
                })
                .catch(() => setErrorMessage("Project evidence could not be opened on this device."));
            return;
        }

        if (source !== "laboratory") return;
        const laboratoryExport = readQueuedWriterImport(importId);
        if (!laboratoryExport) return;

        importedFromSource.current = true;
        removeQueuedWriterImport(importId);
        const timer = window.setTimeout(() => {
            const importedSections = [laboratoryExport.block ? serializeWriterBridgeBlock(laboratoryExport.block) : "", laboratoryExport.markdown].filter(Boolean);
            setFormData((current) => {
                const next = prependToFirstSection(current, importedSections.join("\n\n"), laboratoryExport.title || "Laboratoriya hisoboti asosidagi maqola", laboratoryExport.abstract || "Ushbu qoralama matematik laboratoriyadan eksport qilingan hisob-kitob va vizual natijalarga tayangan holda shakllantirildi.");
                return { ...next, keywords: current.keywords || laboratoryExport.keywords || "mathematics, laboratory" };
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [importId, objectId, source]);

    const createDraft = useCallback(async (data: PaperFormData) => {
        setStatus("submitting");
        setErrorMessage("");
        try {
            const created = await createWriterPaper(data);
            setStatus("success");
            return created;
        } catch (error) {
            console.error("Submission error:", error);
            setErrorMessage(error instanceof Error ? error.message : "Tarmoq xatosi. Server bilan bog'lanishda muammo.");
            setStatus("error");
            return null;
        }
    }, []);

    const handleSubmit = useCallback(async (nextData?: PaperFormData) => {
        const created = await createDraft(nextData ?? formData);
        if (created) window.setTimeout(() => router.push("/documents"), 900);
    }, [createDraft, formData, router]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
            event.preventDefault();
            if (status === "submitting") return;
            void createDraft(formData).then((created) => {
                if (created) router.replace(`/${created.id}`);
            });
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [createDraft, formData, router, status]);

    return (
        <div className="ax-workspace-root flex h-[calc(100dvh-28px)] min-h-0 w-full flex-col overflow-hidden">
            <PaperEditorWorkspace formData={formData} onChange={setFormData} onSubmit={handleSubmit} saveState={status} errorMessage={errorMessage} mode="new" documentId="new-draft" />
        </div>
    );
}

function NewPaperPageFallback() {
    return <div className="ax-workspace-root flex h-[calc(100dvh-28px)] min-h-0 w-full flex-col items-center justify-center overflow-hidden text-[var(--ax-text-soft)]"><p>Preparing Writer…</p></div>;
}

export default function NewPaperPage() {
    return <Suspense fallback={<NewPaperPageFallback />}><NewPaperPageContent /></Suspense>;
}
