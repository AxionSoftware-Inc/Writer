"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { PaperEditorWorkspace, type PaperFormData } from "@/components/paper-editor-workspace";
import { fetchWriterPaper, updateWriterPaper } from "@/lib/writer-api";

export default function EditPaperPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<PaperFormData>({
        title: "", abstract: "", content: "", authors: "", keywords: "", document_kind: "paper",
        branding_enabled: true, branding_label: "Powered by MathSphere Writer", status: "draft", sections: [],
    });
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        async function fetchPaper() {
            try {
                const data = await fetchWriterPaper(id);
                setFormData({
                    title: data.title || "", abstract: data.abstract || "", content: data.content || "", authors: data.authors || "",
                    keywords: data.keywords || "", document_kind: data.document_kind || "paper", branding_enabled: data.branding_enabled ?? true,
                    branding_label: data.branding_label || "Powered by MathSphere Writer", status: data.status || "draft",
                    sections: Array.isArray(data.sections) ? data.sections : [],
                });
            } catch (error) {
                console.error("Xatolik:", error);
                router.push("/documents");
            } finally {
                setIsLoading(false);
            }
        }
        fetchPaper();
    }, [id, router]);

    async function handleSubmit(nextData?: PaperFormData) {
        setStatus("submitting");
        setErrorMessage("");
        try {
            await updateWriterPaper(id, nextData ?? formData);
            setStatus("success");
            setTimeout(() => router.push("/documents"), 900);
        } catch (error) {
            console.error("Submission error:", error);
            setErrorMessage(error instanceof Error ? error.message : "Tarmoq xatosi. Server bilan bog'lanishda muammo.");
            setStatus("error");
        }
    }

    if (isLoading) {
        return (
            <div className="ax-workspace-root flex h-[calc(100dvh-28px)] min-h-0 w-full flex-col items-center justify-center overflow-hidden text-[var(--ax-text-soft)]">
                <Loader2 className="mb-4 h-6 w-6 animate-spin text-[var(--ax-accent)]" />
                <p className="text-sm">Preparing Writer…</p>
            </div>
        );
    }

    return (
        <div className="ax-workspace-root flex h-[calc(100dvh-28px)] min-h-0 w-full flex-col overflow-hidden">
            <PaperEditorWorkspace formData={formData} onChange={setFormData} onSubmit={handleSubmit} saveState={status} errorMessage={errorMessage} mode="edit" documentId={id} />
        </div>
    );
}
