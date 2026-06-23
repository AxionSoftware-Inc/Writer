/* eslint-disable react/no-unescaped-entities */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    BookOpen,
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
        if (isOpen) {
            setSelectedTemplateId(DEFAULT_WRITER_TEMPLATE_ID);
        }
    }, [isOpen]);

    const selectedTemplate =
        writerTemplates.find((template) => template.id === selectedTemplateId) ??
        writerTemplates.find((template) => template.id === DEFAULT_WRITER_TEMPLATE_ID) ??
        writerTemplates[0];

    const selectedAddOns = writerTemplateAddOns.filter((addOn) =>
        selectedTemplate.recommendedAddOnIds.includes(addOn.id),
    );
    const SelectedIcon = iconMap[selectedTemplate.icon];

    if (!isOpen) {
        return null;
    }

    const openDraftWithTemplate = (templateId: string) => {
        const query = new URLSearchParams();
        query.set("template", templateId);
        router.push(`/new?${query.toString()}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="absolute inset-0 bg-black/28" onClick={onClose} />

            <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-background shadow-xl">
                <div className="border-b border-border/60 bg-background/95 px-6 py-5 md:px-8 md:py-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="max-w-3xl">
                            <div className="site-eyebrow">Writer Templates</div>
                            <h2 className="mt-2 font-serif text-3xl font-black tracking-tight md:text-4xl">
                                Professional hujjatni to'g'ri format bilan boshlang
                            </h2>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                                Template kutubxonasi qayta tartiblandi. Endi faqat asosiy, professional va amalda
                                kerak bo'ladigan 6 ta start format qoldirilgan.
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="rounded-full border border-border/60 bg-background/80 p-2.5 text-muted-foreground transition-colors hover:text-foreground"
                            type="button"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="min-h-0 overflow-y-auto border-b border-border/60 bg-background p-5 md:p-6 xl:border-b-0 xl:border-r">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="site-eyebrow">Core Library</div>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                {writerTemplates.length} templates
                            </div>
                        </div>

                        <div className="mt-5 space-y-2.5">
                            {writerTemplates.map((template) => {
                                const Icon = iconMap[template.icon];
                                const selected = template.id === selectedTemplate.id;

                                return (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`w-full rounded-[1.2rem] border px-4 py-3.5 text-left transition-colors ${
                                            selected
                                                ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]"
                                                : "border-border/60 bg-background/70 hover:border-[var(--accent)]/20 hover:bg-background"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${template.accentClassName}`}>
                                                    <Icon className="h-4.5 w-4.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-bold tracking-tight">{template.title}</div>
                                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                        {templateCategoryLabel(template.category)}
                                                    </div>
                                                </div>
                                            </div>
                                            {selected ? (
                                                <span className="rounded-full border border-[var(--accent)]/30 bg-background/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground">
                                                    Active
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="min-h-0 overflow-y-auto bg-muted/15 p-6 md:p-8">
                        <div className="site-panel-strong p-5 md:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-[1.25rem] border ${selectedTemplate.accentClassName}`}>
                                    <SelectedIcon className="h-6 w-6" />
                                </div>
                                <span className="rounded-full border border-border/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                    {templateCategoryLabel(selectedTemplate.category)}
                                </span>
                            </div>

                            <h3 className="mt-4 font-serif text-2xl font-black">{selectedTemplate.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedTemplate.description}</p>

                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Category</div>
                                    <div className="mt-2 text-sm font-bold text-foreground">{templateCategoryLabel(selectedTemplate.category)}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Use Case</div>
                                    <div className="mt-2 text-sm font-bold text-foreground">{selectedTemplate.recommendedFor.length}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Add-ons</div>
                                    <div className="mt-2 text-sm font-bold text-foreground">{selectedAddOns.length}</div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => openDraftWithTemplate(selectedTemplate.id)}
                                className="site-button-primary mt-6 w-full"
                            >
                                Shu template bilan davom etish
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-4 grid gap-4">
                            <div className="site-panel p-4">
                                <div className="site-eyebrow">Best For</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedTemplate.recommendedFor.map((item) => (
                                        <span key={item} className="site-chip !px-3 !py-2 !text-[10px]">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="site-panel p-4">
                                <div className="site-eyebrow">Included Structure</div>
                                <div className="mt-3 space-y-2">
                                    {selectedAddOns.length ? (
                                        selectedAddOns.map((addOn) => (
                                            <div key={addOn.id} className="site-outline-card px-3 py-3">
                                                <div className="text-sm font-semibold">{addOn.title}</div>
                                                <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                                    {addOn.description}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="site-outline-card px-3 py-3 text-sm leading-6 text-muted-foreground">
                                            Bu template asosiy professional skelet bilan ochiladi. Qo'shimcha bloklar
                                            majburiy emas.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="site-panel p-4">
                                <div className="site-eyebrow">Template Note</div>
                                <div className="mt-3 rounded-[1.2rem] border border-border/60 bg-background/70 px-3 py-3 text-sm leading-6 text-muted-foreground">
                                    Har bir template edit vaqtida keyin ham almashtirilishi mumkin, lekin boshlanishida
                                    to'g'ri format tanlash writer ichidagi section strukturasini ancha silliq qiladi.
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
