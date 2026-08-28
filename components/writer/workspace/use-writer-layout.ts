"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { WriterPreviewSyncMode, WriterViewMode } from "@/lib/writer-document";

const DEFAULT_SIDEBAR_WIDTH = 352;
const LARGE_SCREEN_SIDEBAR_WIDTH = 384;
const MIN_SIDEBAR_WIDTH = 332;
const MAX_SIDEBAR_WIDTH = 430;
export const WRITER_SPLIT_VIEW_BREAKPOINT = 1360;
const RESIZABLE_SIDEBAR_BREAKPOINT = 1480;

export function useWriterLayout({
    performanceModeRecommended,
    onViewChange,
}: {
    performanceModeRecommended: boolean;
    onViewChange?: (view: WriterViewMode) => void;
}) {
    const workspaceShellRef = useRef<HTMLDivElement>(null);
    const splitWorkspaceRef = useRef<HTMLDivElement>(null);
    const dragModeRef = useRef<"sidebar" | "split" | null>(null);
    const hasAutoSwitchedForPerformanceRef = useRef(false);

    const [viewportWidth, setViewportWidth] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth : 1440,
    );
    const [viewMode, setViewModeState] = useState<WriterViewMode>(() =>
        typeof window !== "undefined" && window.innerWidth < 1280 ? "edit" : "split",
    );
    const [showInspector, setShowInspector] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
    );
    const [previewSyncMode, setPreviewSyncMode] = useState<WriterPreviewSyncMode>(() =>
        typeof window !== "undefined" && window.innerWidth >= WRITER_SPLIT_VIEW_BREAKPOINT ? "manual" : "live",
    );
    const [sidebarWidth, setSidebarWidth] = useState(() =>
        typeof window !== "undefined" && window.innerWidth >= 1600
            ? LARGE_SCREEN_SIDEBAR_WIDTH
            : DEFAULT_SIDEBAR_WIDTH,
    );
    const [splitRatio, setSplitRatio] = useState(52);

    const canResizeSidebar = viewportWidth >= RESIZABLE_SIDEBAR_BREAKPOINT;
    const splitViewAvailable = viewportWidth >= WRITER_SPLIT_VIEW_BREAKPOINT;
    const splitLayoutEnabled = viewMode === "split" && splitViewAvailable;

    const setViewMode = useCallback((nextView: WriterViewMode) => {
        const safeView = nextView === "split" && !splitViewAvailable ? "edit" : nextView;
        setViewModeState(safeView);
        onViewChange?.(safeView);
    }, [onViewChange, splitViewAvailable]);

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
        if (typeof window === "undefined") return;
        const handleResize = () => setViewportWidth(window.innerWidth);
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (viewportWidth < 1024) setShowInspector(false);
    }, [viewportWidth]);

    useEffect(() => {
        if (!splitViewAvailable && viewMode === "split") {
            setViewModeState("edit");
            onViewChange?.("edit");
        }
    }, [onViewChange, splitViewAvailable, viewMode]);

    useEffect(() => {
        if (splitLayoutEnabled && previewSyncMode === "live") setPreviewSyncMode("manual");
    }, [previewSyncMode, splitLayoutEnabled]);

    useEffect(() => {
        if (performanceModeRecommended && !hasAutoSwitchedForPerformanceRef.current) {
            const timeoutId = window.setTimeout(() => {
                setPreviewSyncMode("manual");
                if (viewMode === "split") {
                    setViewModeState("edit");
                    onViewChange?.("edit");
                }
                if (window.innerWidth < 1536) setShowInspector(false);
                hasAutoSwitchedForPerformanceRef.current = true;
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
        if (!performanceModeRecommended) hasAutoSwitchedForPerformanceRef.current = false;
    }, [onViewChange, performanceModeRecommended, viewMode]);

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

    return {
        workspaceShellRef,
        splitWorkspaceRef,
        viewMode,
        setViewMode,
        showInspector,
        setShowInspector,
        previewSyncMode,
        setPreviewSyncMode,
        sidebarWidth,
        splitRatio,
        canResizeSidebar,
        splitViewAvailable,
        splitLayoutEnabled,
        startSidebarResize,
        startSplitResize,
    };
}
