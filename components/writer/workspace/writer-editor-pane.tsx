"use client";

import type { WriterWorkspaceController } from "./workspace-types";

export function WriterEditorPane({ controller }: { controller: WriterWorkspaceController }) {
    const {
        textareaRef,
        activeSection,
        editorContent,
        setEditorContent,
        previewSyncMode,
    } = controller;

    return (
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
                Markdown, LaTeX, `plot2d`, `plot3d` va Python bloklari ishlaydi.
                {previewSyncMode === "live"
                    ? " Preview avtomatik yangilanadi."
                    : " Preview manual rejimda — katta hujjatlarda FPS barqarorroq."}
            </div>

            <div className="min-h-0 flex-1 bg-muted/10 px-2.5 py-2.5 md:px-3">
                <textarea
                    ref={textareaRef}
                    value={editorContent}
                    onChange={(event) => setEditorContent(event.target.value)}
                    className="min-h-full w-full flex-1 resize-none overflow-y-auto rounded-[1.35rem] border border-border/60 bg-background px-4 py-4 font-mono text-[14px] leading-7 text-foreground outline-none transition-colors focus:border-accent/30 focus:bg-background"
                    placeholder="Ilmiy hujjatni yozishni boshlang..."
                    spellCheck={false}
                />
            </div>
        </section>
    );
}
