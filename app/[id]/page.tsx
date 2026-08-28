"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";

import { WriterWorkspace } from "@/components/writer";
import { createEmptyWriterDocument, normalizeWriterDocument, type WriterDocument } from "@/lib/writer-document";
import { fetchWriterPaper, updateWriterPaper } from "@/lib/writer-api";
import { reconcileWriterTemplateApplication } from "@/lib/writer-template-application";

export default function EditPaperPage() {
    const params = useParams();
    const id = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [formData, setFormData] = useState<WriterDocument>(() => createEmptyWriterDocument());
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleFormChange = useCallback((next: WriterDocument) => {
        setFormData(reconcileWriterTemplateApplication(next));
    }, []);

    const loadPaper = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");
        try {
            const data = await fetchWriterPaper(id);
            setFormData(normalizeWriterDocument(data));
        } catch (error) {
            console.error("Writer document load failed:", error);
            setLoadError(error instanceof Error ? error.message : "Hujjatni yuklab bo‘lmadi.");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadPaper();
    }, [loadPaper]);

    async function handleSubmit(nextData?: WriterDocument) {
        setStatus("submitting");
        setErrorMessage("");
        try {
            const payload = reconcileWriterTemplateApplication(nextData ?? formData);
            const saved = await updateWriterPaper(id, payload);
            setFormData(
                normalizeWriterDocument({
                    ...payload,
                    ...saved,
                    sections: Array.isArray(saved.sections) ? saved.sections : payload.sections,
                }),
            );
            setStatus("success");
            window.setTimeout(() => setStatus((current) => (current === "success" ? "idle" : current)), 1400);
        } catch (error) {
            console.error("Writer document save failed:", error);
            setErrorMessage(error instanceof Error ? error.message : "Tarmoq xatosi. Server bilan bog‘lanishda muammo.");
            setStatus("error");
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-dvh min-h-0 w-full flex-col items-center justify-center overflow-hidden bg-background text-muted-foreground">
                <Loader2 className="mb-3 h-6 w-6 animate-spin" />
                <p className="text-sm">Writer hujjati yuklanmoqda…</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex h-dvh min-h-0 w-full items-center justify-center overflow-hidden bg-background p-6">
                <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Document unavailable</div>
                    <h1 className="mt-2 text-xl font-black tracking-tight">Hujjatni ochib bo‘lmadi</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{loadError}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void loadPaper()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-xs font-bold text-background">
                            <RefreshCw className="h-3.5 w-3.5" /> Qayta urinish
                        </button>
                        <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/60 px-4 text-xs font-bold text-muted-foreground hover:bg-muted/30 hover:text-foreground">
                            <ArrowLeft className="h-3.5 w-3.5" /> Arxivga qaytish
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
            <WriterWorkspace
                formData={formData}
                onChange={handleFormChange}
                onSubmit={handleSubmit}
                saveState={status}
                errorMessage={errorMessage}
                mode="edit"
                documentId={id}
            />
        </div>
    );
}
