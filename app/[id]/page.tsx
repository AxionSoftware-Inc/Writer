"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import {
    PaperEditorWorkspace,
    type PaperFormData,
} from "@/components/paper-editor-workspace";
import { fetchWriterPaper, updateWriterPaper } from "@/lib/writer-api";

export default function EditPaperPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<PaperFormData>({
        title: "",
        abstract: "",
        content: "",
        authors: "",
        keywords: "",
        document_kind: "paper",
        branding_enabled: true,
        branding_label: "Powered by MathSphere Writer",
        status: "draft",
        sections: [],
    });
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        async function fetchPaper() {
            try {
                const data = await fetchWriterPaper(id);
                setFormData({
                    title: data.title || "",
                    abstract: data.abstract || "",
                    content: data.content || "",
                    authors: data.authors || "",
                    keywords: data.keywords || "",
                    document_kind: data.document_kind || "paper",
                    branding_enabled: data.branding_enabled ?? true,
                    branding_label: data.branding_label || "Powered by MathSphere Writer",
                    status: data.status || "draft",
                    sections: Array.isArray(data.sections) ? data.sections : [],
                });
            } catch (error) {
                console.error("Xatolik:", error);
                router.push("/");
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
            const payload = nextData ?? formData;
            const saved = await updateWriterPaper(id, payload);

            // Keep the editor open. A save action should not unexpectedly throw the
            // user back to the archive. Also use the normalized server response so
            // section ids/revisions returned by the backend remain authoritative.
            setFormData((current) => ({
                ...current,
                ...payload,
                title: saved.title ?? payload.title,
                abstract: saved.abstract ?? payload.abstract,
                content: saved.content ?? payload.content,
                authors: saved.authors ?? payload.authors,
                keywords: saved.keywords ?? payload.keywords,
                document_kind: saved.document_kind ?? payload.document_kind,
                branding_enabled: saved.branding_enabled ?? payload.branding_enabled,
                branding_label: saved.branding_label ?? payload.branding_label,
                status: saved.status ?? payload.status,
                sections: Array.isArray(saved.sections) ? saved.sections : payload.sections,
            }));
            setStatus("success");

            window.setTimeout(() => {
                setStatus((current) => (current === "success" ? "idle" : current));
            }, 1400);
        } catch (error) {
            console.error("Submission error:", error);
            setErrorMessage(error instanceof Error ? error.message : "Tarmoq xatosi. Server bilan bog'lanishda muammo.");
            setStatus("error");
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-dvh min-h-0 w-full flex-col items-center justify-center overflow-hidden bg-background text-muted-foreground">
                <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                <p>Muhit tayyorlanmoqda...</p>
            </div>
        );
    }

    return (
        <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
            <PaperEditorWorkspace
                formData={formData}
                onChange={setFormData}
                onSubmit={handleSubmit}
                saveState={status}
                errorMessage={errorMessage}
                mode="edit"
                documentId={id}
            />
        </div>
    );
}
