"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    BookText,
    CheckCircle2,
    CircleDashed,
    Code2,
    DatabaseZap,
    Eye,
    FileStack,
    FunctionSquare,
    Heading,
    Layers2,
    Loader2,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    PencilLine,
    Radar,
    Printer,
    RefreshCw,
    Save,
    ScanText,
    Sigma,
    Sparkles,
} from "lucide-react";

import { ArticleRichContent } from "@/components/article-rich-content";
import { MathKeyboard } from "@/components/math-keyboard";
import { CitationManager } from "@/components/citation-manager";
import { LaboratoryResultImportPanel } from "@/components/laboratory/laboratory-result-import-panel";
import { WriterProjectPanel } from "@/components/writer-project-panel";
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
import { writerTemplates, type WriterTemplate, type WriterTemplateIcon } from "@/lib/writer-templates";
import {
    createWriterImportPayloadFromSavedResult,
    fetchSavedLaboratoryResult,
    type SavedLaboratoryResult,
} from "@/lib/laboratory-results";
import { buildChangeImpactMap, type ChangeImpactMap } from "@/lib/computational-integrity";
import {
    analyzeWriterDocument,
    compareWriterRevisions,
    createWriterRevisionSnapshot,
    type WriterRevisionSnapshot,
} from "@/lib/writer-intelligence";

export type PaperFormData = {
    title: string;
    abstract: string;
    content: string;
    authors: string;
    keywords: string;
    document_kind: string;
    branding_enabled: boolean;
    branding_label: string;
    status: string;
    sections: WriterProjectSection[];
};

type SaveState = "idle" | "submitting" | "success" | "error";

type BlockPreset = {
    label: string;
    icon: typeof Sigma;
    snippet: string;
};

type PreviewSyncMode = "live" | "manual";
type InspectorSection = "navigator" | "tools" | "review" | "metadata" | "templates" | "outline";
type OutdatedLabImport = {
    savedResultId: string;
    currentRevision: number;
    latest: SavedLaboratoryResult;
    impact: ChangeImpactMap;
};

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

const blockPresets: BlockPreset[] = [
    {
        label: "Bo'lim",
        icon: Heading,
        snippet: "\n## Yangi bo'lim\n\nBu yerda bo'lim mazmuni yoziladi.\n",
    },
    {
        label: "Teorema",
        icon: Sigma,
        snippet: "\n> **Teorema.** Shartlar bu yerga yoziladi.\n>\n> **Isbot.** Isbot tafsilotlari shu yerda.\n",
    },
    {
        label: "Ta'rif",
        icon: BookText,
        snippet: "\n> **Ta'rif.** Asosiy tushuncha va uning izohi.\n",
    },
    {
        label: "Formula",
        icon: FunctionSquare,
        snippet: "\n$$\n\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}\n$$\n",
    },
    {
        label: "2D Grafik",
        icon: Layers2,
        snippet: "\n```plot2d\n{\n  \"f\": \"sin(x)\",\n  \"domain\": [-10, 10],\n  \"title\": \"Sinus funksiyasi\"\n}\n```\n",
    },
    {
        label: "3D Grafik",
        icon: Sparkles,
        snippet: "\n```plot3d\n{\n  \"f\": \"sin(x)*cos(y)\",\n  \"xDomain\": [-5, 5],\n  \"yDomain\": [-5, 5],\n  \"title\": \"3D yuzasi\"\n}\n```\n",
    },
    {
        label: "Python",
        icon: Code2,
        snippet: "\n```python\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 10, 100)\ny = np.sin(x)\n\nplt.plot(x, y)\nplt.grid(True)\nplt.show()\n```\n",
    },
    {
        label: "Adabiyot",
        icon: FileStack,
        snippet: "\n## Foydalanilgan adabiyotlar\n\n1. Muallif, *Asar nomi*, yil.\n2. Muallif, *Maqola nomi*, jurnal, yil.\n",
    },
];

const templateIconMap: Record<WriterTemplateIcon, typeof Sigma> = {
    "book-open": BookText,
    flask: Sparkles,
    "graduation-cap": Layers2,
    newspaper: ScanText,
    "scroll-text": Heading,
};

function splitCommaValues(value: string) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function analyzeDocumentContent(content: string) {
    const trimmedContent = content.trim();
    const words = trimmedContent ? trimmedContent.split(/\s+/).length : 0;
    const headings = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => ({
        level: match[0].match(/^#+/)?.[0].length ?? 1,
        title: match[1].trim(),
    }));
    const equations = (content.match(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g) || []).length;
    const codeBlocks = Math.floor((content.match(/```/g) || []).length / 2);
    const plot2DBlocks = (content.match(/```plot2d/g) || []).length;
    const plot3DBlocks = (content.match(/```plot3d/g) || []).length;

    return {
        words,
        characters: content.length,
        headings,
        equations,
        codeBlocks,
        plot2DBlocks,
        plot3DBlocks,
        totalPlots: plot2DBlocks + plot3DBlocks,
    };
}

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
    const imports: Array<{ savedResultId: string; revision: number; integrity?: { sourceHash?: string; resultHash?: string; method?: string } | null }> = [];
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

function buildWriterSnapshotStorageKey(mode: "new" | "edit", title: string, firstSectionKey: string) {
    const basis = `${mode}:${title || firstSectionKey || "draft"}`
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "-")
        .replace(/-+/g, "-");
    return `mathsphere_writer_snapshots::${basis}`;
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

export function PaperEditorWorkspace({
    formData,
    onChange,
    onSubmit,
    saveState,
    errorMessage,
    backHref = "/",
    mode = "new",
}: {
    formData: PaperFormData;
    onChange: (next: PaperFormData) => void;
    onSubmit: (nextData?: PaperFormData) => void | Promise<void>;
    saveState: SaveState;
    errorMessage: string;
    backHref?: string;
    mode?: "new" | "edit";
    documentId?: string;
}) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const workspaceShellRef = useRef<HTMLDivElement>(null);
    const splitWorkspaceRef = useRef<HTMLDivElement>(null);
    const dragModeRef = useRef<"sidebar" | "split" | null>(null);
    const [viewportWidth, setViewportWidth] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth : 1440,
    );
    const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">(() =>
        typeof window !== "undefined" && window.innerWidth < 1280 ? "edit" : "split",
    );
    const [showMeta, setShowMeta] = useState(true);
    const [showInspector, setShowInspector] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
    );
    const [inspectorSection, setInspectorSection] = useState<InspectorSection>("navigator");
    const [previewSyncMode, setPreviewSyncMode] = useState<PreviewSyncMode>(() =>
        typeof window !== "undefined" && window.innerWidth >= SPLIT_VIEW_BREAKPOINT ? "manual" : "live",
    );
    const latestFormDataRef = useRef(formData);
    const isInternalContentSyncRef = useRef(false);
    const hasAutoSwitchedForPerformanceRef = useRef(false);
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
    const [sidebarWidth, setSidebarWidth] = useState(() =>
        typeof window !== "undefined" && window.innerWidth >= 1600
            ? LARGE_SCREEN_SIDEBAR_WIDTH
            : DEFAULT_SIDEBAR_WIDTH,
    );
    const [splitRatio, setSplitRatio] = useState(52);
    const [outdatedLabImports, setOutdatedLabImports] = useState<OutdatedLabImport[]>([]);
    const [dismissedLabImportKeys, setDismissedLabImportKeys] = useState<Set<string>>(() => new Set());
    const [revisionSnapshots, setRevisionSnapshots] = useState<WriterRevisionSnapshot[]>([]);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
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

    const documentAnalysis = useMemo(() => analyzeDocumentContent(deferredEditorContent), [deferredEditorContent]);
    const words = documentAnalysis.words;
    const characters = documentAnalysis.characters;
    const readingTime = Math.max(1, Math.ceil(words / 220));
    const headings = documentAnalysis.headings;
    const equations = documentAnalysis.equations;
    const codeBlocks = documentAnalysis.codeBlocks;
    const plot2DBlocks = documentAnalysis.plot2DBlocks;
    const plot3DBlocks = documentAnalysis.plot3DBlocks;
    const totalPlots = documentAnalysis.totalPlots;
    const authorList = splitCommaValues(formData.authors);
    const keywordList = splitCommaValues(formData.keywords);
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
    const savedResultImports = useMemo(() => extractSavedResultImports(compiledProjectContent), [compiledProjectContent]);
    const savedResultImportSignature = useMemo(() => JSON.stringify(savedResultImports), [savedResultImports]);
    const snapshotStorageKey = useMemo(
        () => buildWriterSnapshotStorageKey(mode, formData.title, getWriterSectionKey(normalizedSections[0])),
        [formData.title, mode, normalizedSections],
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

    const getSectionsWithCurrentDraft = useCallback((overrideContent = latestEditorContentRef.current) => {
        return normalizeWriterProjectSections(
            normalizedSections.map((section) =>
                getWriterSectionKey(section) === getWriterSectionKey(activeSection)
                    ? { ...section, content: overrideContent }
                    : section,
            ),
        );
    }, [activeSection, normalizedSections]);

    useEffect(() => {
        latestFormDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        try {
            const raw = window.localStorage.getItem(snapshotStorageKey);
            if (!raw) {
                setRevisionSnapshots([]);
                setSelectedSnapshotId(null);
                return;
            }
            const parsed = JSON.parse(raw) as WriterRevisionSnapshot[];
            const snapshots = Array.isArray(parsed) ? parsed : [];
            setRevisionSnapshots(snapshots);
            setSelectedSnapshotId((current) => current ?? snapshots[0]?.id ?? null);
        } catch {
            setRevisionSnapshots([]);
            setSelectedSnapshotId(null);
        }
    }, [snapshotStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(snapshotStorageKey, JSON.stringify(revisionSnapshots.slice(0, 12)));
    }, [revisionSnapshots, snapshotStorageKey]);

    useEffect(() => {
        let cancelled = false;

        async function checkSavedResultRevisions() {
            const uniqueImports = Array.from(
                new Map(savedResultImports.map((item) => [item.savedResultId, item])).values(),
            );

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
                        // Revision checks are advisory; editing must not be blocked by network errors.
                    }
                }),
            );

            if (!cancelled) {
                setOutdatedLabImports(nextOutdated);
            }
        }

        void checkSavedResultRevisions();

        return () => {
            cancelled = true;
        };
    }, [dismissedLabImportKeys, savedResultImportSignature, savedResultImports]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        function handleResize() {
            setViewportWidth(window.innerWidth);
        }

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        latestEditorContentRef.current = editorContent;
    }, [editorContent]);

    useEffect(() => {
        if (viewportWidth < 1024) {
            setShowInspector(false);
        }
    }, [viewportWidth]);

    useEffect(() => {
        if (!splitViewAvailable && viewMode === "split") {
            setViewMode("edit");
        }
    }, [splitViewAvailable, viewMode]);

    useEffect(() => {
        function handlePointerMove(event: PointerEvent) {
            if (dragModeRef.current === "sidebar" && workspaceShellRef.current) {
                const bounds = workspaceShellRef.current.getBoundingClientRect();
                const nextWidth = Math.min(Math.max(event.clientX - bounds.left, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
                setSidebarWidth(nextWidth);
            }

            if (dragModeRef.current === "split" && splitWorkspaceRef.current) {
                const bounds = splitWorkspaceRef.current.getBoundingClientRect();
                const nextRatio = ((event.clientX - bounds.left) / bounds.width) * 100;
                setSplitRatio(Math.min(Math.max(nextRatio, 35), 65));
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
        const activeStillExists = normalizedSections.some((section) => getWriterSectionKey(section) === activeSectionId);
        if (!activeStillExists) {
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
        if (editorContent === lastCommittedContentRef.current) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const nextContent = latestEditorContentRef.current;
            const nextSections = getSectionsWithCurrentDraft(nextContent);
            isInternalContentSyncRef.current = true;
            lastCommittedContentRef.current = nextContent;
            const compiledContent = compileProjectContent(nextSections);
            const nextData = {
                ...latestFormDataRef.current,
                sections: nextSections,
                content: compiledContent,
            };
            latestFormDataRef.current = nextData;
            onChange(nextData);
        }, CONTENT_SYNC_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [activeSection, compileProjectContent, editorContent, getSectionsWithCurrentDraft, onChange]);

    useEffect(() => {
        if (previewSyncMode !== "live") {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const nextSections = getSectionsWithCurrentDraft();
            setPreviewContent(compileProjectContent(nextSections));
        }, PREVIEW_SYNC_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [activeSection, compileProjectContent, editorContent, getSectionsWithCurrentDraft, previewSyncMode]);

    useEffect(() => {
        if (splitLayoutEnabled && previewSyncMode === "live") {
            setPreviewSyncMode("manual");
        }
    }, [previewSyncMode, splitLayoutEnabled]);

    useEffect(() => {
        if (performanceModeRecommended && !hasAutoSwitchedForPerformanceRef.current) {
            const timeoutId = window.setTimeout(() => {
                setPreviewSyncMode("manual");
                if (viewMode === "split") {
                    setViewMode("edit");
                }
                if (typeof window !== "undefined" && window.innerWidth < 1536) {
                    setShowInspector(false);
                }
                hasAutoSwitchedForPerformanceRef.current = true;
            }, 0);

            return () => window.clearTimeout(timeoutId);
        }

        if (!performanceModeRecommended) {
            hasAutoSwitchedForPerformanceRef.current = false;
        }
    }, [performanceModeRecommended, viewMode]);

    useEffect(() => {
        if (viewMode === "preview" && previewSyncMode === "manual") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        }
    }, [compileProjectContent, getSectionsWithCurrentDraft, previewSyncMode, viewMode]);

    function setField<K extends keyof PaperFormData>(field: K, value: PaperFormData[K]) {
        const next = { ...latestFormDataRef.current, [field]: value };
        latestFormDataRef.current = next;
        onChange(next);
    }

    function startSidebarResize() {
        dragModeRef.current = "sidebar";
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }

    function startSplitResize() {
        dragModeRef.current = "split";
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }

    const syncFullDocument = useCallback((next: PaperFormData, options: { syncPreview?: boolean } = {}) => {
        const nextSections = normalizeWriterProjectSections(ensureWriterProjectSections(next));
        const nextCompiledContent = compileWriterProjectSections(nextSections, {
            brandingEnabled: next.branding_enabled,
            brandingLabel: next.branding_label,
        });
        const nextData = {
            ...next,
            sections: nextSections,
            content: nextCompiledContent,
        };
        const nextActiveSection =
            nextSections.find((section) => getWriterSectionKey(section) === activeSectionId) ?? nextSections[0];

        latestFormDataRef.current = nextData;
        latestEditorContentRef.current = nextActiveSection.content;
        lastCommittedContentRef.current = nextActiveSection.content;
        isInternalContentSyncRef.current = true;
        setEditorContent(nextActiveSection.content);
        if (options.syncPreview ?? true) {
            setPreviewContent(nextCompiledContent);
        }
        onChange(nextData);
    }, [activeSectionId, onChange]);

    const refreshPreview = useCallback(() => {
        const nextSections = getSectionsWithCurrentDraft();
        setPreviewContent(compileProjectContent(nextSections));
    }, [compileProjectContent, getSectionsWithCurrentDraft]);

    const createRevisionSnapshotFromCurrent = useCallback((label: string) => {
        const nextSections = getSectionsWithCurrentDraft();
        const nextCompiledContent = compileProjectContent(nextSections);
        const snapshot = createWriterRevisionSnapshot({
            id: crypto.randomUUID(),
            label,
            title: latestFormDataRef.current.title,
            abstract: latestFormDataRef.current.abstract,
            content: nextCompiledContent,
            sectionCount: nextSections.length,
        });
        setRevisionSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 12));
        setSelectedSnapshotId(snapshot.id);
        return snapshot;
    }, [compileProjectContent, getSectionsWithCurrentDraft]);

    async function handleSave() {
        const nextSections = getSectionsWithCurrentDraft();
        const nextData = {
            ...latestFormDataRef.current,
            sections: nextSections,
            content: compileProjectContent(nextSections),
        };
        syncFullDocument(nextData, { syncPreview: true });
        createRevisionSnapshotFromCurrent(mode === "new" ? "Manual save draft" : "Saved revision");
        await Promise.resolve(onSubmit(nextData));
    }

    function handleSelectSection(sectionId: string) {
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
    }

    function handleAddSection() {
        const mergedSections = getSectionsWithCurrentDraft();
        const nextSections = normalizeWriterProjectSections([
            ...mergedSections,
            createWriterProjectSection({
                title: `Section ${mergedSections.length + 1}`,
                kind: formData.document_kind === "book" ? "chapter" : "section",
                order: mergedSections.length + 1,
                content: "",
            }),
        ]);
        const createdSection = nextSections[nextSections.length - 1];
        syncFullDocument({
            ...latestFormDataRef.current,
            sections: nextSections,
            content: compileProjectContent(nextSections),
        });
        setActiveSectionId(getWriterSectionKey(createdSection));
        latestEditorContentRef.current = createdSection.content;
        lastCommittedContentRef.current = createdSection.content;
        setEditorContent(createdSection.content);
    }

    function handleDuplicateSection() {
        const mergedSections = getSectionsWithCurrentDraft();
        const currentIndex = mergedSections.findIndex(
            (section) => getWriterSectionKey(section) === getWriterSectionKey(activeSection),
        );
        const sourceSection = mergedSections[currentIndex] ?? mergedSections[mergedSections.length - 1];

        if (!sourceSection) {
            return;
        }

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
        setActiveSectionId(getWriterSectionKey(duplicateSection));
        latestEditorContentRef.current = duplicateSection.content;
        lastCommittedContentRef.current = duplicateSection.content;
        setEditorContent(duplicateSection.content);
    }

    function handleMoveSection(sectionId: string, direction: "up" | "down") {
        const mergedSections = getSectionsWithCurrentDraft();
        const currentIndex = mergedSections.findIndex((section) => getWriterSectionKey(section) === sectionId);
        if (currentIndex < 0) {
            return;
        }

        const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= mergedSections.length) {
            return;
        }

        const nextSections = [...mergedSections];
        [nextSections[currentIndex], nextSections[nextIndex]] = [nextSections[nextIndex], nextSections[currentIndex]];
        const reorderedSections = nextSections.map((section, index) => ({
            ...section,
            order: index + 1,
        }));

        syncFullDocument({
            ...latestFormDataRef.current,
            sections: normalizeWriterProjectSections(reorderedSections),
            content: compileProjectContent(reorderedSections),
        });
    }

    function handleRemoveSection(sectionId: string) {
        const mergedSections = getSectionsWithCurrentDraft();
        if (mergedSections.length === 1) {
            return;
        }

        const nextSections = normalizeWriterProjectSections(
            mergedSections.filter((section) => getWriterSectionKey(section) !== sectionId),
        );
        const nextActiveSection =
            nextSections.find((section) => getWriterSectionKey(section) !== sectionId) ?? nextSections[0];

        syncFullDocument({
            ...latestFormDataRef.current,
            sections: nextSections,
            content: compileProjectContent(nextSections),
        });
        setActiveSectionId(getWriterSectionKey(nextActiveSection));
        latestEditorContentRef.current = nextActiveSection.content;
        lastCommittedContentRef.current = nextActiveSection.content;
        setEditorContent(nextActiveSection.content);
    }

    function handleUpdateActiveSection(patch: Partial<WriterProjectSection>) {
        const nextSections = getSectionsWithCurrentDraft().map((section) =>
            getWriterSectionKey(section) === getWriterSectionKey(activeSection)
                ? { ...section, ...patch }
                : section,
        );

        syncFullDocument(
            {
                ...latestFormDataRef.current,
                sections: nextSections,
                content: compileProjectContent(nextSections),
            },
            { syncPreview: false },
        );
    }

    function insertSnippet(snippet: string) {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;

        if (!textarea) {
            const nextContent = `${currentContent}${snippet}`;
            latestEditorContentRef.current = nextContent;
            setEditorContent(nextContent);
            if (previewSyncMode === "live") {
                setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
            }
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextContent = `${currentContent.slice(0, start)}${snippet}${currentContent.slice(end)}`;

        latestEditorContentRef.current = nextContent;
        setEditorContent(nextContent);
        if (previewSyncMode === "live") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
        }

        requestAnimationFrame(() => {
            textarea.focus();
            const cursor = start + snippet.length;
            textarea.selectionStart = cursor;
            textarea.selectionEnd = cursor;
        });
    }

    function handleImportSavedLaboratoryResult(payload: WriterImportPayload) {
        insertSnippet(`\n${buildSavedResultImportSnippet(payload)}\n`);
    }

    function handleUpdateSavedResultImport(item: OutdatedLabImport) {
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
            {
                ...latestFormDataRef.current,
                sections: nextSections,
                content: compileProjectContent(nextSections),
            },
            { syncPreview: previewSyncMode === "live" },
        );
    }

    function handleDismissSavedResultImport(item: OutdatedLabImport) {
        setDismissedLabImportKeys((current) => {
            const next = new Set(current);
            next.add(`${item.savedResultId}:${item.latest.revision}`);
            return next;
        });
    }

    function openLaboratoryImportPanel() {
        setShowInspector(true);
        setInspectorSection("tools");
    }

    function handleInsertCitation(citation: string, inlineRef: string) {
        const textarea = textareaRef.current;
        const currentContent = latestEditorContentRef.current;
        if (!textarea) {
            const nextContent = `${currentContent}\n\n- [${inlineRef}] ${citation}`;
            latestEditorContentRef.current = nextContent;
            setEditorContent(nextContent);
            if (previewSyncMode === "live") {
                setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(nextContent)));
            }
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const inlineText = ` [${inlineRef}]`;

        let textWithInline = `${currentContent.slice(0, start)}${inlineText}${currentContent.slice(end)}`;
        
        if (!textWithInline.includes("## Ishlatilgan adabiyotlar")) {
            textWithInline += "\n\n## Ishlatilgan adabiyotlar\n";
        }

        const bibliographyEntry = `- [${inlineRef}] ${citation}`;
        const alreadyPresent = new RegExp(`^\\s*[-*]\\s+\\[${inlineRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s+`, "m").test(textWithInline);
        if (!alreadyPresent) {
            textWithInline += `\n${bibliographyEntry}`;
        }

        latestEditorContentRef.current = textWithInline;
        setEditorContent(textWithInline);
        if (previewSyncMode === "live") {
            setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft(textWithInline)));
        }

        requestAnimationFrame(() => {
            textarea.focus();
            const cursor = start + inlineText.length;
            textarea.selectionStart = cursor;
            textarea.selectionEnd = cursor;
        });
    }

    function applyTemplate(template: WriterTemplate) {
        const shouldReplace =
            !latestEditorContentRef.current.trim() ||
            window.confirm("Hozirgi matn o'rniga tanlangan professional andoza qo'yilsinmi?");

        if (!shouldReplace) {
            return;
        }

        syncFullDocument({
            ...latestFormDataRef.current,
            title: template.titleTemplate,
            abstract: template.abstractTemplate,
            content: template.contentTemplate,
            keywords: template.keywords,
        });
    }

    function handleRestoreSnapshot(snapshot: WriterRevisionSnapshot) {
        const restoredSection = createWriterProjectSection({
            title: latestFormDataRef.current.title || snapshot.title || "Main Draft",
            kind: formData.document_kind === "book" ? "chapter" : "section",
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
    }

    function exportPreflightReport() {
        const lines = [
            `# Writer Preflight`,
            ``,
            `- title: ${formData.title || "Untitled draft"}`,
            `- status: ${intelligenceReport.preflight.status}`,
            `- score: ${intelligenceReport.preflight.score}`,
            `- words: ${words}`,
            `- sections: ${normalizedSections.length}`,
            `- equations: ${equations}`,
            `- code blocks: ${codeBlocks}`,
            ``,
            `## Blockers`,
            ...(intelligenceReport.preflight.blockers.length ? intelligenceReport.preflight.blockers.map((item) => `- ${item}`) : ["- none"]),
            ``,
            `## Warnings`,
            ...(intelligenceReport.preflight.warnings.length ? intelligenceReport.preflight.warnings.map((item) => `- ${item}`) : ["- none"]),
            ``,
            `## Strengths`,
            ...(intelligenceReport.preflight.strengths.length ? intelligenceReport.preflight.strengths.map((item) => `- ${item}`) : ["- none"]),
            ``,
            `## Citation Audit`,
            `- inline citations: ${intelligenceReport.inlineCitationKeys.length}`,
            `- bibliography entries: ${intelligenceReport.bibliographyKeys.length}`,
            `- missing bibliography keys: ${intelligenceReport.missingBibliographyKeys.join(", ") || "none"}`,
            `- unused bibliography keys: ${intelligenceReport.unusedBibliographyKeys.join(", ") || "none"}`,
        ];
        downloadWriterText("writer-preflight-report.md", lines.join("\n"));
    }

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

    function handleExportPDF() {
        setPreviewContent(compileProjectContent(getSectionsWithCurrentDraft()));
        if (viewMode === "edit") {
            setViewMode("preview");
            // Wait for DOM to update and render the preview section
            setTimeout(() => window.print(), 500);
        } else {
            window.print();
        }
    }

    return (
        <div className="site-workspace-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden text-foreground print:bg-white print:h-auto print:overflow-visible">
            <div className="flex h-full min-h-0 flex-1 flex-col print:h-auto print:block">
                <div className="site-workspace-topbar border-b-0 print:hidden">
                    <div className="px-2.5 py-2 sm:px-3">
                        <div className="site-toolbar-shell px-3 py-2.5">
                            <div className="flex w-full items-center gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <Link
                                        href={backHref}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
                                            <button
                                                type="button"
                                                onClick={() => setViewMode("edit")}
                                                className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${viewMode === "edit" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
                                            >
                                                <PencilLine className="inline h-3 w-3 md:mr-1.5" />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode("split")}
                                                disabled={!splitViewAvailable}
                                                className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${viewMode === "split" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
                                            >
                                                <Layers2 className="inline h-3 w-3 md:mr-1.5" />
                                                <span>Split</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode("preview")}
                                                className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${viewMode === "preview" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
                                            >
                                                <Eye className="inline h-3 w-3 md:mr-1.5" />
                                                <span>Preview</span>
                                            </button>
                                        </div>

                                        <div className="site-toolbar-segment">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewSyncMode("live")}
                                                className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${previewSyncMode === "live" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
                                            >
                                                Live Sync
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewSyncMode("manual")}
                                                className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${previewSyncMode === "manual" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
                                            >
                                                Manual Sync
                                            </button>
                                        </div>

                                        <details className="group relative">
                                            <summary className="site-toolbar-pill flex h-9 cursor-pointer list-none justify-center px-3 [&::-webkit-details-marker]:hidden">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </summary>
                                            <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-border/60 bg-background p-2 shadow-lg">
                                                <div className={`mb-2 inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] ${statusTone}`}>
                                                    {formData.status === "published" ? (
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <CircleDashed className="h-3.5 w-3.5" />
                                                    )}
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
                                                    <button
                                                        type="button"
                                                        onClick={refreshPreview}
                                                        className="inline-flex h-9 w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-muted/70"
                                                    >
                                                        <span>Refresh preview</span>
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleExportPDF}
                                                        className="inline-flex h-9 w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-muted/70"
                                                    >
                                                        <span>Export PDF</span>
                                                        <Printer className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </details>

                                        <button
                                            type="button"
                                            onClick={() => void handleSave()}
                                            disabled={saveState === "submitting" || saveState === "success"}
                                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-bold text-white transition-colors hover:opacity-95 disabled:pointer-events-none disabled:opacity-60"
                                        >
                                            {saveState === "submitting" ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Saqlanmoqda</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-3.5 w-3.5" />
                                                    <span>Saqlash</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    ref={workspaceShellRef}
                    className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-muted/25 p-2 lg:flex-row lg:gap-2 print:w-full print:block print:overflow-visible print:p-0 print:bg-white"
                >
                    {showInspector && (
                    <aside
                        className="site-panel flex w-full min-h-0 shrink-0 flex-col overflow-hidden p-3 lg:h-full print:hidden"
                        style={canResizeSidebar ? { width: `${sidebarWidth}px` } : undefined}
                    >
                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                            <div className="site-panel-strong p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                                        Inspector
                                    </div>
                                    <div className="site-status-pill px-2.5 py-1 text-[10px] tracking-[0.14em]">
                                        {normalizedSections.length}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { id: "navigator", label: "Files" },
                                        { id: "tools", label: "Tools" },
                                        { id: "review", label: "Review" },
                                        { id: "metadata", label: "Meta" },
                                        { id: "templates", label: "Templates" },
                                        { id: "outline", label: "Outline" },
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setInspectorSection(item.id as InspectorSection)}
                                            className={`min-w-[5.5rem] flex-1 rounded-xl px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                                                inspectorSection === item.id
                                                    ? "bg-foreground text-background"
                                                    : "site-soft-panel text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {inspectorSection === "navigator" && (
                                <WriterProjectPanel
                                    sections={normalizedSections}
                                    activeSectionId={getWriterSectionKey(activeSection)}
                                    activeSection={activeSection}
                                    documentKind={formData.document_kind}
                                    onSelectSection={handleSelectSection}
                                    onUpdateActiveSection={handleUpdateActiveSection}
                                    onAddSection={handleAddSection}
                                    onDuplicateSection={handleDuplicateSection}
                                    onMoveSection={handleMoveSection}
                                    onRemoveSection={handleRemoveSection}
                                />
                            )}

                            {inspectorSection === "tools" && (
                                <>
                                <div className="site-panel p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                                Editor tools
                                            </div>
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
                                        <button
                                            type="button"
                                            onClick={openLaboratoryImportPanel}
                                            className="site-toolbar-pill justify-start px-3 py-2 text-[10px] tracking-[0.12em]"
                                        >
                                            <DatabaseZap className="h-3 w-3" />
                                            Import
                                        </button>
                                    </div>
                                    <div className="mt-3">
                                        <MathKeyboard onInsert={insertSnippet} />
                                    </div>
                                </div>
                                <LaboratoryResultImportPanel onImport={handleImportSavedLaboratoryResult} />
                                {outdatedLabImports.length ? (
                                    <div className="site-panel border-amber-400/30 bg-amber-500/10 p-4">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
                                            Saved result updates
                                        </div>
                                        <div className="mt-1 text-lg font-black">Lab natijasi yangilangan</div>
                                        <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                            Dokument snapshot sifatida saqlangan. Yangi revisionni faqat o&apos;zingiz tasdiqlasangiz almashtiraman.
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {outdatedLabImports.map((item) => (
                                                <div key={`${item.savedResultId}-${item.latest.revision}`} className="rounded-2xl border border-border/60 bg-background/75 p-3">
                                                    <div className="text-sm font-bold">{item.latest.title}</div>
                                                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                                        Dokumentda r{item.currentRevision}, labda r{item.latest.revision}. {item.latest.summary}
                                                    </div>
                                                    <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
                                                        <div className="font-black">This report section is outdated.</div>
                                                        <div className="mt-1">Reason: {item.impact.reason}</div>
                                                        {item.impact.affected.length ? (
                                                            <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                                                {item.impact.affected.slice(0, 6).map((affected) => (
                                                                    <div key={affected.label} className="font-semibold">
                                                                        - {affected.label}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateSavedResultImport(item)}
                                                            className="rounded-2xl bg-foreground px-3 py-2 text-xs font-bold text-background transition hover:opacity-90"
                                                        >
                                                            Update all dependent blocks
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDismissSavedResultImport(item)}
                                                            className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-foreground hover:text-foreground"
                                                        >
                                                            Keep snapshot
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                <CitationManager onInsert={handleInsertCitation} />
                            <div className="site-panel mt-4 p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                            Performance
                                        </div>
                                        <div className="mt-1 text-lg font-black">Preview</div>
                                    </div>
                                    <Radar className="h-5 w-5 text-sky-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Preview sync</div>
                                        <div className="mt-1 text-base font-black">{previewSyncMode === "live" ? "Live" : "Manual"}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Document load</div>
                                        <div className="mt-1 text-base font-black">{performanceModeRecommended ? "Heavy" : "Normal"}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">2D grafik</div>
                                        <div className="mt-1 text-base font-black">{plot2DBlocks}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">3D grafik</div>
                                        <div className="mt-1 text-base font-black">{plot3DBlocks}</div>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewSyncMode("live")}
                                        className={`rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                                            previewSyncMode === "live"
                                                ? "bg-[var(--accent-soft)] text-accent border border-accent/20"
                                                : "border border-border/60 bg-background text-muted-foreground hover:border-accent/25 hover:text-foreground"
                                        }`}
                                    >
                                        Live preview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewSyncMode("manual")}
                                        className={`rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                                            previewSyncMode === "manual"
                                                ? "bg-[var(--accent-soft)] text-accent border border-accent/20"
                                                : "border border-border/60 bg-background text-muted-foreground hover:border-accent/25 hover:text-foreground"
                                        }`}
                                    >
                                        Manual preview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={refreshPreview}
                                        className="rounded-2xl border border-border/60 bg-background px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent/25 hover:text-foreground"
                                    >
                                        Refresh preview
                                    </button>
                                </div>
                            </div>
                            <div className="site-panel p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                            Stats
                                        </div>
                                        <div className="mt-1 text-lg font-black">Document</div>
                                    </div>
                                    <Sparkles className="h-5 w-5 text-teal-500" />
                                </div>
                                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 transition-all"
                                        style={{ width: `${completion}%` }}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">So&apos;zlar</div>
                                        <div className="mt-1 text-lg font-black">{words}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Belgilar</div>
                                        <div className="mt-1 text-lg font-black">{characters}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Tenglamalar</div>
                                        <div className="mt-1 text-lg font-black">{equations}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                                        <div className="text-xs text-muted-foreground">Code blok</div>
                                        <div className="mt-1 text-lg font-black">{codeBlocks}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="site-panel p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                            Checklist
                                        </div>
                                        <div className="mt-1 text-lg font-black">Ready state</div>
                                    </div>
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div className="space-y-2">
                                    {checklistItems.map((item) => (
                                        <div
                                            key={item.label}
                                            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                                                item.done
                                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                    : "border-border/60 bg-muted/10 text-muted-foreground"
                                            }`}
                                        >
                                            <span>{item.label}</span>
                                            {item.done ? (
                                                <CheckCircle2 className="h-4 w-4" />
                                            ) : (
                                                <CircleDashed className="h-4 w-4" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                                </>
                            )}

                            {inspectorSection === "review" && (
                                <>
                                <div className="site-panel p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                                Preflight
                                            </div>
                                            <div className="mt-1 text-lg font-black">Publication readiness</div>
                                        </div>
                                        <div className={`site-status-pill px-3 py-1 ${intelligenceReport.preflight.status === "ready" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : intelligenceReport.preflight.status === "review" ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                                            {intelligenceReport.preflight.status}
                                        </div>
                                    </div>
                                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 transition-all" style={{ width: `${intelligenceReport.preflight.score}%` }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="site-soft-panel rounded-2xl bg-background/80 p-3">
                                            <div className="text-xs text-muted-foreground">Score</div>
                                            <div className="mt-1 text-lg font-black">{intelligenceReport.preflight.score}</div>
                                        </div>
                                        <div className="site-soft-panel rounded-2xl bg-background/80 p-3">
                                            <div className="text-xs text-muted-foreground">References</div>
                                            <div className="mt-1 text-lg font-black">{intelligenceReport.bibliographyKeys.length}</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {intelligenceReport.preflight.blockers.map((item) => (
                                            <div key={item} className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                                                {item}
                                            </div>
                                        ))}
                                        {intelligenceReport.preflight.warnings.map((item) => (
                                            <div key={item} className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                                                {item}
                                            </div>
                                        ))}
                                        {!intelligenceReport.preflight.blockers.length && !intelligenceReport.preflight.warnings.length ? (
                                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                                                No blocking publication issues detected.
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button type="button" onClick={exportPreflightReport} className="site-btn px-4 text-xs">Export preflight</button>
                                        <button type="button" onClick={() => createRevisionSnapshotFromCurrent("Checkpoint snapshot")} className="site-btn-accent px-4 text-xs">Create snapshot</button>
                                    </div>
                                </div>

                                <div className="site-panel p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                                Citation audit
                                            </div>
                                            <div className="mt-1 text-lg font-black">Reference integrity</div>
                                        </div>
                                        <BookText className="h-5 w-5 text-indigo-500" />
                                    </div>
                                    <div className="grid gap-2 text-sm">
                                        <div className="site-soft-panel rounded-2xl bg-background/80 px-4 py-3">In-text citations: <span className="font-black">{intelligenceReport.inlineCitationKeys.length}</span></div>
                                        <div className="site-soft-panel rounded-2xl bg-background/80 px-4 py-3">Bibliography entries: <span className="font-black">{intelligenceReport.bibliographyKeys.length}</span></div>
                                        <div className={`rounded-2xl border px-4 py-3 ${intelligenceReport.missingBibliographyKeys.length ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                                            Missing bibliography keys: {intelligenceReport.missingBibliographyKeys.join(", ") || "none"}
                                        </div>
                                        <div className={`rounded-2xl border px-4 py-3 ${intelligenceReport.unusedBibliographyKeys.length ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                                            Unused bibliography keys: {intelligenceReport.unusedBibliographyKeys.join(", ") || "none"}
                                        </div>
                                    </div>
                                </div>

                                <div className="site-panel p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                                Revision compare
                                            </div>
                                            <div className="mt-1 text-lg font-black">Snapshot review</div>
                                        </div>
                                        <RefreshCw className="h-5 w-5 text-sky-500" />
                                    </div>
                                    {revisionSnapshots.length ? (
                                        <>
                                            <select
                                                value={selectedSnapshot?.id ?? ""}
                                                onChange={(event) => setSelectedSnapshotId(event.target.value)}
                                                className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent/30"
                                            >
                                                {revisionSnapshots.map((snapshot) => (
                                                    <option key={snapshot.id} value={snapshot.id}>
                                                        {snapshot.label} - {new Date(snapshot.createdAt).toLocaleString()}
                                                    </option>
                                                ))}
                                            </select>
                                            {revisionComparison ? (
                                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                    <div className="site-soft-panel rounded-2xl bg-background/80 p-3">
                                                        <div className="text-xs text-muted-foreground">Added words</div>
                                                        <div className="mt-1 text-lg font-black">{revisionComparison.addedWords}</div>
                                                    </div>
                                                    <div className="site-soft-panel rounded-2xl bg-background/80 p-3">
                                                        <div className="text-xs text-muted-foreground">Removed words</div>
                                                        <div className="mt-1 text-lg font-black">{revisionComparison.removedWords}</div>
                                                    </div>
                                                    <div className="site-soft-panel rounded-2xl bg-background/80 p-3">
                                                        <div className="text-xs text-muted-foreground">Heading delta</div>
                                                        <div className="mt-1 text-lg font-black">{revisionComparison.headingDelta}</div>
                                                    </div>
                                                    <div className="site-soft-panel rounded-2xl bg-background/80 p-3">
                                                        <div className="text-xs text-muted-foreground">Equation delta</div>
                                                        <div className="mt-1 text-lg font-black">{revisionComparison.equationDelta}</div>
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button type="button" onClick={() => selectedSnapshot && handleRestoreSnapshot(selectedSnapshot)} className="site-btn px-4 text-xs">Restore snapshot</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                                            Hali snapshot yo&apos;q. Save yoki `Create snapshot` orqali compare bazasini yarating.
                                        </div>
                                    )}
                                </div>

                                <div className="site-panel p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                                Intelligence
                                            </div>
                                            <div className="mt-1 text-lg font-black">Consistency checks</div>
                                        </div>
                                        <Sparkles className="h-5 w-5 text-teal-500" />
                                    </div>
                                    <div className="space-y-2">
                                        {intelligenceReport.duplicateHeadingTitles.map((item) => (
                                            <div key={item.title} className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                                                Duplicate heading: {item.title} ({item.count}x)
                                            </div>
                                        ))}
                                        {intelligenceReport.undefinedSymbolCandidates.map((item) => (
                                            <div key={item.symbol} className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                                                Symbol definition review: {item.symbol} appears {item.count} times without an obvious definition cue.
                                            </div>
                                        ))}
                                        {!intelligenceReport.duplicateHeadingTitles.length && !intelligenceReport.undefinedSymbolCandidates.length ? (
                                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                                                No structural consistency issues were detected in the current draft.
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                </>
                            )}

                            {inspectorSection === "metadata" && (
                            <div className="site-panel-strong p-4">
                                <button
                                    type="button"
                                    onClick={() => setShowMeta((value) => !value)}
                                    className="flex w-full items-center justify-between"
                                >
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                            Meta
                                        </div>
                                        <div className="mt-1 text-lg font-black">Document info</div>
                                    </div>
                                    <ScanText className={`h-5 w-5 transition-transform ${showMeta ? "rotate-0" : "-rotate-90"}`} />
                                </button>

                                {showMeta && (
                                    <div className="mt-4 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                Mualliflar
                                            </label>
                                            <input
                                                value={formData.authors}
                                                onChange={(event) => setField("authors", event.target.value)}
                                                placeholder="Masalan: A. Karimov, M. Qodirov"
                                                className="w-full rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500/40"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                Kalit so&apos;zlar
                                            </label>
                                            <input
                                                value={formData.keywords}
                                                onChange={(event) => setField("keywords", event.target.value)}
                                                placeholder="algebra, topology, PDE"
                                                className="w-full rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500/40"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                Annotatsiya
                                            </label>
                                            <textarea
                                                value={formData.abstract}
                                                onChange={(event) => setField("abstract", event.target.value)}
                                                rows={5}
                                                placeholder="Qisqa, ilmiy va aniq abstract yozing..."
                                                className="w-full rounded-3xl border border-border/60 bg-muted/10 px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-teal-500/40"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                Hujjat turi
                                            </label>
                                            <select
                                                value={formData.document_kind}
                                                onChange={(event) => setField("document_kind", event.target.value)}
                                                className="w-full rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500/40"
                                            >
                                                <option value="paper">Paper</option>
                                                <option value="book">Book</option>
                                                <option value="report">Report</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                <span>Branding</span>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.branding_enabled}
                                                    onChange={(event) =>
                                                        syncFullDocument({
                                                            ...latestFormDataRef.current,
                                                            branding_enabled: event.target.checked,
                                                            sections: getSectionsWithCurrentDraft(),
                                                            content: compiledProjectContent,
                                                        })
                                                    }
                                                    className="h-4 w-4"
                                                />
                                            </label>
                                            <input
                                                value={formData.branding_label}
                                                onChange={(event) =>
                                                    syncFullDocument(
                                                        {
                                                            ...latestFormDataRef.current,
                                                            branding_label: event.target.value,
                                                            sections: getSectionsWithCurrentDraft(),
                                                            content: compiledProjectContent,
                                                        },
                                                        { syncPreview: false },
                                                    )
                                                }
                                                placeholder="Powered by MathSphere Writer"
                                                className="w-full rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500/40"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            )}

                            {inspectorSection === "templates" && (
                            <div className="site-panel p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                            Templates
                                        </div>
                                        <div className="mt-1 text-lg font-black">Layouts</div>
                                    </div>
                                    <div className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                        {writerTemplates.length}
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2.5">
                                    {writerTemplates.map((template) => {
                                        const Icon = templateIconMap[template.icon];
                                        return (
                                        <button
                                            key={template.id}
                                            type="button"
                                            onClick={() => applyTemplate(template)}
                                            className="w-full rounded-[1.2rem] border border-border/60 bg-background px-3.5 py-3 text-left transition-colors hover:border-accent/30 hover:bg-muted/30"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${template.accentClassName}`}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="text-sm font-black">{template.title}</div>
                                                            <div className="rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                                {template.category}
                                                            </div>
                                                        </div>
                                                        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                                            {template.shortDescription}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="rounded-full border border-accent/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                                                    Use
                                                </div>
                                            </div>
                                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 font-semibold">
                                                    {template.recommendedFor[0]}
                                                </span>
                                            </div>
                                        </button>
                                    )})}
                                </div>
                            </div>
                            )}

                            {inspectorSection === "outline" && (
                            <div className="site-panel p-4">
                                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                    Outline
                                </div>
                                <div className="mt-1 text-lg font-black">Structure</div>
                                <div className="mt-4 space-y-2">
                                    {headings.length > 0 ? (
                                        headings.map((headingItem, index) => (
                                            <div
                                                key={`${headingItem.title}-${index}`}
                                                className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2 text-sm"
                                                style={{ marginLeft: `${(headingItem.level - 1) * 10}px` }}
                                            >
                                                {headingItem.title}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                                            Hali sarlavhali bo&apos;limlar yo&apos;q. `##` bilan bo&apos;lim oching.
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}
                        </div>
                    </aside>
                    )}
                    {showInspector && canResizeSidebar ? (
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            onPointerDown={startSidebarResize}
                            className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent-soft)] lg:flex lg:items-center print:hidden"
                        >
                            <div className="mx-auto h-12 w-[3px] rounded-full bg-border/40" />
                        </div>
                    ) : null}

                    <div
                        ref={splitWorkspaceRef}
                        className={`min-h-0 flex-1 overflow-hidden lg:gap-2 ${splitLayoutEnabled ? "grid h-full" : "grid h-full grid-cols-1"} print:block print:overflow-visible print:p-0`}
                        style={splitLayoutEnabled ? { gridTemplateColumns: `minmax(0, ${splitRatio}fr) 8px minmax(0, ${100 - splitRatio}fr)` } : undefined}
                    >
                        {(viewMode === "edit" || viewMode === "split") && (
                            <section className="site-panel flex h-full min-h-0 flex-col overflow-hidden print:hidden">
                                <div className="border-b border-border/60 bg-muted/15 px-3 py-2.5 md:px-4">
                                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="site-status-pill inline-flex px-3 py-1 text-[10px] tracking-[0.16em]">
                                                Section Editor
                                            </div>
                                            <div className="mt-1 truncate text-sm font-bold">{activeSection.title}</div>
                                        </div>
                                        <div className="site-status-pill px-3 py-1 text-[10px] tracking-[0.16em]">
                                            {activeSection.kind} / {activeSection.progress_state}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-b border-border/60 bg-muted/5 px-4 py-2 text-[10px] text-muted-foreground md:px-5">
                                    Markdown, LaTeX, `plot2d`, `plot3d` va Python bloklari shu editor ichida ishlaydi.
                                    {previewSyncMode === "live"
                                        ? " Matnni yozayotgan paytda preview avtomatik yangilanadi."
                                        : " Preview manual rejimda, shuning uchun katta hujjatda FPS barqarorroq bo'ladi."}
                                </div>

                                <div className="min-h-0 flex-1 bg-muted/10 px-2.5 py-2.5 md:px-3">
                                    <textarea
                                        ref={textareaRef}
                                        value={editorContent}
                                        onChange={(event) => setEditorContent(event.target.value)}
                                        className="min-h-full w-full flex-1 resize-none rounded-[1.35rem] border border-border/60 bg-background px-4 py-4 font-mono text-[14px] leading-7 text-foreground outline-none transition-colors focus:border-accent/30 focus:bg-background md:px-4 overflow-y-auto"
                                        placeholder="Ilmiy maqolani yozishni boshlang... Bu yerda bo'limlar, formulalar, teoremalar va grafik bloklarini yozishingiz mumkin."
                                        spellCheck={false}
                                    />
                                </div>
                            </section>
                        )}

                        {splitLayoutEnabled ? (
                            <div
                                role="separator"
                                aria-orientation="vertical"
                                onPointerDown={startSplitResize}
                                className="relative hidden cursor-col-resize items-stretch bg-transparent transition-colors hover:bg-[var(--accent-soft)] xl:flex print:hidden"
                            >
                                <div className="mx-auto h-24 w-[3px] rounded-full bg-border/40" />
                            </div>
                        ) : null}

                        {(viewMode === "preview" || viewMode === "split") && (
                            <section className="site-document-frame flex h-full min-h-0 min-w-0 flex-col overflow-hidden print:block print:w-full print:rounded-none print:border-none print:bg-white print:overflow-visible">
                                <div className="min-h-0 flex-1 overflow-auto">
                                    <div className="mx-auto flex w-full max-w-[8.27in] flex-col gap-4 px-3 py-4 md:px-6 print:m-0 print:max-w-none print:p-0">
                                    {previewSyncMode === "manual" && previewIsStale ? (
                                        <div className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm leading-6 text-amber-700 shadow-sm dark:text-amber-300 print:hidden">
                                            Preview hozircha eski snapshotni ko&apos;rsatyapti. `Refresh` bossangiz yangi holat render bo&apos;ladi.
                                        </div>
                                    ) : null}
                                    <div className="site-document-page overflow-hidden rounded-[2rem] border border-border/60 bg-background text-foreground shadow-sm dark:bg-slate-950 dark:text-slate-100 print:border-none print:shadow-none print:bg-white print:text-black print:rounded-none">
                                        <div className="border-b border-border/60 px-6 py-6 md:px-8 print:border-none print:p-0 print:pb-6">
                                            <h1 className="max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
                                                {deferredTitle || "Nomsiz maqola"}
                                            </h1>
                                            {authorList.length > 0 && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {authorList.map((author) => (
                                                        <span
                                                            key={author}
                                                            className="site-document-chip px-3 py-1.5 text-xs font-bold bg-muted text-foreground dark:bg-white/8 dark:text-slate-100 print:bg-slate-100 print:text-black"
                                                        >
                                                            {author}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {keywordList.length > 0 && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {keywordList.map((keyword) => (
                                                        <span
                                                            key={keyword}
                                                            className="site-document-chip px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted dark:bg-white/8 dark:text-slate-300 print:bg-slate-100 print:text-muted-foreground"
                                                        >
                                                            #{keyword}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {deferredAbstract.trim() && (
                                            <div className="border-b border-border/60 px-6 py-5 md:px-8 print:border-none print:px-0">
                                                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-accent print:text-black">
                                                    Abstract
                                                </div>
                                                <p className="max-w-3xl text-sm leading-7 text-muted-foreground dark:text-slate-300 md:text-base print:text-slate-700">
                                                    {deferredAbstract}
                                                </p>
                                            </div>
                                        )}

                                        <div className="px-6 py-8 md:px-8 print:p-0 print:text-black">
                                            <ArticleRichContent
                                                content={deferredPreviewContent}
                                                className="writer-preview-content prose prose-neutral max-w-none text-slate-900 print:text-black prose-headings:font-playfair prose-headings:font-black prose-headings:tracking-tight prose-h1:text-4xl prose-h2:mt-14 prose-h2:text-3xl prose-h3:mt-10 prose-h3:text-2xl prose-p:text-[16px] prose-p:leading-8 prose-li:leading-8 prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 prose-pre:rounded-[1.5rem] prose-pre:border prose-blockquote:rounded-[1.25rem] prose-blockquote:border-l-4 prose-blockquote:px-5 prose-blockquote:py-4 prose-img:rounded-[1.5rem] prose-img:border prose-hr:border-border print:prose-invert-0"
                                            />
                                        </div>
                                    </div>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <div className={`border-t border-border/60 bg-muted/15 px-4 py-2.5 text-[11px] print:hidden ${viewMode === 'edit' ? 'hidden' : ''}`}>
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto text-muted-foreground">
                        <span className="site-status-pill border-accent/20 bg-[var(--accent-soft)] px-3 py-1 text-accent">
                            File {normalizedSections.findIndex((section) => getWriterSectionKey(section) === getWriterSectionKey(activeSection)) + 1}/{normalizedSections.length}
                        </span>
                        <span className="site-status-pill px-3 py-1 text-foreground">
                            File: {activeSection.title}
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            {activeSection.kind}
                        </span>
                        <span
                            className={`site-status-pill px-3 py-1 ${
                                activeSection.progress_state === "done"
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : activeSection.progress_state === "drafting"
                                      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                      : "border-border/60 bg-muted/20 text-muted-foreground"
                            }`}
                        >
                            {activeSection.progress_state}
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            {formData.document_kind}
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            {words} so&apos;z
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            {readingTime} min
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            Plot {totalPlots}
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            3D {plot3DBlocks}
                        </span>
                        <span className={`site-status-pill px-3 py-1 ${saveState === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : ""}`}>
                            {saveStatusLabel}
                        </span>
                        <span className="site-status-pill px-3 py-1">
                            {previewSyncMode === "live" ? "Live preview" : "Manual preview"}
                        </span>
                        {previewSyncMode === "manual" ? (
                            <span className={`site-status-pill px-3 py-1 ${previewIsStale ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                                {previewIsStale ? "Preview stale" : "Preview synced"}
                            </span>
                        ) : null}
                        {performanceModeRecommended ? (
                            <span className="site-status-pill border-accent/20 bg-[var(--accent-soft)] px-3 py-1 text-accent">
                                Performance mode
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
