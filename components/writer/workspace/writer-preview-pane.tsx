"use client";

import { ArticleRichContent } from "@/components/article-rich-content";
import type { WriterWorkspaceController, WriterWorkspaceSlots } from "./workspace-types";

export function WriterPreviewPane({
    controller,
    slots,
}: {
    controller: WriterWorkspaceController;
    slots?: WriterWorkspaceSlots;
}) {
    const {
        previewSyncMode,
        previewIsStale,
        deferredTitle,
        deferredAbstract,
        deferredPreviewContent,
        authorList,
        keywordList,
    } = controller;

    return (
        <section className="site-document-frame flex h-full min-h-0 min-w-0 flex-col overflow-hidden print:block print:w-full print:overflow-visible print:rounded-none print:border-none print:bg-white">
            <div className="min-h-0 flex-1 overflow-auto">
                <div className="mx-auto flex w-full max-w-[8.27in] flex-col gap-4 px-3 py-4 md:px-6 print:m-0 print:max-w-none print:p-0">
                    {slots?.previewBefore}

                    {previewSyncMode === "manual" && previewIsStale ? (
                        <div className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm leading-6 text-amber-700 shadow-sm dark:text-amber-300 print:hidden">
                            Preview eski snapshotni ko&apos;rsatyapti. `Refresh` orqali yangi holatni render qiling.
                        </div>
                    ) : null}

                    <div className="site-document-page overflow-hidden rounded-[2rem] border border-border/60 bg-background text-foreground shadow-sm print:rounded-none print:border-none print:bg-white print:text-black print:shadow-none">
                        <div className="border-b border-border/60 px-6 py-6 md:px-8 print:border-none print:p-0 print:pb-6">
                            <h1 className="max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
                                {deferredTitle || "Nomsiz maqola"}
                            </h1>

                            {authorList.length > 0 ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {authorList.map((author) => (
                                        <span key={author} className="site-document-chip bg-muted px-3 py-1.5 text-xs font-bold text-foreground print:bg-slate-100 print:text-black">
                                            {author}
                                        </span>
                                    ))}
                                </div>
                            ) : null}

                            {keywordList.length > 0 ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {keywordList.map((keyword) => (
                                        <span key={keyword} className="site-document-chip bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground print:bg-slate-100">
                                            #{keyword}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {deferredAbstract.trim() ? (
                            <div className="border-b border-border/60 px-6 py-5 md:px-8 print:border-none print:px-0">
                                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-accent print:text-black">
                                    Abstract
                                </div>
                                <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base print:text-slate-700">
                                    {deferredAbstract}
                                </p>
                            </div>
                        ) : null}

                        <div className="px-6 py-8 md:px-8 print:p-0 print:text-black">
                            <ArticleRichContent
                                content={deferredPreviewContent}
                                className="writer-preview-content prose prose-neutral max-w-none text-slate-900 print:text-black prose-headings:font-playfair prose-headings:font-black prose-headings:tracking-tight prose-h1:text-4xl prose-h2:mt-14 prose-h2:text-3xl prose-h3:mt-10 prose-h3:text-2xl prose-p:text-[16px] prose-p:leading-8 prose-li:leading-8 prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 prose-pre:rounded-[1.5rem] prose-pre:border prose-blockquote:rounded-[1.25rem] prose-blockquote:border-l-4 prose-blockquote:px-5 prose-blockquote:py-4 prose-img:rounded-[1.5rem] prose-img:border prose-hr:border-border"
                            />
                        </div>
                    </div>

                    {slots?.previewAfter}
                </div>
            </div>
        </section>
    );
}
