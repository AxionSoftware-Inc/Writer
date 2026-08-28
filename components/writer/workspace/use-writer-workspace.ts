"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

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
import {
    compileWriterProjectSections,
    createWriterProjectSection,
    ensureWriterProjectSections,
    getWriterSectionKey,
    normalizeWriterProjectSections,
    type WriterProjectSection,
} from "@/lib/writer-project";
import { analyzeWriterDocument, type WriterRevisionSnapshot } from "@/lib/writer-intelligence";
import type { WriterTemplate } from "@/lib/writer-templates";
import { useWriterLabDependencies } from "./use-writer-lab-dependencies";
import { useWriterLayout } from "./use-writer-layout";
import { useWriterRevisions } from "./use-writer-revisions";
import {
    buildSavedResultImportSnippet,
    createSnapshotDocument,
    createTemplateDocument,
    insertAtSelection,
    insertCitationAtSelection,
    replaceSavedResultImport,
} from "./workspace-transforms";
import type { OutdatedLabImport, WriterWorkspaceController, WriterWorkspaceProps } from "./workspace-types";

const CONTENT_SYNC_DELAY_MS = 160;
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

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const latestFormDataRef = useRef(formData);
    const isInternalContentSyncRef = useRef(false);
    const hostReadyKeyRef = useRef<string | null>(null);

    const hostContext = useMemo<WriterHostContext>(
        () => ({ documentId, mode, hostId: host.id }),
        [documentId, host.id, mode],
    );
    const resolvedBackHref = host.resolveBackHref?.(hostContext) ?? backHref;

    const normalizedSections = useMemo(() => ensureWriterProjectSections(formData), [formData]);
    const [activeSectionId, setActiveSectionId] = useState(() => getWriterSectionKey(normalizedSections[0]));
    const activeSection =
        normalizedSections.find((section) => getWriterSectionKey(section) === activeSectionId) ?? normalizedSections[0];

    const [showMeta, setShowMeta] = useState(true);
    const [inspectorSection, setInspectorSectionState] = useState<WriterInspectorSection>("navigator");
    const [editorContent, setEditorContent] = useState(activeSection?.content ?? "");
    const [previewContent, setPreviewContent] = useState(
        compileWriterProjectSections(normalizedSections, {
            brandingEnabled: formData.branding_enabled,
            brandingLabel: formData.branding_label,
        }),
    );
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

    const setInspectorSection = useCallback((panel: WriterInspectorSection) => {
        setInspectorSectionState(panel);
        layout.setShowInspector(true);
    }, [layout.setShowInspector]);

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

    const createRevisionSnapshotFromCurrent = useCallback((label: string) => {
        const nextSections = getSectionsWithCurrentDraft();
        return revisions.createSnapshot({
            label,
            title: latestFormDataRef.current.title,
            abstract: latestFormDataRef.current.abstract,
            content: compileProjectContent(nextSections),
            sectionCount: nextSections.length,
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, revisions.createSnapshot]);

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

    const activateSection = useCallback((section: WriterProjectSection) => {
        const sectionId = getWriterSectionKey(section);
        setActiveSectionId(sectionId);
        latestEditorContentRef.current = section.content;
        lastCommittedContentRef.current = section.content;
        setEditorContent(section.content);
        void emitWriterHostEvent(host, { type: "writer.section.changed", context: hostContext, sectionId });
    }, [host, hostContext]);

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
        activateSection(nextSection);
    }, [activateSection, compileProjectContent, getSectionsWithCurrentDraft, onChange]);

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
        activateSection(createdSection);
    }, [activateSection, compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

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
        activateSection(duplicateSection);
    }, [activateSection, activeSection, compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

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
        syncFullDocument({ ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) });
        activateSection(nextSections[0]);
    }, [activateSection, compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

    const handleUpdateActiveSection = useCallback((patch: Partial<WriterProjectSection>) => {
        const nextSections = getSectionsWithCurrentDraft().map((section) =>
            getWriterSectionKey(section) === getWriterSectionKey(activeSection) ? { ...section, ...patch } : section,
        );
        syncFullDocument(
            { ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) },
            { syncPreview: false },
        );
    }, [activeSection, compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

    const updateEditorContent = useCallback((nextContent: string, cursor?: number) => {
        latestEditorContentRef.current = nextContent;
        setEditorContent(nextContent);
        if (layout.previewSyncMode === "live") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
        }
        if (typeof cursor === "number") {
            requestAnimationFrame(() => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                textarea.focus();
                textarea.selectionStart = cursor;
                textarea.selectionEnd = cursor;
            });
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, layout.previewSyncMode]);

    const insertSnippet = useCallback((snippet: string) => {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;
        if (!textarea) {
            updateEditorContent(`${currentContent}${snippet}`);
            return;
        }
        const result = insertAtSelection(currentContent, snippet, textarea.selectionStart, textarea.selectionEnd);
        updateEditorContent(result.content, result.cursor);
    }, [updateEditorContent]);

    const handleImportSavedLaboratoryResult = useCallback((payload: WriterImportPayload) => {
        insertSnippet(`\n${buildSavedResultImportSnippet(payload)}\n`);
    }, [insertSnippet]);

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
    }, [compileProjectContent, getSectionsWithCurrentDraft, layout.previewSyncMode, syncFullDocument, updateEditorContent]);

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
    }, [updateEditorContent]);

    const applyTemplate = useCallback((template: WriterTemplate) => {
        const shouldReplace =
            !latestEditorContentRef.current.trim() ||
            window.confirm("Hozirgi matn o'rniga tanlangan professional andoza qo'yilsinmi?");
        if (!shouldReplace) return;
        const next = createTemplateDocument(latestFormDataRef.current, template);
        syncFullDocument(next.document);
        activateSection(next.section);
    }, [activateSection, syncFullDocument]);

    const handleRestoreSnapshot = useCallback((snapshot: WriterRevisionSnapshot) => {
        const next = createSnapshotDocument(latestFormDataRef.current, snapshot);
        syncFullDocument(next.document);
        activateSection(next.section);
    }, [activateSection, syncFullDocument]);

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
    }, [compileProjectContent, getSectionsWithCurrentDraft, host, hostContext, layout]);

    const setField = useCallback(<K extends keyof WriterDocument>(field: K, value: WriterDocument[K]) => {
        const next = { ...latestFormDataRef.current, [field]: value };
        latestFormDataRef.current = next;
        onChange(next);
    }, [onChange]);

    useEffect(() => {
        latestFormDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        latestEditorContentRef.current = editorContent;
    }, [editorContent]);

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
        if (layout.previewSyncMode !== "live") return;
        const timeoutId = window.setTimeout(() => {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        }, PREVIEW_SYNC_DELAY_MS);
        return () => window.clearTimeout(timeoutId);
    }, [compileProjectContent, editorContent, getSectionsWithCurrentDraft, layout.previewSyncMode]);

    useEffect(() => {
        if (layout.viewMode === "preview" && layout.previewSyncMode === "manual") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, layout.previewSyncMode, layout.viewMode]);

    useEffect(() => {
        const readyKey = `${host.id}:${mode}:${documentId ?? ""}`;
        if (hostReadyKeyRef.current === readyKey) return;
        hostReadyKeyRef.current = readyKey;
        void emitWriterHostEvent(host, { type: "writer.ready", context: hostContext });
    }, [documentId, host, hostContext, mode]);

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
                    layout.setViewMode(command.view);
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
    }, [handleSave, host, insertSnippet, layout.setViewMode, refreshPreview, setInspectorSection, syncFullDocument]);

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
        insertSnippet,
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
