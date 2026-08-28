/* eslint-disable react/no-unescaped-entities */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    BookOpen,
    Check,
    FlaskConical,
    GraduationCap,
    Newspaper,
    ScrollText,
    X,
} from "lucide-react";

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 lg:p-8">
            <button
                type="button"
                aria-label="Close template picker"
                className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="relative grid max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl lg:grid-cols-[310px_minmax(0,1fr)]">
                <section className="flex min-h-0 flex-col border-b border-border/60 bg-muted/10 lg:border-b-0 lg:border-r">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">New document</div>
                            <h2 className="mt-1 text-base font-black tracking-tight">Choose a template</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:hidden"
                            type="button"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                        <div className="space-y-1">
                            {writerTemplates.map((template) => {
                                const Icon = iconMap[template.icon];
                                const selected = template.id === selectedTemplate.id;

                                return (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                            selected
                                                ? "border-foreground/15 bg-foreground text-background"
                                                : "border-transparent hover:border-border/60 hover:bg-background"
                                        }`}
                                    >
                                        <span
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                                selected ? "border-background/20 bg-background/10" : template.accentClassName
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-bold">{template.title}</span>
                                            <span
                                                className={`mt-0.5 block text-[9px] font-bold uppercase tracking-[0.12em] ${
                                                    selected ? "text-background/55" : "text-muted-foreground"
                                                }`}
                                            >
                                                {templateCategoryLabel(template.category)}
                                            </span>
                                        </span>
                                        {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-border/60 px-4 py-3 text-[10px] leading-5 text-muted-foreground">
                        {writerTemplates.length} professional starting structures. You can still edit every section later.
                    </div>
                </section>

                <section className="min-h-0 overflow-y-auto bg-background">
                    <div className="sticky top-0 z-10 flex items-center justify-end border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
                        <button
                            onClick={onClose}
                            className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:flex"
                            type="button"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mx-auto max-w-2xl p-5 sm:p-7 lg:p-9">
                        <div className="flex items-start justify-between gap-4">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${selectedTemplate.accentClassName}`}>
                                <SelectedIcon className="h-5 w-5" />
                            </div>
                            <span className="rounded-md border border-border/60 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                {templateCategoryLabel(selectedTemplate.category)}
                            </span>
                        </div>

                        <h3 className="mt-5 font-serif text-3xl font-black tracking-tight sm:text-4xl">{selectedTemplate.title}</h3>
                        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{selectedTemplate.description}</p>

                        <div className="mt-7 grid gap-6 sm:grid-cols-2">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Best for</div>
                                <div className="mt-3 space-y-2">
                                    {selectedTemplate.recommendedFor.slice(0, 5).map((item) => (
                                        <div key={item} className="flex items-start gap-2 text-sm leading-6 text-foreground/80">
                                            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Included structure</div>
                                <div className="mt-3 space-y-2">
                                    {selectedAddOns.length ? (
                                        selectedAddOns.slice(0, 5).map((addOn) => (
                                            <div key={addOn.id} className="border-b border-border/50 pb-2 last:border-0">
                                                <div className="text-sm font-semibold">{addOn.title}</div>
                                                <div className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{addOn.description}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm leading-6 text-muted-foreground">
                                            A clean core structure without mandatory add-ons.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-xl border border-border/60 bg-muted/10 p-4">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div>
                                    <div className="text-lg font-black">{selectedTemplate.recommendedFor.length}</div>
                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Use cases</div>
                                </div>
                                <div className="border-x border-border/60">
                                    <div className="text-lg font-black">{selectedAddOns.length}</div>
                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Add-ons</div>
                                </div>
                                <div>
                                    <div className="text-lg font-black">1</div>
                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Workspace</div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => openDraftWithTemplate(selectedTemplate.id)}
                            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-bold text-background transition-opacity hover:opacity-92"
                        >
                            Start with this template
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
