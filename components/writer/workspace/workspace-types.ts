import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";

import type { ChangeImpactMap } from "@/lib/computational-integrity";
import type { SavedLaboratoryResult } from "@/lib/laboratory-results";
import type {
    WriterDocument,
    WriterInspectorSection,
    WriterPreviewSyncMode,
    WriterSaveState,
    WriterViewMode,
} from "@/lib/writer-document";
import type { WriterHostAdapter } from "@/lib/writer-integration";
import type { WriterImportPayload } from "@/lib/live-writer-bridge";
import type { WriterProjectSection } from "@/lib/writer-project";
import type { WriterTemplate } from "@/lib/writer-templates";
import type { WriterRevisionSnapshot, analyzeWriterDocument, compareWriterRevisions } from "@/lib/writer-intelligence";

export type WriterWorkspaceProps = {
    formData: WriterDocument;
    onChange: (next: WriterDocument) => void;
    onSubmit: (nextData?: WriterDocument) => void | Promise<void>;
    saveState: WriterSaveState;
    errorMessage: string;
    backHref?: string;
    mode?: "new" | "edit";
    documentId?: string;
    host?: WriterHostAdapter;
    slots?: WriterWorkspaceSlots;
};

export type WriterWorkspaceSlots = {
    toolbarEnd?: ReactNode;
    inspectorToolsEnd?: ReactNode;
    previewBefore?: ReactNode;
    previewAfter?: ReactNode;
};

export type OutdatedLabImport = {
    savedResultId: string;
    currentRevision: number;
    latest: SavedLaboratoryResult;
    impact: ChangeImpactMap;
};

export type WriterWorkspaceController = {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    workspaceShellRef: RefObject<HTMLDivElement | null>;
    splitWorkspaceRef: RefObject<HTMLDivElement | null>;
    formData: WriterDocument;
    mode: "new" | "edit";
    documentId?: string;
    backHref: string;
    saveState: WriterSaveState;
    errorMessage: string;
    viewMode: WriterViewMode;
    setViewMode: (value: WriterViewMode) => void;
    previewSyncMode: WriterPreviewSyncMode;
    setPreviewSyncMode: (value: WriterPreviewSyncMode) => void;
    showInspector: boolean;
    setShowInspector: Dispatch<SetStateAction<boolean>>;
    inspectorSection: WriterInspectorSection;
    setInspectorSection: (value: WriterInspectorSection) => void;
    showMeta: boolean;
    setShowMeta: Dispatch<SetStateAction<boolean>>;
    normalizedSections: WriterProjectSection[];
    activeSection: WriterProjectSection;
    editorContent: string;
    setEditorContent: Dispatch<SetStateAction<string>>;
    previewContent: string;
    compiledProjectContent: string;
    deferredTitle: string;
    deferredAbstract: string;
    deferredPreviewContent: string;
    words: number;
    characters: number;
    readingTime: number;
    headings: Array<{ level: number; title: string }>;
    equations: number;
    codeBlocks: number;
    plot2DBlocks: number;
    plot3DBlocks: number;
    totalPlots: number;
    authorList: string[];
    keywordList: string[];
    performanceModeRecommended: boolean;
    previewIsStale: boolean;
    completion: number;
    checklistItems: Array<{ label: string; done: boolean }>;
    canResizeSidebar: boolean;
    splitViewAvailable: boolean;
    splitLayoutEnabled: boolean;
    sidebarWidth: number;
    splitRatio: number;
    outdatedLabImports: OutdatedLabImport[];
    revisionSnapshots: WriterRevisionSnapshot[];
    selectedSnapshot: WriterRevisionSnapshot | null;
    revisionComparison: ReturnType<typeof compareWriterRevisions> | null;
    intelligenceReport: ReturnType<typeof analyzeWriterDocument>;
    saveStatusLabel: string;
    statusTone: string;
    setField: <K extends keyof WriterDocument>(field: K, value: WriterDocument[K]) => void;
    startSidebarResize: () => void;
    startSplitResize: () => void;
    refreshPreview: () => void;
    handleSave: () => Promise<void>;
    handleSelectSection: (sectionId: string) => void;
    handleAddSection: () => void;
    handleDuplicateSection: () => void;
    handleMoveSection: (sectionId: string, direction: "up" | "down") => void;
    handleRemoveSection: (sectionId: string) => void;
    handleUpdateActiveSection: (patch: Partial<WriterProjectSection>) => void;
    insertSnippet: (snippet: string) => void;
    handleImportSavedLaboratoryResult: (payload: WriterImportPayload) => void;
    handleUpdateSavedResultImport: (item: OutdatedLabImport) => void;
    handleDismissSavedResultImport: (item: OutdatedLabImport) => void;
    handleInsertCitation: (citation: string, inlineRef: string) => void;
    applyTemplate: (template: WriterTemplate) => void;
    handleRestoreSnapshot: (snapshot: WriterRevisionSnapshot) => void;
    exportPreflightReport: () => void;
    createRevisionSnapshotFromCurrent: (label: string) => WriterRevisionSnapshot;
    handleExportPDF: () => void;
    setSelectedSnapshotId: (id: string) => void;
};
