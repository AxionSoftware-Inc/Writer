"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import {
    analyzeWriterDocumentContent,
    buildWriterSnapshotStorageKey,
    splitWriterCommaValues,
    type WriterDocument,
    type WriterInspectorSection,
    type WriterViewMode,
} from "@/lib/writer-document";
import { defaultWriterHost, emitWriterHostEvent, type WriterHostContext } from "@/lib/writer-integration";
import { createWriterImportPayloadFromSavedResult } from "@/lib/laboratory-results";
import type { WriterImportPayload } from "@/lib/live-writer-bridge";
import { getWriterSectionKey } from "@/lib/writer-project";
import { analyzeWriterDocument, type WriterRevisionSnapshot } from "@/lib/writer-intelligence";
import type { WriterTemplate } from "@/lib/writer-templates";
import { useWriterHostBridge } from "./use-writer-host-bridge";
import { useWriterLabDependencies } from "./use-writer-lab-dependencies";
import { useWriterLayout } from "./use-writer-layout";
import { useWriterRevisions } from "./use-writer-revisions";
import { useWriterSectionSession } from "./use-writer-section-session";
import {
    buildSavedResultImportSnippet,
    createSnapshotDocument,
    createTemplateDocument,
    insertCitationAtSelection,
    replaceSavedResultImport,
} from "./workspace-transforms";
import type { OutdatedLabImport, WriterWorkspaceController, WriterWorkspaceProps } from "./workspace-types";

const PREVIEW_SYNC_DELAY_MS = 260;
const LARGE_DOCUMENT_CHARACTER_THRESHOLD = 45000;
const LARGE_DOCUMENT_WORD_THRESHOLD = 7000;
const HEAVY_PLOT_THRESHOLD = 6;
const HEAVY_3D_PLOT_THRESHOLD = 2;

function downloadWriterText(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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

    const hostContext = useMemo<WriterHostContext>(
        () => ({ documentId, mode, hostId: host.id }),
        [documentId, host.id, mode],
    );
    const resolvedBackHref = host.resolveBackHref?.(hostContext) ?? backHref;
    const [showMeta, setShowMeta] = useState(true);
    const [inspectorSection, setInspectorSectionState] = useState<WriterInspectorSection>("navigator");

    const sectionSession = useWriterSectionSession({ formData, onChange, host, hostContext });
    const {
        textareaRef,
        latestFormDataRef,
        latestEditorContentRef,
        normalizedSections,
        activeSection,
        editorContent,
        setEditorContent,
        previewContent,
        setPreviewContent,
        compiledProjectContent,
        compileProjectContent,
        getSectionsWithCurrentDraft,
        syncFullDocument,
        activateSection,
        handleSelectSection,
        handleAddSection,
        handleDuplicateSection,
        handleMoveSection,
        handleRemoveSection,
        handleUpdateActiveSection,
        updateEditorContentBase,
        insertSnippetBase,
    } = sectionSession;

    const deferredTitle = useDeferredValue(formData.title);
    const deferredAbstract = useDeferredValue(formData.abstract);
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

    const handleViewChange = useCallback(
        (view: WriterViewMode) => {
            void emitWriterHostEvent(host, { type: "writer.view.changed", context: hostContext, view });
        },
        [host, hostContext],
    );
    const layout = useWriterLayout({ performanceModeRecommended, onViewChange: handleViewChange });

    const snapshotStorageKey = useMemo(
        () => buildWriterSnapshotStorageKey(mode, documentId, formData.title, getWriterSectionKey(normalizedSections[0])),
        [documentId, formData.title, mode, normalizedSections],
    );
    const intelligenceReport = useMemo(
        () => analyzeWriterDocument(compiledProjectContent, normalizedSections),
        [compiledProjectContent, normalizedSections],
    );
    const revisions = useWriterRevisions({
        storageKey: snapshotStorageKey,
        currentContent: compiledProjectContent,
        currentAbstract: formData.abstract,
    });
    const labDependencies = useWriterLabDependencies(compiledProjectContent);

    const setInspectorSection = useCallback((panel: WriterInspectorSection) => {
        setInspectorSectionState(panel);
        layout.setShowInspector(true);
    }, [layout.setShowInspector]);

    const refreshPreview = useCallback(() => {
        const nextSections = getSectionsWithCurrentDraft();
        setPreviewContent(compileProjectContent(nextSections));
        void emitWriterHostEvent(host, { type: "writer.preview.refreshed", context: hostContext });
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, setPreviewContent]);

    const createRevisionSnapshotFromCurrent = useCallback((label: string) => {
        const nextSections = getSectionsWithCurrentDraft();
        return revisions.createSnapshot({
            label,
            title: latestFormDataRef.current.title,
            abstract: latestFormDataRef.current.abstract,
            content: compileProjectContent(nextSections),
            sectionCount: nextSections.length,
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, latestFormDataRef, revisions.createSnapshot]);

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
    }, [compileProjectContent, createRevisionSnapshotFromCurrent, getSectionsWithCurrentDraft, host, hostContext, latestFormDataRef, mode, onSubmit, syncFullDocument]);

    const updateEditorContent = useCallback((nextContent: string, cursor?: number) => {
        updateEditorContentBase(nextContent, cursor);
    }, [updateEditorContentBase]);

    const handleImportSavedLaboratoryResult = useCallback((payload: WriterImportPayload) => {
        insertSnippetBase(`\n${buildSavedResultImportSnippet(payload)}\n`);
    }, [insertSnippetBase]);

    const handleUpdateSavedResultImport = useCallback((item: OutdatedLabImport) => {
        const payload = createWriterImportPayloadFromSavedResult(item.latest, item.latest.structured_payload.profile || "summary");
        const nextContent = replaceSavedResultImport(
            latestEditorContentRef.current,
            item.savedResultId,
            item.currentRevision,
            buildSavedResultImportSnippet(payload),
        );
        updateEditorContent(nextContent);
        const nextSections = getSectionsWithCurrentDraft(nextContent);
        syncFullDocument(
            { ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) },
            { syncPreview: layout.previewSyncMode === "live" },
        );
    }, [compileProjectContent, getSectionsWithCurrentDraft, latestEditorContentRef, latestFormDataRef, layout.previewSyncMode, syncFullDocument, updateEditorContent]);

    const handleInsertCitation = useCallback((citation: string, inlineRef: string) => {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;
        if (!textarea) {
            updateEditorContent(`${currentContent}\n\n- [${inlineRef}] ${citation}`);
            return;
        }
        const result = insertCitationAtSelection(
            currentContent,
            citation,
            inlineRef,
            textarea.selectionStart,
            textarea.selectionEnd,
        );
        updateEditorContent(result.content, result.cursor);
    }, [latestEditorContentRef, textareaRef, updateEditorContent]);

    const applyTemplate = useCallback((template: WriterTemplate) => {
        const shouldReplace =
            !latestEditorContentRef.current.trim() ||
            window.confirm("Hozirgi matn o'rniga tanlangan professional andoza qo'yilsinmi?");
        if (!shouldReplace) return;
        const next = createTemplateDocument(latestFormDataRef.current, template);
        syncFullDocument(next.document);
        activateSection(next.section);
    }, [activateSection, latestEditorContentRef, latestFormDataRef, syncFullDocument]);

    const handleRestoreSnapshot = useCallback((snapshot: WriterRevisionSnapshot) => {
        const next = createSnapshotDocument(latestFormDataRef.current, snapshot);
        syncFullDocument(next.document);
        activateSection(next.section);
    }, [activateSection, latestFormDataRef, syncFullDocument]);

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
        if (layout.viewMode === "edit") {
            layout.setViewMode("preview");
            window.setTimeout(() => window.print(), 500);
        } else {
            window.print();
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, layout.setViewMode, layout.viewMode, setPreviewContent]);

    const setField = useCallback(<K extends keyof WriterDocument>(field: K, value: WriterDocument[K]) => {
        const next = { ...latestFormDataRef.current, [field]: value };
        latestFormDataRef.current = next;
        onChange(next);
    }, [latestFormDataRef, onChange]);

    useEffect(() => {
        if (layout.previewSyncMode !== "live") return;
        const timeoutId = window.setTimeout(() => {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        }, PREVIEW_SYNC_DELAY_MS);
        return () => window.clearTimeout(timeoutId);
    }, [compileProjectContent, editorContent, getSectionsWithCurrentDraft, layout.previewSyncMode, setPreviewContent]);

    useEffect(() => {
        if (layout.viewMode === "preview" && layout.previewSyncMode === "manual") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, layout.previewSyncMode, layout.viewMode, setPreviewContent]);

    const hostBridgeHandlers = useMemo(
        () => ({
            insertMarkdown: insertSnippetBase,
            replaceDocument: syncFullDocument,
            patchDocument: (patch: Partial<WriterDocument>) =>
                syncFullDocument({ ...latestFormDataRef.current, ...patch }),
            openPanel: setInspectorSection,
            setView: layout.setViewMode,
            refreshPreview,
            requestSave: handleSave,
            focusEditor: () => requestAnimationFrame(() => textareaRef.current?.focus()),
        }),
        [handleSave, insertSnippetBase, latestFormDataRef, layout.setViewMode, refreshPreview, setInspectorSection, syncFullDocument, textareaRef],
    );
    useWriterHostBridge(host, hostContext, hostBridgeHandlers);

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
        workspaceShellRef: layout.workspaceShellRef,
        splitWorkspaceRef: layout.splitWorkspaceRef,
        formData,
        mode,
        documentId,
        backHref: resolvedBackHref,
        saveState,
        errorMessage,
        viewMode: layout.viewMode,
        setViewMode: layout.setViewMode,
        previewSyncMode: layout.previewSyncMode,
        setPreviewSyncMode: layout.setPreviewSyncMode,
        showInspector: layout.showInspector,
        setShowInspector: layout.setShowInspector,
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
        canResizeSidebar: layout.canResizeSidebar,
        splitViewAvailable: layout.splitViewAvailable,
        splitLayoutEnabled: layout.splitLayoutEnabled,
        sidebarWidth: layout.sidebarWidth,
        splitRatio: layout.splitRatio,
        outdatedLabImports: labDependencies.outdated,
        revisionSnapshots: revisions.snapshots,
        selectedSnapshot: revisions.selectedSnapshot,
        revisionComparison: revisions.comparison,
        intelligenceReport,
        saveStatusLabel,
        statusTone,
        setField,
        startSidebarResize: layout.startSidebarResize,
        startSplitResize: layout.startSplitResize,
        refreshPreview,
        handleSave,
        handleSelectSection,
        handleAddSection,
        handleDuplicateSection,
        handleMoveSection,
        handleRemoveSection,
        handleUpdateActiveSection,
        insertSnippet: insertSnippetBase,
        handleImportSavedLaboratoryResult,
        handleUpdateSavedResultImport,
        handleDismissSavedResultImport: labDependencies.dismiss,
        handleInsertCitation,
        applyTemplate,
        handleRestoreSnapshot,
        exportPreflightReport,
        createRevisionSnapshotFromCurrent,
        handleExportPDF,
        setSelectedSnapshotId: (id: string) => revisions.setSelectedSnapshotId(id),
    };
}
