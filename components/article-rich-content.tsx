"use client";

import { memo, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { LabResultCard } from "@/components/live-writer-bridge/lab-result-card";
import { parseWriterBridgeBlock } from "@/lib/live-writer-bridge";

const PlotRenderer = dynamic(
    () => import("@/components/plot-renderer").then((module) => module.PlotRenderer),
    {
        ssr: false,
        loading: () => <div className="my-6 h-56 animate-pulse rounded-2xl border border-border/60 bg-muted/15" />,
    },
);

const JupyterTerminalElement = dynamic(
    () => import("@/components/jupyter-cell").then((module) => module.JupyterTerminalElement),
    {
        ssr: false,
        loading: () => <div className="my-6 h-40 animate-pulse rounded-2xl border border-border/60 bg-muted/15" />,
    },
);

function looksLikeHtml(content: string) {
    return /<\/?[a-z][\s\S]*>/i.test(content);
}

const markdownComponents = {
    code(props: ComponentProps<"code"> & { node?: unknown }) {
        const { children, className: codeClassName, ...rest } = props;
        const normalizedCode = String(children).replace(/\n$/, "");
        const plotMatch = /language-(plot2d|plot3d)/.exec(codeClassName || "");

        if (plotMatch) {
            return <PlotRenderer code={normalizedCode} type={plotMatch[1] as "plot2d" | "plot3d"} />;
        }

        if (/language-python/.test(codeClassName || "")) {
            return <JupyterTerminalElement code={normalizedCode} />;
        }

        if (/language-lab-result/.test(codeClassName || "")) {
            const parsed = parseWriterBridgeBlock(normalizedCode);

            if (parsed) {
                return <LabResultCard block={parsed} />;
            }
        }

        return (
            <code className={codeClassName} {...rest}>
                {children}
            </code>
        );
    },
};

export const ArticleRichContent = memo(function ArticleRichContent({
    content,
    className = "",
}: {
    content: string;
    className?: string;
}) {
    if (!content) {
        return null;
    }

    if (looksLikeHtml(content)) {
        return <div className={className} dangerouslySetInnerHTML={{ __html: content }} />;
    }

    return (
        <div className={className}>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                {content}
            </ReactMarkdown>
        </div>
    );
});
