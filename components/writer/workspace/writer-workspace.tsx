"use client";

import { useEffect, useMemo } from "react";

import { emitWriterHostEvent, type WriterHostAdapter } from "@/lib/writer-integration";
import { WriterEditorPane } from "./writer-editor-pane";
import { WriterInspector } from "./writer-inspector";
import { WriterPreviewPane } from "./writer-preview-pane";
import { WriterStatusBar } from "./writer-status-bar";
import { WriterWorkspaceToolbar } from "./workspace-toolbar";
import { useWriterSnapshotMigration } from "./use-writer-snapshot-migration";
import { useWriterWorkspace } from "./use-writer-workspace";
import type { WriterWorkspaceProps } from "./workspace-types";

export function WriterWorkspace(props: WriterWorkspaceProps) {
    useWriterSnapshotMigration(props);

    /*
     * document.changed has one authoritative source at the public workspace
     * boundary so host applications see title/metadata/section changes as well
     * as editor-content changes. The internal controller still emits the other
     * fine-grained events, but its duplicate document.changed signal is filtered.
     */
    const controllerHost = useMemo<WriterHostAdapter | undefined>(() => {
        if (!props.host) return undefined;
        return {
            ...props.host,
            emit: props.host.emit
                ? (event) => {
                      if (event.type === "writer.document.changed") return;
                      return props.host?.emit?.(event);
                  }
                : undefined,
        };
    }, [props.host]);

    const controller = useWriterWorkspace({ ...props, host: controllerHost ?? props.host });
    const { slots } = props;

    useEffect(() => {
        if (!props.host) return;
        void emitWriterHostEvent(props.host, {
            type: "writer.document.changed",
            context: {
                documentId: props.documentId,
                mode: props.mode ?? "new",
                hostId: props.host.id,
            },
            document: props.formData,
        });
    }, [props.documentId, props.formData, props.host, props.mode]);

    return (
        <div className="site-workspace-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden text-foreground print:h-auto print:overflow-visible print:bg-white">
            <div className="flex h-full min-h-0 flex-1 flex-col print:block print:h-auto">
                <WriterWorkspaceToolbar controller={controller} slots={slots} />

                <div
                    ref={controller.workspaceShellRef}
                    className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-muted/25 p-2 lg:flex-row lg:gap-2 print:block print:w-full print:overflow-visible print:bg-white print:p-0"
                >
                    {controller.showInspector ? <WriterInspector controller={controller} slots={slots} /> : null}

                    {controller.showInspector && controller.canResizeSidebar ? (
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize Writer sidebar"
                            onPointerDown={controller.startSidebarResize}
                            className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent-soft)] lg:flex lg:items-center print:hidden"
                        >
                            <div className="mx-auto h-12 w-[3px] rounded-full bg-border/40" />
                        </div>
                    ) : null}

                    <div
                        ref={controller.splitWorkspaceRef}
                        className={`min-h-0 flex-1 overflow-hidden lg:gap-2 ${controller.splitLayoutEnabled ? "grid h-full" : "grid h-full grid-cols-1"} print:block print:overflow-visible print:p-0`}
                        style={
                            controller.splitLayoutEnabled
                                ? {
                                      gridTemplateColumns: `minmax(0, ${controller.splitRatio}fr) 8px minmax(0, ${100 - controller.splitRatio}fr)`,
                                  }
                                : undefined
                        }
                    >
                        {controller.viewMode === "edit" || controller.viewMode === "split" ? (
                            <WriterEditorPane controller={controller} />
                        ) : null}

                        {controller.splitLayoutEnabled ? (
                            <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize editor and preview"
                                onPointerDown={controller.startSplitResize}
                                className="relative hidden cursor-col-resize items-stretch bg-transparent transition-colors hover:bg-[var(--accent-soft)] xl:flex print:hidden"
                            >
                                <div className="mx-auto h-24 w-[3px] rounded-full bg-border/40" />
                            </div>
                        ) : null}

                        {controller.viewMode === "preview" || controller.viewMode === "split" ? (
                            <WriterPreviewPane controller={controller} slots={slots} />
                        ) : null}
                    </div>
                </div>

                <WriterStatusBar controller={controller} />
            </div>
        </div>
    );
}

export type { WriterWorkspaceProps, WriterWorkspaceSlots } from "./workspace-types";
