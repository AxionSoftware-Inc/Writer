"use client";

import dynamic from "next/dynamic";
import {
    BookText,
    CheckCircle2,
    CircleDashed,
    Code2,
    FileStack,
    FunctionSquare,
    Heading,
    Layers2,
    PencilLine,
    Radar,
    Sigma,
    Sparkles,
} from "lucide-react";

import { MathKeyboard } from "@/components/math-keyboard";
import type { WriterWorkspaceController, WriterWorkspaceSlots } from "./workspace-types";

const CitationManager = dynamic(
    () => import("@/components/citation-manager").then((module) => module.CitationManager),
    { loading: () => <PanelSkeleton label="Citation tools" /> },
);

const LaboratoryResultImportPanel = dynamic(
    () => import("@/components/laboratory/laboratory-result-import-panel").then((module) => module.LaboratoryResultImportPanel),
    { loading: () => <PanelSkeleton label="Laboratory results" /> },
);

const blockPresets = [
    { label: "Bo'lim", icon: Heading, snippet: "\n## Yangi bo'lim\n\nBu yerda bo'lim mazmuni yoziladi.\n" },
    { label: "Teorema", icon: Sigma, snippet: "\n> **Teorema.** Shartlar bu yerga yoziladi.\n>\n> **Isbot.** Isbot tafsilotlari shu yerda.\n" },
    { label: "Ta'rif", icon: BookText, snippet: "\n> **Ta'rif.** Asosiy tushuncha va uning izohi.\n" },
    { label: "Formula", icon: FunctionSquare, snippet: "\n$$\n\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}\n$$\n" },
    { label: "2D Grafik", icon: Layers2, snippet: "\n```plot2d\n{\n  \"f\": \"sin(x)\",\n  \"domain\": [-10, 10],\n  \"title\": \"Sinus funksiyasi\"\n}\n```\n" },
    { label: "3D Grafik", icon: Sparkles, snippet: "\n```plot3d\n{\n  \"f\": \"sin(x)*cos(y)\",\n  \"xDomain\": [-5, 5],\n  \"yDomain\": [-5, 5],\n  \"title\": \"3D yuzasi\"\n}\n```\n" },
    { label: "Python", icon: Code2, snippet: "\n```python\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 10, 100)\ny = np.sin(x)\n\nplt.plot(x, y)\nplt.grid(True)\nplt.show()\n```\n" },
    { label: "Adabiyot", icon: FileStack, snippet: "\n## Foydalanilgan adabiyotlar\n\n1. Muallif, *Asar nomi*, yil.\n2. Muallif, *Maqola nomi*, jurnal, yil.\n" },
] as const;

export function WriterToolsInspector({
    controller,
    slots,
}: {
    controller: WriterWorkspaceController;
    slots?: WriterWorkspaceSlots;
}) {
    const {
        insertSnippet,
        outdatedLabImports,
        handleImportSavedLaboratoryResult,
        handleUpdateSavedResultImport,
        handleDismissSavedResultImport,
        handleInsertCitation,
        previewSyncMode,
        setPreviewSyncMode,
        refreshPreview,
        performanceModeRecommended,
        plot2DBlocks,
        plot3DBlocks,
        words,
        characters,
        equations,
        codeBlocks,
        completion,
        checklistItems,
    } = controller;

    return (
        <div className="space-y-3">
            <div className="site-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Editor tools</div>
                        <div className="mt-1 text-lg font-black">Insert blocks</div>
                    </div>
                    <PencilLine className="h-5 w-5 text-accent" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {blockPresets.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => insertSnippet(preset.snippet)}
                            className="site-toolbar-pill justify-start px-3 py-2 text-[10px] tracking-[0.12em]"
                        >
                            <preset.icon className="h-3 w-3" />
                            {preset.label}
                        </button>
                    ))}
                </div>
                <div className="mt-3">
                    <MathKeyboard onInsert={insertSnippet} />
                </div>
            </div>

            <LaboratoryResultImportPanel onImport={handleImportSavedLaboratoryResult} />

            {outdatedLabImports.length ? (
                <div className="site-panel border-amber-400/30 bg-amber-500/10 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">Saved result updates</div>
                    <div className="mt-1 text-lg font-black">Lab natijasi yangilangan</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Writer snapshotni o&apos;zi almashtirmaydi. Yangi revision faqat tasdiq bilan kiradi.
                    </p>
                    <div className="mt-4 space-y-3">
                        {outdatedLabImports.map((item) => (
                            <div key={`${item.savedResultId}-${item.latest.revision}`} className="rounded-2xl border border-border/60 bg-background/75 p-3">
                                <div className="text-sm font-bold">{item.latest.title}</div>
                                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Dokumentda r{item.currentRevision}, labda r{item.latest.revision}. {item.latest.summary}
                                </div>
                                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
                                    <div className="font-black">Outdated dependency</div>
                                    <div className="mt-1">{item.impact.reason}</div>
                                    {item.impact.affected.length ? (
                                        <div className="mt-2">{item.impact.affected.slice(0, 5).map((affected) => affected.label).join(" · ")}</div>
                                    ) : null}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" onClick={() => handleUpdateSavedResultImport(item)} className="rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background">
                                        Update dependent blocks
                                    </button>
                                    <button type="button" onClick={() => handleDismissSavedResultImport(item)} className="rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-muted-foreground">
                                        Keep snapshot
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <CitationManager onInsert={handleInsertCitation} />

            <div className="site-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Performance</div>
                        <div className="mt-1 text-lg font-black">Preview policy</div>
                    </div>
                    <Radar className="h-5 w-5 text-sky-500" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label="Sync" value={previewSyncMode === "live" ? "Live" : "Manual"} />
                    <Metric label="Load" value={performanceModeRecommended ? "Heavy" : "Normal"} />
                    <Metric label="2D plots" value={plot2DBlocks} />
                    <Metric label="3D plots" value={plot3DBlocks} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <SmallAction active={previewSyncMode === "live"} onClick={() => setPreviewSyncMode("live")}>Live</SmallAction>
                    <SmallAction active={previewSyncMode === "manual"} onClick={() => setPreviewSyncMode("manual")}>Manual</SmallAction>
                    <SmallAction onClick={refreshPreview}>Refresh</SmallAction>
                </div>
            </div>

            <div className="site-panel p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Document</div>
                        <div className="mt-1 text-lg font-black">Health</div>
                    </div>
                    <Sparkles className="h-5 w-5 text-teal-500" />
                </div>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${completion}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label="Words" value={words} />
                    <Metric label="Characters" value={characters} />
                    <Metric label="Equations" value={equations} />
                    <Metric label="Code blocks" value={codeBlocks} />
                </div>
                <div className="mt-3 space-y-1.5">
                    {checklistItems.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-xs">
                            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                            {item.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                    ))}
                </div>
            </div>

            {slots?.inspectorToolsEnd}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-base font-black">{value}</div>
        </div>
    );
}

function SmallAction({ children, onClick, active = false }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
    return (
        <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] ${active ? "border-foreground/20 bg-foreground text-background" : "border-border/60 bg-background text-muted-foreground hover:text-foreground"}`}>
            {children}
        </button>
    );
}

function PanelSkeleton({ label }: { label: string }) {
    return <div className="site-panel h-24 animate-pulse p-4 text-xs text-muted-foreground">{label} yuklanmoqda…</div>;
}
