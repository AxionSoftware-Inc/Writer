"use client";

import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    CircleDashed,
    Eye,
    Layers2,
    Loader2,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    PencilLine,
    Printer,
    RefreshCw,
    Save,
} from "lucide-react";

import type { WriterWorkspaceController, WriterWorkspaceSlots } from "./workspace-types";

export function WriterWorkspaceToolbar({
    controller,
    slots,
}: {
    controller: WriterWorkspaceController;
    slots?: WriterWorkspaceSlots;
}) {
    const {
        backHref,
        formData,
        setField,
        showInspector,
        setShowInspector,
        viewMode,
        setViewMode,
        splitViewAvailable,
        refreshPreview,
        handleExportPDF,
        handleSave,
        saveState,
        statusTone,
    } = controller;

    return (
        <div className="site-workspace-topbar border-b-0 print:hidden">
            <div className="px-2.5 py-2 sm:px-3">
                <div className="site-toolbar-shell px-3 py-2.5">
                    <div className="flex w-full items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Link
                                href={backHref}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                aria-label="Back"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                            <div className="min-w-0 flex-1">
                                <input
                                    name="title"
                                    value={formData.title}
                                    onChange={(event) => setField("title", event.target.value)}
                                    className="h-9 w-full rounded-2xl bg-transparent text-base font-black tracking-tight outline-none placeholder:text-muted-foreground/45 md:text-xl"
                                    placeholder="Maqola sarlavhasini kiriting..."
                                />
                            </div>
                        </div>

                        <div className="min-w-0 overflow-x-auto">
                            <div className="site-toolbar-shell flex min-w-max items-center gap-2 p-1.5 pl-1">
                                <button
                                    type="button"
                                    onClick={() => setShowInspector((value) => !value)}
                                    className="site-toolbar-pill h-9 px-3 text-[11px]"
                                >
                                    {showInspector ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
                                    <span>{showInspector ? "Sidebar" : "Panels"}</span>
                                </button>

                                <div className="site-toolbar-segment">
                                    <ModeButton active={viewMode === "edit"} onClick={() => setViewMode("edit")} icon={<PencilLine className="h-3 w-3" />} label="Edit" />
                                    <ModeButton
                                        active={viewMode === "split"}
                                        onClick={() => setViewMode("split")}
                                        icon={<Layers2 className="h-3 w-3" />}
                                        label="Split"
                                        disabled={!splitViewAvailable}
                                    />
                                    <ModeButton active={viewMode === "preview"} onClick={() => setViewMode("preview")} icon={<Eye className="h-3 w-3" />} label="Preview" />
                                </div>

                                <details className="group relative">
                                    <summary className="site-toolbar-pill flex h-9 cursor-pointer list-none justify-center px-3 [&::-webkit-details-marker]:hidden" aria-label="More document actions">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </summary>
                                    <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-border/60 bg-background p-2 shadow-lg">
                                        <div className={`mb-2 inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] ${statusTone}`}>
                                            {formData.status === "published" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
                                            {formData.status === "published" ? "Published" : "Draft"}
                                        </div>
                                        <div className="space-y-2">
                                            <select
                                                value={formData.status}
                                                onChange={(event) => setField("status", event.target.value)}
                                                className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold outline-none"
                                            >
                                                <option value="draft">Qoralama</option>
                                                <option value="published">Nashrga tayyor</option>
                                            </select>
                                            <ActionButton label="Refresh preview" onClick={refreshPreview} icon={<RefreshCw className="h-3.5 w-3.5" />} />
                                            <ActionButton label="Export PDF" onClick={handleExportPDF} icon={<Printer className="h-3.5 w-3.5" />} />
                                        </div>
                                    </div>
                                </details>

                                {slots?.toolbarEnd}

                                <button
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={saveState === "submitting" || saveState === "success"}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-bold text-white transition-colors hover:opacity-95 disabled:pointer-events-none disabled:opacity-60"
                                >
                                    {saveState === "submitting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    <span>{saveState === "submitting" ? "Saqlanmoqda" : "Saqlash"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModeButton({
    active,
    onClick,
    icon,
    label,
    disabled = false,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
        >
            <span className="inline-flex items-center gap-1.5">{icon}<span>{label}</span></span>
        </button>
    );
}

function ActionButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex h-9 w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-muted/70"
        >
            <span>{label}</span>
            {icon}
        </button>
    );
}
