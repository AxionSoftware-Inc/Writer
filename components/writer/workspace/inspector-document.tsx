"use client";

import { BookText, Layers2, ScanText, Sigma, Sparkles } from "lucide-react";

import { writerTemplates, type WriterTemplateIcon } from "@/lib/writer-templates";
import type { WriterWorkspaceController } from "./workspace-types";

const templateIconMap: Record<WriterTemplateIcon, typeof Sigma> = {
    "book-open": BookText,
    flask: Sparkles,
    "graduation-cap": Layers2,
    newspaper: ScanText,
    "scroll-text": BookText,
};

export function WriterDocumentInspector({ controller }: { controller: WriterWorkspaceController }) {
    const {
        formData,
        setField,
        refreshPreview,
        showMeta,
        setShowMeta,
        applyTemplate,
        headings,
    } = controller;

    const updateBranding = (field: "branding_enabled" | "branding_label", value: boolean | string) => {
        if (field === "branding_enabled") setField(field, value as boolean);
        else setField(field, value as string);
        refreshPreview();
    };

    return (
        <div className="space-y-3">
            <div className="site-panel-strong p-4">
                <button
                    type="button"
                    onClick={() => setShowMeta((value) => !value)}
                    className="flex w-full items-center justify-between"
                    aria-expanded={showMeta}
                >
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Document</div>
                        <div className="mt-1 text-lg font-black">Metadata</div>
                    </div>
                    <ScanText className={`h-5 w-5 transition-transform ${showMeta ? "rotate-0" : "-rotate-90"}`} />
                </button>

                {showMeta ? (
                    <div className="mt-4 space-y-4">
                        <Field label="Mualliflar">
                            <input
                                value={formData.authors}
                                onChange={(event) => setField("authors", event.target.value)}
                                placeholder="Masalan: A. Karimov, M. Qodirov"
                                className="writer-field"
                            />
                        </Field>

                        <Field label="Kalit so'zlar">
                            <input
                                value={formData.keywords}
                                onChange={(event) => setField("keywords", event.target.value)}
                                placeholder="algebra, topology, PDE"
                                className="writer-field"
                            />
                        </Field>

                        <Field label="Annotatsiya">
                            <textarea
                                value={formData.abstract}
                                onChange={(event) => setField("abstract", event.target.value)}
                                rows={5}
                                placeholder="Qisqa, ilmiy va aniq abstract yozing..."
                                className="writer-field min-h-28 resize-y leading-relaxed"
                            />
                        </Field>

                        <Field label="Hujjat turi">
                            <select
                                value={formData.document_kind}
                                onChange={(event) => setField("document_kind", event.target.value)}
                                className="writer-field"
                            >
                                <option value="paper">Paper</option>
                                <option value="book">Book</option>
                                <option value="report">Report</option>
                            </select>
                        </Field>

                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                <span>Branding</span>
                                <input
                                    type="checkbox"
                                    checked={formData.branding_enabled}
                                    onChange={(event) => updateBranding("branding_enabled", event.target.checked)}
                                    className="h-4 w-4"
                                />
                            </label>
                            <input
                                value={formData.branding_label}
                                onChange={(event) => updateBranding("branding_label", event.target.value)}
                                disabled={!formData.branding_enabled}
                                placeholder="Powered by MathSphere Writer"
                                className="writer-field disabled:opacity-50"
                            />
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="site-panel p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Templates</div>
                        <div className="mt-1 text-lg font-black">Layouts</div>
                    </div>
                    <div className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                        {writerTemplates.length}
                    </div>
                </div>
                <div className="mt-4 space-y-2">
                    {writerTemplates.map((template) => {
                        const Icon = templateIconMap[template.icon];
                        return (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => applyTemplate(template)}
                                className="w-full rounded-xl border border-border/60 bg-background px-3 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted/20"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${template.accentClassName}`}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-black">{template.title}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{template.category}</span>
                                        </div>
                                        <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{template.shortDescription}</div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="site-panel p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Outline</div>
                <div className="mt-1 text-lg font-black">Structure</div>
                <div className="mt-4 space-y-1.5">
                    {headings.length ? (
                        headings.map((heading, index) => (
                            <div
                                key={`${heading.title}-${index}`}
                                className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm"
                                style={{ marginLeft: `${Math.min(heading.level - 1, 4) * 8}px` }}
                            >
                                {heading.title}
                            </div>
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                            Hali outline yo&apos;q. `##` bilan bo&apos;lim oching.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</label>
            {children}
        </div>
    );
}
