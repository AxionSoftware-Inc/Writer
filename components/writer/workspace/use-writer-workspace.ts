"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { buildChangeImpactMap } from "@/lib/computational-integrity";
import {
    analyzeWriterDocumentContent,
    buildWriterSnapshotStorageKey,
    splitWriterCommaValues,
    type WriterDocument,
    type WriterInspectorSection,
    type WriterPreviewSyncMode,
    type WriterViewMode,
} from "@/lib/writer-document";
import { defaultWriterHost, emitWriterHostEvent, type WriterHostContext } from "@/lib/writer-integration";
import {
    createWriterImportPayloadFromSavedResult,
    fetchSavedLaboratoryResult,
} from "@/lib/laboratory-results";
import {
    extractWriterBridgeBlocks,
    serializeWriterBridgeBlock,
    type WriterImportPayload,
} from "@/lib/live-writer-bridge";
import {
    compileWriterProjectSections,
    createWriterProjectSection,
    ensureWriterProjectSections,
    getWriterSectionKey,
    normalizeWriterProjectSections,
    type WriterProjectSection,
} from "@/lib/writer-project";
import {
    analyzeWriterDocument,
    compareWriterRevisions,
    createWriterRevisionSnapshot,
    type WriterRevisionSnapshot,
} from "@/lib/writer-intelligence";
import type { WriterTemplate } from "@/lib/writer-templates";
import type { OutdatedLabImport, WriterWorkspaceController, WriterWorkspaceProps } from "./workspace-types";

const CONTENT_SYNC_DELAY_MS = 160;
const PREVIEW_SYNC_DELAY_MS = 260;
const LARGE_DOCUMENT_CHARACTER_THRESHOLD = 45000;
const LARGE_DOCUMENT_WORD_THRESHOLD = 7000;
const HEAVY_PLOT_THRESHOLD = 6;
const HEAVY_3D_PLOT_THRESHOLD = 2;
const DEFAULT_SIDEBAR_WIDTH = 352;
const LARGE_SCREEN_SIDEBAR_WIDTH = 384;
const MIN_SIDEBAR_WIDTH = 332;
const MAX_SIDEBAR_WIDTH = 430;
const SPLIT_VIEW_BREAKPOINT = 1360;
const RESIZABLE_SIDEBAR_BREAKPOINT = 1480;
const LAB_IMPORT_BLOCK_REGEX = /<!-- lab-result-import:([a-f0-9-]+):(\d+):start -->([\s\S]*?)<!-- lab-result-import:\1:end -->/gi;

function buildSavedResultImportSnippet(payload: WriterImportPayload) {
    const body = [payload.block ? serializeWriterBridgeBlock(payload.block) : "", payload.markdown]
        .filter(Boolean)
        .join("\n\n");

    if (payload.block?.savedResultId && payload.block.savedResultRevision) {
        return [
            `<!-- lab-result-import:${payload.block.savedResultId}:${payload.block.savedResultRevision}:start -->`,
            body,
            `<!-- lab-result-import:${payload.block.savedResultId}:end -->`,
        ].join("\n\n");
    }

    return body;
}

function extractSavedResultImports(content: string) {
    const imports: Array<{
        savedResultId: string;
        revision: number;
        integrity?: { sourceHash?: string; resultHash?: string; method?: string } | null;
    }> = [];

    for (const match of content.matchAll(LAB_IMPORT_BLOCK_REGEX)) {
        const block = extractWriterBridgeBlocks(match[3])[0];
        imports.push({
            savedResultId: match[1],
            revision: Number(match[2]),
            integrity: block?.integrity ?? null,
        });
    }

    return imports;
}

function downloadWriterText(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function safeRandomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `writer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useWriterWorkspace(props: WriterWorkspaceProps): WriterWorkspaceController {
    const {
        formData,
        onChange,
        onSubmit,
        saveState,
        errorMessage,
        backHref = "/",
        mode = "new",
        documentId,
        host = defaultWriterHost,
    } = props;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const workspaceShellRef = useRef<HTMLDivElement>(null);
    const splitWorkspaceRef = useRef<HTMLDivElement>(null);
    const dragModeRef = useRef<"sidebar" | "split" | null>(null);
    const latestFormDataRef = useRef(formData);
    const isInternalContentSyncRef = useRef(false);
    const hasAutoSwitchedForPerformanceRef = useRef(false);
    const hostReadyRef = useRef(false);

    const hostContext = useMemo<WriterHostContext>(
        () => ({ documentId, mode, hostId: host.id }),
        [documentId, host.id, mode],
    );
    const resolvedBackHref = host.resolveBackHref?.(hostContext) ?? backHref;

    const normalizedSections = useMemo(() => ensureWriterProjectSections(formData), [formData]);
    const [activeSectionId, setActiveSectionId] = useState(() => getWriterSectionKey(normalizedSections[0]));
    const activeSection =
        normalizedSections.find((section) => getWriterSectionKey(section) === activeSectionId) ?? normalizedSections[0];

    const [viewportWidth, setViewportWidth] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth : 1440,
    );
    const [viewMode, setViewModeState] = useState<WriterViewMode>(() =>
        typeof window !== "undefined" && window.innerWidth < 1280 ? "edit" : "split",
    );
    const [showMeta, setShowMeta] = useState(true);
    const [showInspector, setShowInspector] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
    );
    const [inspectorSection, setInspectorSectionState] = useState<WriterInspectorSection>("navigator");
    const [previewSyncMode, setPreviewSyncModeState] = useState<WriterPreviewSyncMode>(() =>
        typeof window !== "undefined" && window.innerWidth >= SPLIT_VIEW_BREAKPOINT ? "manual" : "live",
    );
    const [editorContent, setEditorContent] = useState(activeSection?.content ?? "");
    const [previewContent, setPreviewContent] = useState(
        compileWriterProjectSections(normalizedSections, {
            brandingEnabled: formData.branding_enabled,
            brandingLabel: formData.branding_label,
        }),
    );
    const [sidebarWidth, setSidebarWidth] = useState(() =>
        typeof window !== "undefined" && window.innerWidth >= 1600
            ? LARGE_SCREEN_SIDEBAR_WIDTH
            : DEFAULT_SIDEBAR_WIDTH,
    );
    const [splitRatio, setSplitRatio] = useState(52);
    const [outdatedLabImports, setOutdatedLabImports] = useState<OutdatedLabImport[]>([]);
    const [dismissedLabImportKeys, setDismissedLabImportKeys] = useState<Set<string>>(() => new Set());
    const [revisionSnapshots, setRevisionSnapshots] = useState<WriterRevisionSnapshot[]>([]);
    const [selectedSnapshotId, setSelectedSnapshotIdState] = useState<string | null>(null);

    const latestEditorContentRef = useRef(activeSection?.content ?? "");
    const lastCommittedContentRef = useRef(activeSection?.content ?? "");

    const deferredTitle = useDeferredValue(formData.title);
    const deferredAbstract = useDeferredValue(formData.abstract);
    const compiledProjectContent = useMemo(
        () =>
            compileWriterProjectSections(normalizedSections, {
                brandingEnabled: formData.branding_enabled,
                brandingLabel: formData.branding_label,
            }),
        [formData.branding_enabled, formData.branding_label, normalizedSections],
    );
    const deferredEditorContent = useDeferredValue(compiledProjectContent);
    const deferredPreviewContent = useDeferredValue(previewContent);
    const documentAnalysis = useMemo(
        () => analyzeWriterDocumentContent(deferredEditorContent),
        [deferredEditorContent],
    );

    const words = documentAnalysis.words;
    const characters = documentAnalysis.characters;
    const readingTime = Math.max(1, Math.ceil(words / 220));
    const headings = documentAnalysis.headings;
    const equations = documentAnalysis.equations;
    const codeBlocks = documentAnalysis.codeBlocks;
    const plot2DBlocks = documentAnalysis.plot2DBlocks;
    const plot3DBlocks = documentAnalysis.plot3DBlocks;
    const totalPlots = documentAnalysis.totalPlots;
    const authorList = splitWriterCommaValues(formData.authors);
    const keywordList = splitWriterCommaValues(formData.keywords);
    const performanceModeRecommended =
        characters >= LARGE_DOCUMENT_CHARACTER_THRESHOLD ||
        words >= LARGE_DOCUMENT_WORD_THRESHOLD ||
        totalPlots >= HEAVY_PLOT_THRESHOLD ||
        plot3DBlocks >= HEAVY_3D_PLOT_THRESHOLD;
    const previewIsStale = previewContent !== compiledProjectContent;
    const completionItems = [
        Boolean(formData.title.trim()),
        Boolean(formData.abstract.trim()),
        Boolean(formData.authors.trim()),
        Boolean(formData.keywords.trim()),
        words >= 250,
        headings.length >= 3,
    ];
    const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);
    const checklistItems = [
        { label: "Sarlavha", done: Boolean(formData.title.trim()) },
        { label: "Annotatsiya", done: Boolean(formData.abstract.trim()) },
        { label: "Mualliflar", done: Boolean(formData.authors.trim()) },
        { label: "Kalit so'zlar", done: Boolean(formData.keywords.trim()) },
        { label: "Kamida 250 so'z", done: words >= 250 },
        { label: "Kamida 3 bo'lim", done: headings.length >= 3 },
    ];

    const canResizeSidebar = viewportWidth >= RESIZABLE_SIDEBAR_BREAKPOINT;
    const splitViewAvailable = viewportWidth >= SPLIT_VIEW_BREAKPOINT;
    const splitLayoutEnabled = viewMode === "split" && splitViewAvailable;
    const savedResultImports = useMemo(
        () => extractSavedResultImports(compiledProjectContent),
        [compiledProjectContent],
    );
    const savedResultImportSignature = useMemo(() => JSON.stringify(savedResultImports), [savedResultImports]);
    const snapshotStorageKey = useMemo(
        () => buildWriterSnapshotStorageKey(mode, documentId, formData.title, getWriterSectionKey(normalizedSections[0])),
        [documentId, formData.title, mode, normalizedSections],
    );
    const intelligenceReport = useMemo(
        () => analyzeWriterDocument(compiledProjectContent, normalizedSections),
        [compiledProjectContent, normalizedSections],
    );
    const selectedSnapshot =
        revisionSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? revisionSnapshots[0] ?? null;
    const revisionComparison = useMemo(
        () =>
            selectedSnapshot
                ? compareWriterRevisions(
                      compiledProjectContent,
                      selectedSnapshot.content,
                      formData.abstract,
                      selectedSnapshot.abstract,
                  )
                : null,
        [compiledProjectContent, formData.abstract, selectedSnapshot],
    );

    const compileProjectContent = useCallback((sections: WriterProjectSection[]) => {
        return compileWriterProjectSections(sections, {
            brandingEnabled: latestFormDataRef.current.branding_enabled,
            brandingLabel: latestFormDataRef.current.branding_label,
        });
    }, []);

    const getSectionsWithCurrentDraft = useCallback(
        (overrideContent = latestEditorContentRef.current) =>
            normalizeWriterProjectSections(
                normalizedSections.map((section) =>
                    getWriterSectionKey(section) === getWriterSectionKey(activeSection)
                        ? { ...section, content: overrideContent }
                        : section,
                ),
            ),
        [activeSection, normalizedSections],
    );

    const setViewMode = useCallback(
        (nextView: WriterViewMode) => {
            const safeView = nextView === "split" && !splitViewAvailable ? "edit" : nextView;
            setViewModeState(safeView);
            void emitWriterHostEvent(host, { type: "writer.view.changed", context: hostContext, view: safeView });
        },
        [host, hostContext, splitViewAvailable],
    );

    const setInspectorSection = useCallback((panel: WriterInspectorSection) => {
        setInspectorSectionState(panel);
        setShowInspector(true);
    }, []);

    const setPreviewSyncMode = useCallback((modeValue: WriterPreviewSyncMode) => {
        setPreviewSyncModeState(modeValue);
    }, []);

    const syncFullDocument = useCallback(
        (next: WriterDocument, options: { syncPreview?: boolean } = {}) => {
            const nextSections = normalizeWriterProjectSections(ensureWriterProjectSections(next));
            const nextCompiledContent = compileWriterProjectSections(nextSections, {
                brandingEnabled: next.branding_enabled,
                brandingLabel: next.branding_label,
            });
            const nextData = { ...next, sections: nextSections, content: nextCompiledContent };
            const nextActiveSection =
                nextSections.find((section) => getWriterSectionKey(section) === activeSectionId) ?? nextSections[0];

            latestFormDataRef.current = nextData;
            latestEditorContentRef.current = nextActiveSection.content;
            lastCommittedContentRef.current = nextActiveSection.content;
            isInternalContentSyncRef.current = true;
            setEditorContent(nextActiveSection.content);
            if (options.syncPreview ?? true) setPreviewContent(nextCompiledContent);
            onChange(nextData);
        },
        [activeSectionId, onChange],
    );

    const refreshPreview = useCallback(() => {
        const nextSections = getSectionsWithCurrentDraft();
        setPreviewContent(compileProjectContent(nextSections));
        void emitWriterHostEvent(host, { type: "writer.preview.refreshed", context: hostContext });
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext]);

    const createRevisionSnapshotFromCurrent = useCallback(
        (label: string) => {
            const nextSections = getSectionsWithCurrentDraft();
            const nextCompiledContent = compileProjectContent(nextSections);
            const snapshot = createWriterRevisionSnapshot({
                id: safeRandomId(),
                label,
                title: latestFormDataRef.current.title,
                abstract: latestFormDataRef.current.abstract,
                content: nextCompiledContent,
                sectionCount: nextSections.length,
            });
            setRevisionSnapshots((current) =>
                [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 12),
            );
            setSelectedSnapshotIdState(snapshot.id);
            return snapshot;
        },
        [compileProjectContent, getSectionsWithCurrentDraft],
    );

    const handleSave = useCallback(async () => {
        const nextSections = getSectionsWithCurrentDraft();
        const nextData = {
            ...latestFormDataRef.current,
            sections: nextSections,
            content: compileProjectContent(nextSections),
        };
        syncFullDocument(nextData, { syncPreview: true });
        createRevisionSnapshotFromCurrent(mode === "new" ? "Manual save draft" : "Saved revision");
        await emitWriterHostEvent(host, {
            type: "writer.document.save-requested",
            context: hostContext,
            document: nextData,
        });
        await Promise.resolve(onSubmit(nextData));
        await emitWriterHostEvent(host, {
            type: "writer.document.saved",
            context: hostContext,
            document: nextData,
        });
    }, [compileProjectContent, createRevisionSnapshotFromCurrent, getSectionsWithCurrentDraft, host, hostContext, mode, onSubmit, syncFullDocument]);

    const handleSelectSection = useCallback((sectionId: string) => {
        const nextSections = getSectionsWithCurrentDraft();
        const nextSection = nextSections.find((section) => getWriterSectionKey(section) === sectionId) ?? nextSections[0];
        const nextData = {
            ...latestFormDataRef.current,
            sections: nextSections,
            content: compileProjectContent(nextSections),
        };
        latestFormDataRef.current = nextData;
        onChange(nextData);
        setActiveSectionId(sectionId);
        latestEditorContentRef.current = nextSection.content;
        lastCommittedContentRef.current = nextSection.content;
        setEditorContent(nextSection.content);
        void emitWriterHostEvent(host, {
            type: "writer.section.changed",
            context: hostContext,
            sectionId,
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, onChange]);

    const handleAddSection = useCallback(() => {
        const mergedSections = getSectionsWithCurrentDraft();
        const nextSections = normalizeWriterProjectSections([
            ...mergedSections,
            createWriterProjectSection({
                title: `Section ${mergedSections.length + 1}`,
                kind: latestFormDataRef.current.document_kind === "book" ? "chapter" : "section",
                order: mergedSections.length + 1,
                content: "",
            }),
        ]);
        const createdSection = nextSections[nextSections.length - 1];
        syncFullDocument({ ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) });
        const createdId = getWriterSectionKey(createdSection);
        setActiveSectionId(createdId);
        latestEditorContentRef.current = createdSection.content;
        lastCommittedContentRef.current = createdSection.content;
        setEditorContent(createdSection.content);
        void emitWriterHostEvent(host, { type: "writer.section.changed", context: hostContext, sectionId: createdId });
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, syncFullDocument]);

    const handleDuplicateSection = useCallback(() => {
        const mergedSections = getSectionsWithCurrentDraft();
        const currentIndex = mergedSections.findIndex(
            (section) => getWriterSectionKey(section) === getWriterSectionKey(activeSection),
        );
        const sourceSection = mergedSections[currentIndex] ?? mergedSections[mergedSections.length - 1];
        if (!sourceSection) return;

        const duplicateSection = createWriterProjectSection({
            title: `${sourceSection.title} Copy`,
            kind: sourceSection.kind,
            progress_state: sourceSection.progress_state,
            order: sourceSection.order + 1,
            content: sourceSection.content,
        });
        const nextSections = [...mergedSections];
        nextSections.splice(currentIndex + 1, 0, duplicateSection);
        const normalizedNextSections = normalizeWriterProjectSections(nextSections);
        syncFullDocument({
            ...latestFormDataRef.current,
            sections: normalizedNextSections,
            content: compileProjectContent(normalizedNextSections),
        });
        const duplicateId = getWriterSectionKey(duplicateSection);
        setActiveSectionId(duplicateId);
        latestEditorContentRef.current = duplicateSection.content;
        lastCommittedContentRef.current = duplicateSection.content;
        setEditorContent(duplicateSection.content);
        void emitWriterHostEvent(host, { type: "writer.section.changed", context: hostContext, sectionId: duplicateId });
    }, [activeSection, compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, syncFullDocument]);

    const handleMoveSection = useCallback((sectionId: string, direction: "up" | "down") => {
        const mergedSections = getSectionsWithCurrentDraft();
        const currentIndex = mergedSections.findIndex((section) => getWriterSectionKey(section) === sectionId);
        if (currentIndex < 0) return;
        const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= mergedSections.length) return;
        const nextSections = [...mergedSections];
        [nextSections[currentIndex], nextSections[nextIndex]] = [nextSections[nextIndex], nextSections[currentIndex]];
        const reorderedSections = nextSections.map((section, index) => ({ ...section, order: index + 1 }));
        syncFullDocument({
            ...latestFormDataRef.current,
            sections: normalizeWriterProjectSections(reorderedSections),
            content: compileProjectContent(reorderedSections),
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

    const handleRemoveSection = useCallback((sectionId: string) => {
        const mergedSections = getSectionsWithCurrentDraft();
        if (mergedSections.length === 1) return;
        const nextSections = normalizeWriterProjectSections(
            mergedSections.filter((section) => getWriterSectionKey(section) !== sectionId),
        );
        const nextActiveSection = nextSections[0];
        syncFullDocument({ ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) });
        const nextId = getWriterSectionKey(nextActiveSection);
        setActiveSectionId(nextId);
        latestEditorContentRef.current = nextActiveSection.content;
        lastCommittedContentRef.current = nextActiveSection.content;
        setEditorContent(nextActiveSection.content);
        void emitWriterHostEvent(host, { type: "writer.section.changed", context: hostContext, sectionId: nextId });
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, syncFullDocument]);

    const handleUpdateActiveSection = useCallback((patch: Partial<WriterProjectSection>) => {
        const nextSections = getSectionsWithCurrentDraft().map((section) =>
            getWriterSectionKey(section) === getWriterSectionKey(activeSection) ? { ...section, ...patch } : section,
        );
        syncFullDocument(
            { ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) },
            { syncPreview: false },
        );
    }, [activeSection, compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

    const insertSnippet = useCallback((snippet: string) => {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;
        if (!textarea) {
            const nextContent = `${currentContent}${snippet}`;
            latestEditorContentRef.current = nextContent;
            setEditorContent(nextContent);
            if (previewSyncMode === "live") setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextContent = `${currentContent.slice(0, start)}${snippet}${currentContent.slice(end)}`;
        latestEditorContentRef.current = nextContent;
        setEditorContent(nextContent);
        if (previewSyncMode === "live") setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
        requestAnimationFrame(() => {
            textarea.focus();
            const cursor = start + snippet.length;
            textarea.selectionStart = cursor;
            textarea.selectionEnd = cursor;
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, previewSyncMode]);

    const handleImportSavedLaboratoryResult = useCallback((payload: WriterImportPayload) => {
        insertSnippet(`\n${buildSavedResultImportSnippet(payload)}\n`);
    }, [insertSnippet]);

    const handleUpdateSavedResultImport = useCallback((item: OutdatedLabImport) => {
        const payload = createWriterImportPayloadFromSavedResult(item.latest, item.latest.structured_payload.profile || "summary");
        const nextSnippet = buildSavedResultImportSnippet(payload);
        const nextContent = latestEditorContentRef.current.replace(
            new RegExp(
                `<!-- lab-result-import:${item.savedResultId}:${item.currentRevision}:start -->[\\s\\S]*?<!-- lab-result-import:${item.savedResultId}:end -->`,
                "i",
            ),
            nextSnippet,
        );
        latestEditorContentRef.current = nextContent;
        setEditorContent(nextContent);
        const nextSections = getSectionsWithCurrentDraft(nextContent);
        syncFullDocument(
            { ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) },
            { syncPreview: previewSyncMode === "live" },
        );
    }, [compileProjectContent, getSectionsWithCurrentDraft, previewSyncMode, syncFullDocument]);

    const handleDismissSavedResultImport = useCallback((item: OutdatedLabImport) => {
        setDismissedLabImportKeys((current) => {
            const next = new Set(current);
            next.add(`${item.savedResultId}:${item.latest.revision}`);
            return next;
        });
    }, []);

    const handleInsertCitation = useCallback((citation: string, inlineRef: string) => {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;
        if (!textarea) {
            const nextContent = `${currentContent}\n\n- [${inlineRef}] ${citation}`;
            latestEditorContentRef.current = nextContent;
            setEditorContent(nextContent);
            if (previewSyncMode === "live") setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const inlineText = ` [${inlineRef}]`;
        let textWithInline = `${currentContent.slice(0, start)}${inlineText}${currentContent.slice(end)}`;
        if (!textWithInline.includes("## Ishlatilgan adabiyotlar")) textWithInline += "\n\n## Ishlatilgan adabiyotlar\n";
        const bibliographyEntry = `- [${inlineRef}] ${citation}`;
        const escapedRef = inlineRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const alreadyPresent = new RegExp(`^\\s*[-*]\\s+\\[${escapedRef}\\]\\s+`, "m").test(textWithInline);
        if (!alreadyPresent) textWithInline += `\n${bibliographyEntry}`;
        latestEditorContentRef.current = textWithInline;
        setEditorContent(textWithInline);
        if (previewSyncMode === "live") setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(textWithInline)));
        requestAnimationFrame(() => {
            textarea.focus();
            const cursor = start + inlineText.length;
            textarea.selectionStart = cursor;
            textarea.selectionEnd = cursor;
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, previewSyncMode]);

    const applyTemplate = useCallback((template: WriterTemplate) => {
        const shouldReplace =
            !latestEditorContentRef.current.trim() ||
            window.confirm("Hozirgi matn o'rniga tanlangan professional andoza qo'yilsinmi?");
        if (!shouldReplace) return;
        const section = createWriterProjectSection({
            title: template.title,
            kind: template.category === "book" || template.category === "thesis" ? "chapter" : "section",
            progress_state: "drafting",
            content: template.contentTemplate,
            order: 1,
        });
        syncFullDocument({
            ...latestFormDataRef.current,
            title: template.titleTemplate,
            abstract: template.abstractTemplate,
            keywords: template.keywords,
            document_kind: template.category === "book" || template.category === "thesis" ? "book" : "paper",
            sections: [section],
            content: template.contentTemplate,
        });
        const sectionId = getWriterSectionKey(section);
        setActiveSectionId(sectionId);
        void emitWriterHostEvent(host, { type: "writer.section.changed", context: hostContext, sectionId });
    }, [host, hostContext, syncFullDocument]);

    const handleRestoreSnapshot = useCallback((snapshot: WriterRevisionSnapshot) => {
        const restoredSection = createWriterProjectSection({
            title: latestFormDataRef.current.title || snapshot.title || "Main Draft",
            kind: latestFormDataRef.current.document_kind === "book" ? "chapter" : "section",
            progress_state: "drafting",
            content: snapshot.content,
            order: 1,
        });
        syncFullDocument({
            ...latestFormDataRef.current,
            title: snapshot.title,
            abstract: snapshot.abstract,
            sections: [restoredSection],
            content: snapshot.content,
        });
        setActiveSectionId(getWriterSectionKey(restoredSection));
    }, [syncFullDocument]);

    const exportPreflightReport = useCallback(() => {
        const lines = [
            "# Writer Preflight",
            "",
            `- title: ${formData.title || "Untitled draft"}`,
            `- status: ${intelligenceReport.preflight.status}`,
            `- score: ${intelligenceReport.preflight.score}`,
            `- words: ${words}`,
            `- sections: ${normalizedSections.length}`,
            `- equations: ${equations}`,
            `- code blocks: ${codeBlocks}`,
            "",
            "## Blockers",
            ...(intelligenceReport.preflight.blockers.length ? intelligenceReport.preflight.blockers.map((item) => `- ${item}`) : ["- none"]),
            "",
            "## Warnings",
            ...(intelligenceReport.preflight.warnings.length ? intelligenceReport.preflight.warnings.map((item) => `- ${item}`) : ["- none"]),
            "",
            "## Strengths",
            ...(intelligenceReport.preflight.strengths.length ? intelligenceReport.preflight.strengths.map((item) => `- ${item}`) : ["- none"]),
            "",
            "## Citation Audit",
            `- inline citations: ${intelligenceReport.inlineCitationKeys.length}`,
            `- bibliography entries: ${intelligenceReport.bibliographyKeys.length}`,
            `- missing bibliography keys: ${intelligenceReport.missingBibliographyKeys.join(", ") || "none"}`,
            `- unused bibliography keys: ${intelligenceReport.unusedBibliographyKeys.join(", ") || "none"}`,
        ];
        downloadWriterText("writer-preflight-report.md", lines.join("\n"));
        void emitWriterHostEvent(host, { type: "writer.export.requested", context: hostContext, format: "preflight" });
    }, [codeBlocks, equations, formData.title, host, hostContext, intelligenceReport, normalizedSections.length, words]);

    const handleExportPDF = useCallback(() => {
        setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        void emitWriterHostEvent(host, { type: "writer.export.requested", context: hostContext, format: "pdf" });
        if (viewMode === "edit") {
            setViewMode("preview");
            window.setTimeout(() => window.print(), 500);
        } else {
            window.print();
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, setViewMode, viewMode]);

    const setField = useCallback(<K extends keyof WriterDocument>(field: K, value: WriterDocument[K]) => {
        const next = { ...latestFormDataRef.current, [field]: value };
        latestFormDataRef.current = next;
        onChange(next);
    }, [onChange]);

    const startSidebarResize = useCallback(() => {
        dragModeRef.current = "sidebar";
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    const startSplitResize = useCallback(() => {
        dragModeRef.current = "split";
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    useEffect(() => {
        latestFormDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem(snapshotStorageKey);
            if (!raw) {
                setRevisionSnapshots([]);
                setSelectedSnapshotIdState(null);
                return;
            }
            const parsed = JSON.parse(raw) as WriterRevisionSnapshot[];
            const snapshots = Array.isArray(parsed) ? parsed : [];
            setRevisionSnapshots(snapshots);
            setSelectedSnapshotIdState((current) => current ?? snapshots[0]?.id ?? null);
        } catch {
            setRevisionSnapshots([]);
            setSelectedSnapshotIdState(null);
        }
    }, [snapshotStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(snapshotStorageKey, JSON.stringify(revisionSnapshots.slice(0, 12)));
    }, [revisionSnapshots, snapshotStorageKey]);

    useEffect(() => {
        let cancelled = false;
        async function checkSavedResultRevisions() {
            const uniqueImports = Array.from(new Map(savedResultImports.map((item) => [item.savedResultId, item])).values());
            if (!uniqueImports.length) {
                setOutdatedLabImports([]);
                return;
            }
            const nextOutdated: OutdatedLabImport[] = [];
            await Promise.all(
                uniqueImports.map(async (item) => {
                    try {
                        const latest = await fetchSavedLaboratoryResult(item.savedResultId);
                        const dismissKey = `${item.savedResultId}:${latest.revision}`;
                        if (latest.revision > item.revision && !dismissedLabImportKeys.has(dismissKey)) {
                            nextOutdated.push({
                                savedResultId: item.savedResultId,
                                currentRevision: item.revision,
                                latest,
                                impact: buildChangeImpactMap({
                                    currentRevision: item.revision,
                                    latestRevision: latest.revision,
                                    latestMetadata: latest.metadata,
                                    currentIntegrity: item.integrity,
                                }),
                            });
                        }
                    } catch {
                        // Advisory check: external integration failures must not block editing.
                    }
                }),
            );
            if (!cancelled) setOutdatedLabImports(nextOutdated);
        }
        void checkSavedResultRevisions();
        return () => {
            cancelled = true;
        };
    }, [dismissedLabImportKeys, savedResultImportSignature, savedResultImports]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => setViewportWidth(window.innerWidth);
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        latestEditorContentRef.current = editorContent;
    }, [editorContent]);

    useEffect(() => {
        if (viewportWidth < 1024) setShowInspector(false);
    }, [viewportWidth]);

    useEffect(() => {
        if (!splitViewAvailable && viewMode === "split") setViewModeState("edit");
    }, [splitViewAvailable, viewMode]);

    useEffect(() => {
        function handlePointerMove(event: PointerEvent) {
            if (dragModeRef.current === "sidebar" && workspaceShellRef.current) {
                const bounds = workspaceShellRef.current.getBoundingClientRect();
                setSidebarWidth(Math.min(Math.max(event.clientX - bounds.left, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH));
            }
            if (dragModeRef.current === "split" && splitWorkspaceRef.current) {
                const bounds = splitWorkspaceRef.current.getBoundingClientRect();
                const ratio = ((event.clientX - bounds.left) / bounds.width) * 100;
                setSplitRatio(Math.min(Math.max(ratio, 35), 65));
            }
        }
        function handlePointerUp() {
            dragModeRef.current = null;
            document.body.style.removeProperty("cursor");
            document.body.style.removeProperty("user-select");
        }
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, []);

    useEffect(() => {
        if (!normalizedSections.some((section) => getWriterSectionKey(section) === activeSectionId)) {
            setActiveSectionId(getWriterSectionKey(normalizedSections[0]));
        }
    }, [activeSectionId, normalizedSections]);

    useEffect(() => {
        const nextActiveContent = activeSection?.content ?? "";
        if (isInternalContentSyncRef.current && nextActiveContent === latestEditorContentRef.current) {
            isInternalContentSyncRef.current = false;
            lastCommittedContentRef.current = nextActiveContent;
            return;
        }
        if (nextActiveContent !== lastCommittedContentRef.current) {
            lastCommittedContentRef.current = nextActiveContent;
            latestEditorContentRef.current = nextActiveContent;
            const frameId = window.requestAnimationFrame(() => {
                setEditorContent(nextActiveContent);
                setPreviewContent(compiledProjectContent);
            });
            return () => window.cancelAnimationFrame(frameId);
        }
    }, [activeSection, compiledProjectContent]);

    useEffect(() => {
        if (editorContent === lastCommittedContentRef.current) return;
        const timeoutId = window.setTimeout(() => {
            const nextContent = latestEditorContentRef.current;
            const nextSections = getSectionsWithCurrentDraft(nextContent);
            isInternalContentSyncRef.current = true;
            lastCommittedContentRef.current = nextContent;
            const nextData = {
                ...latestFormDataRef.current,
                sections: nextSections,
                content: compileProjectContent(nextSections),
            };
            latestFormDataRef.current = nextData;
            onChange(nextData);
            void emitWriterHostEvent(host, {
                type: "writer.document.changed",
                context: hostContext,
                document: nextData,
            });
        }, CONTENT_SYNC_DELAY_MS);
        return () => window.clearTimeout(timeoutId);
    }, [compileProjectContent, editorContent, getSectionsWithCurrentDraft, host, hostContext, onChange]);

    useEffect(() => {
        if (previewSyncMode !== "live") return;
        const timeoutId = window.setTimeout(() => {
            const nextSections = getSectionsWithCurrentDraft();
            setPreviewContent(compileProjectContent(nextSections));
        }, PREVIEW_SYNC_DELAY_MS);
        return () => window.clearTimeout(timeoutId);
    }, [compileProjectContent, editorContent, getSectionsWithCurrentDraft, previewSyncMode]);

    useEffect(() => {
        if (splitLayoutEnabled && previewSyncMode === "live") setPreviewSyncModeState("manual");
    }, [previewSyncMode, splitLayoutEnabled]);

    useEffect(() => {
        if (performanceModeRecommended && !hasAutoSwitchedForPerformanceRef.current) {
            const timeoutId = window.setTimeout(() => {
                setPreviewSyncModeState("manual");
                if (viewMode === "split") setViewModeState("edit");
                if (window.innerWidth < 1536) setShowInspector(false);
                hasAutoSwitchedForPerformanceRef.current = true;
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
        if (!performanceModeRecommended) hasAutoSwitchedForPerformanceRef.current = false;
    }, [performanceModeRecommended, viewMode]);

    useEffect(() => {
        if (viewMode === "preview" && previewSyncMode === "manual") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, previewSyncMode, viewMode]);

    useEffect(() => {
        if (hostReadyRef.current) return;
        hostReadyRef.current = true;
        void emitWriterHostEvent(host, { type: "writer.ready", context: hostContext });
    }, [host, hostContext]);

    useEffect(() => {
        if (!host.subscribe) return;
        return host.subscribe((command) => {
            switch (command.type) {
                case "insert-markdown":
                    insertSnippet(command.markdown);
                    break;
                case "replace-document":
                    syncFullDocument(command.document);
                    break;
                case "patch-document":
                    syncFullDocument({ ...latestFormDataRef.current, ...command.patch });
                    break;
                case "open-panel":
                    setInspectorSection(command.panel);
                    break;
                case "set-view":
                    setViewMode(command.view);
                    break;
                case "refresh-preview":
                    refreshPreview();
                    break;
                case "request-save":
                    void handleSave();
                    break;
                case "focus-editor":
                    requestAnimationFrame(() => textareaRef.current?.focus());
                    break;
            }
        });
    }, [handleSave, host, insertSnippet, refreshPreview, setInspectorSection, setViewMode, syncFullDocument]);

    const statusTone =
        formData.status === "published"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    const saveStatusLabel =
        saveState === "submitting"
            ? "Saqlanmoqda"
            : saveState === "success"
              ? "Saqlangan"
              : saveState === "error"
                ? errorMessage || "Xatolik"
                : mode === "new"
                  ? "Yangi qoralama"
                  : "Tahrirlash rejimi";

    return {
        textareaRef,
        workspaceShellRef,
        splitWorkspaceRef,
        formData,
        mode,
        documentId,
        backHref: resolvedBackHref,
        saveState,
        errorMessage,
        viewMode,
        setViewMode,
        previewSyncMode,
        setPreviewSyncMode,
        showInspector,
        setShowInspector,
        inspectorSection,
        setInspectorSection,
        showMeta,
        setShowMeta,
        normalizedSections,
        activeSection,
        editorContent,
        setEditorContent,
        previewContent,
        compiledProjectContent,
        deferredTitle,
        deferredAbstract,
        deferredPreviewContent,
        words,
        characters,
        readingTime,
        headings,
        equations,
        codeBlocks,
        plot2DBlocks,
        plot3DBlocks,
        totalPlots,
        authorList,
        keywordList,
        performanceModeRecommended,
        previewIsStale,
        completion,
        checklistItems,
        canResizeSidebar,
        splitViewAvailable,
        splitLayoutEnabled,
        sidebarWidth,
        splitRatio,
        outdatedLabImports,
        revisionSnapshots,
        selectedSnapshot,
        revisionComparison,
        intelligenceReport,
        saveStatusLabel,
        statusTone,
        setField,
        startSidebarResize,
        startSplitResize,
        refreshPreview,
        handleSave,
        handleSelectSection,
        handleAddSection,
        handleDuplicateSection,
        handleMoveSection,
        handleRemoveSection,
        handleUpdateActiveSection,
        insertSnippet,
        handleImportSavedLaboratoryResult,
        handleUpdateSavedResultImport,
        handleDismissSavedResultImport,
        handleInsertCitation,
        applyTemplate,
        handleRestoreSnapshot,
        exportPreflightReport,
        createRevisionSnapshotFromCurrent,
        handleExportPDF,
        setSelectedSnapshotId: setSelectedSnapshotIdState,
    };
}
