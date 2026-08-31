"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, FlaskConical, GraduationCap, Newspaper, ScrollText, X } from "lucide-react";

import {
    DEFAULT_WRITER_TEMPLATE_ID,
    writerTemplateAddOns,
    writerTemplates,
    type WriterTemplateCategory,
    type WriterTemplateIcon,
} from "@/lib/writer-templates";

interface WriteTypeSelectorProps {
    isOpen: boolean;
    onClose: () => void;
}

const iconMap: Record<WriterTemplateIcon, typeof BookOpen> = {
    "book-open": BookOpen,
    flask: FlaskConical,
    "graduation-cap": GraduationCap,
    newspaper: Newspaper,
    "scroll-text": ScrollText,
};

function templateCategoryLabel(category: WriterTemplateCategory) {
    if (category === "research") return "Research";
    if (category === "article") return "Article";
    if (category === "teaching") return "Teaching";
    if (category === "thesis") return "Thesis";
    if (category === "book") return "Book";
    return "Lab";
}

export function WriteTypeSelector({ isOpen, onClose }: WriteTypeSelectorProps) {
    const router = useRouter();
    const [selectedTemplateId, setSelectedTemplateId] = React.useState(DEFAULT_WRITER_TEMPLATE_ID);

    React.useEffect(() => {
        if (isOpen) setSelectedTemplateId(DEFAULT_WRITER_TEMPLATE_ID);
    }, [isOpen]);

    const selectedTemplate =
        writerTemplates.find((template) => template.id === selectedTemplateId) ??
        writerTemplates.find((template) => template.id === DEFAULT_WRITER_TEMPLATE_ID) ??
        writerTemplates[0];

    const selectedAddOns = writerTemplateAddOns.filter((addOn) =>
        selectedTemplate.recommendedAddOnIds.includes(addOn.id),
    );
    const SelectedIcon = iconMap[selectedTemplate.icon];

    if (!isOpen) return null;

    const openDraftWithTemplate = (templateId: string) => {
        const query = new URLSearchParams();
        query.set("template", templateId);
        router.push(`/new?${query.toString()}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgb(15_23_42_/_0.28)] p-4 backdrop-blur-[3px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="writer-template-title">
            <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close template selector" />

            <div className="relative flex max-h-[90vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[var(--ax-work-panel-radius)] border border-[var(--ax-work-line)] bg-[var(--ax-surface)] shadow-[0_28px_90px_rgb(15_23_42_/_0.17)]">
                <header className="flex items-start justify-between gap-5 border-b border-[var(--ax-work-line)] px-5 py-5 sm:px-7 sm:py-6">
                    <div>
                        <div className="ax-work-kicker">Writer templates</div>
                        <h2 id="writer-template-title" className="mt-2 font-serif text-[34px] font-medium tracking-[-0.045em] text-[var(--ax-text)] sm:text-[38px]">Choose the document structure.</h2>
                        <p className="mt-3 max-w-2xl text-[12px] leading-6 text-[var(--ax-text-soft)]">Start from a professional manuscript structure. The template sets the initial sections; the document stays fully editable.</p>
                    </div>
                    <button onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ax-work-control-radius)] text-[var(--ax-text-faint)] hover:bg-[var(--ax-work-surface-muted)] hover:text-[var(--ax-text)]" type="button" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
                    <div className="min-h-0 overflow-y-auto border-b border-[var(--ax-work-line)] lg:border-b-0 lg:border-r">
                        <div className="flex items-center justify-between border-b border-[var(--ax-work-line)] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">
                            <span>Template library</span><span>{writerTemplates.length}</span>
                        </div>
                        <div>
                            {writerTemplates.map((template, index) => {
                                const Icon = iconMap[template.icon];
                                const selected = template.id === selectedTemplate.id;
                                return (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`grid w-full grid-cols-[28px_36px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--ax-work-line)] px-5 py-4 text-left transition-colors ${selected ? "bg-[var(--ax-work-surface-muted)]" : "hover:bg-[var(--ax-work-surface-muted)]"}`}
                                    >
                                        <span className="font-serif text-[15px] text-[var(--ax-text-faint)]">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ax-work-line)] text-[var(--ax-accent)]"><Icon className="h-3.5 w-3.5" /></span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-[12px] font-semibold text-[var(--ax-text)]">{template.title}</span>
                                            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--ax-text-faint)]">{templateCategoryLabel(template.category)}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="min-h-0 overflow-y-auto p-5 sm:p-7 lg:p-8">
                        <div className="flex items-start justify-between gap-5">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ax-work-line)] bg-[var(--ax-surface)] text-[var(--ax-accent)]"><SelectedIcon className="h-[18px] w-[18px]" /></div>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">{templateCategoryLabel(selectedTemplate.category)}</span>
                        </div>

                        <h3 className="mt-5 font-serif text-[34px] font-medium tracking-[-0.045em] text-[var(--ax-text)]">{selectedTemplate.title}</h3>
                        <p className="mt-3 max-w-2xl text-[13px] leading-7 text-[var(--ax-text-soft)]">{selectedTemplate.description}</p>

                        <div className="mt-7 grid grid-cols-3 border-y border-[var(--ax-work-line)]">
                            <div className="py-4 pr-4"><div className="text-[9px] uppercase tracking-[0.12em] text-[var(--ax-text-faint)]">Category</div><div className="mt-1.5 text-[11px] font-semibold">{templateCategoryLabel(selectedTemplate.category)}</div></div>
                            <div className="border-l border-[var(--ax-work-line)] px-4 py-4"><div className="text-[9px] uppercase tracking-[0.12em] text-[var(--ax-text-faint)]">Use cases</div><div className="mt-1.5 text-[11px] font-semibold">{selectedTemplate.recommendedFor.length}</div></div>
                            <div className="border-l border-[var(--ax-work-line)] py-4 pl-4"><div className="text-[9px] uppercase tracking-[0.12em] text-[var(--ax-text-faint)]">Add-ons</div><div className="mt-1.5 text-[11px] font-semibold">{selectedAddOns.length}</div></div>
                        </div>

                        <div className="mt-7 grid gap-6 sm:grid-cols-2">
                            <div>
                                <div className="ax-work-kicker text-[var(--ax-text-faint)]">Best for</div>
                                <div className="mt-3 divide-y divide-[var(--ax-work-line)] border-y border-[var(--ax-work-line)]">
                                    {selectedTemplate.recommendedFor.slice(0, 4).map((item) => <div key={item} className="py-2.5 text-[11px] font-semibold text-[var(--ax-text-soft)]">{item}</div>)}
                                </div>
                            </div>
                            <div>
                                <div className="ax-work-kicker text-[var(--ax-text-faint)]">Included structure</div>
                                <div className="mt-3 divide-y divide-[var(--ax-work-line)] border-y border-[var(--ax-work-line)]">
                                    {selectedAddOns.length ? selectedAddOns.map((addOn) => (
                                        <div key={addOn.id} className="py-2.5"><div className="text-[11px] font-semibold text-[var(--ax-text)]">{addOn.title}</div><div className="mt-1 text-[10px] leading-5 text-[var(--ax-text-faint)]">{addOn.description}</div></div>
                                    )) : <div className="py-3 text-[10px] leading-5 text-[var(--ax-text-faint)]">Core professional structure. Add sections later when the manuscript needs them.</div>}
                                </div>
                            </div>
                        </div>

                        <button type="button" onClick={() => openDraftWithTemplate(selectedTemplate.id)} className="mt-8 inline-flex h-10 items-center gap-2 rounded-[var(--ax-work-control-radius)] bg-[var(--ax-accent-strong)] px-5 text-[11px] font-semibold text-white hover:bg-[var(--ax-accent)]">
                            Start this document <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </aside>
                </div>
            </div>
        </div>
    );
}
