"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WriterDocument } from "@/lib/writer-document";
import { emitWriterHostEvent, type WriterHostAdapter, type WriterHostContext } from "@/lib/writer-integration";
import {
    compileWriterProjectSections,
    createWriterProjectSection,
    ensureWriterProjectSections,
    getWriterSectionKey,
    normalizeWriterProjectSections,
    type WriterProjectSection,
} from "@/lib/writer-project";
import { insertAtSelection } from "./workspace-transforms";

const CONTENT_SYNC_DELAY_MS = 160;

type WriterSectionSessionParams = {
    formData: WriterDocument;
    onChange: (next: WriterDocument) => void;
    host: WriterHostAdapter;
    hostContext: WriterHostContext;
};

export function useWriterSectionSession({ formData, onChange, host, hostContext }: WriterSectionSessionParams) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const latestFormDataRef = useRef(formData);
    const isInternalContentSyncRef = useRef(false);

    const normalizedSections = useMemo(() => ensureWriterProjectSections(formData), [formData]);
    const [activeSectionId, setActiveSectionId] = useState(() => getWriterSectionKey(normalizedSections[0]));
    const activeSection =
        normalizedSections.find((section) => getWriterSectionKey(section) === activeSectionId) ?? normalizedSections[0];
    const [editorContent, setEditorContent] = useState(activeSection?.content ?? "");
    const [previewContent, setPreviewContent] = useState(
        compileWriterProjectSections(normalizedSections, {
            brandingEnabled: formData.branding_enabled,
            brandingLabel: formData.branding_label,
        }),
    );
    const latestEditorContentRef = useRef(activeSection?.content ?? "");
    const lastCommittedContentRef = useRef(activeSection?.content ?? "");

    const compiledProjectContent = useMemo(
        () =>
            compileWriterProjectSections(normalizedSections, {
                brandingEnabled: formData.branding_enabled,
                brandingLabel: formData.branding_label,
            }),
        [formData.branding_enabled, formData.branding_label, normalizedSections],
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
        const normalizedNextSections = normalizeWriterProjectSections(reorderedSections);
        syncFullDocument({
            ...latestFormDataRef.current,
            sections: normalizedNextSections,
            content: compileProjectContent(normalizedNextSections),
        });
    }, [compileProjectContent, getSectionsWithCurrentDraft, syncFullDocument]);

    const handleRemoveSection = useCallback((sectionId: string) => {
        const mergedSections = getSectionsWithCurrentDraft();
        if (mergedSections.length === 1) return;
        const currentIndex = mergedSections.findIndex((section) => getWriterSectionKey(section) === sectionId);
        const nextSections = normalizeWriterProjectSections(
            mergedSections.filter((section) => getWriterSectionKey(section) !== sectionId),
        );
        const fallbackIndex = Math.max(0, Math.min(currentIndex, nextSections.length - 1));
        syncFullDocument({ ...latestFormDataRef.current, sections: nextSections, content: compileProjectContent(nextSections) });
        activateSection(nextSections[fallbackIndex]);
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

    const updateEditorContentBase = useCallback((nextContent: string, cursor?: number) => {
        latestEditorContentRef.current = nextContent;
        setEditorContent(nextContent);
        if (typeof cursor === "number") {
            requestAnimationFrame(() => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                textarea.focus();
                textarea.selectionStart = cursor;
                textarea.selectionEnd = cursor;
            });
        }
    }, []);

    const insertSnippetBase = useCallback((snippet: string) => {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;
        if (!textarea) {
            updateEditorContentBase(`${currentContent}${snippet}`);
            return;
        }
        const result = insertAtSelection(currentContent, snippet, textarea.selectionStart, textarea.selectionEnd);
        updateEditorContentBase(result.content, result.cursor);
    }, [updateEditorContentBase]);

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
        }, CONTENT_SYNC_DELAY_MS);
        return () => window.clearTimeout(timeoutId);
    }, [compileProjectContent, editorContent, getSectionsWithCurrentDraft, onChange]);

    return {
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
    };
}
