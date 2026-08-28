"use client";

import { memo, useEffect, useState, type ComponentProps } from "react";
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

const ALLOWED_HTML_TAGS = new Set([
    "a",
    "article",
    "aside",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "col",
    "colgroup",
    "dd",
    "del",
    "details",
    "div",
    "dl",
    "dt",
    "em",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "i",
    "img",
    "ins",
    "kbd",
    "li",
    "main",
    "mark",
    "ol",
    "p",
    "pre",
    "s",
    "section",
    "small",
    "span",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
]);

const GLOBAL_ALLOWED_ATTRIBUTES = new Set(["class", "dir", "lang", "title"]);
const TAG_ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
    a: new Set(["href", "target", "rel"]),
    img: new Set(["src", "alt", "width", "height", "loading"]),
    td: new Set(["colspan", "rowspan"]),
    th: new Set(["colspan", "rowspan", "scope"]),
    col: new Set(["span"]),
};

function looksLikeHtml(content: string) {
    return /<\/?[a-z][\s\S]*>/i.test(content);
}

function isSafeRelativeUrl(normalized: string) {
    return normalized.startsWith("/") && !normalized.startsWith("//");
}

function isSafeHref(value: string) {
    const normalized = value.trim().toLowerCase();
    return (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("mailto:") ||
        normalized.startsWith("tel:") ||
        normalized.startsWith("#") ||
        isSafeRelativeUrl(normalized)
    );
}

function isSafeImageSrc(value: string) {
    const normalized = value.trim().toLowerCase();
    return (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        isSafeRelativeUrl(normalized) ||
        /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(value.trim())
    );
}

function sanitizeLegacyHtml(content: string) {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(content, "text/html");

    for (const element of Array.from(documentNode.body.querySelectorAll("*"))) {
        const tagName = element.tagName.toLowerCase();

        if (!ALLOWED_HTML_TAGS.has(tagName)) {
            element.replaceWith(...Array.from(element.childNodes));
            continue;
        }

        for (const attribute of Array.from(element.attributes)) {
            const attributeName = attribute.name.toLowerCase();
            const allowedForTag = TAG_ALLOWED_ATTRIBUTES[tagName]?.has(attributeName) ?? false;
            const globallyAllowed = GLOBAL_ALLOWED_ATTRIBUTES.has(attributeName);

            if (!allowedForTag && !globallyAllowed) {
                element.removeAttribute(attribute.name);
                continue;
            }

            if (attributeName === "href" && !isSafeHref(attribute.value)) {
                element.removeAttribute(attribute.name);
            }

            if (attributeName === "src" && !isSafeImageSrc(attribute.value)) {
                element.removeAttribute(attribute.name);
            }
        }

        if (tagName === "a" && element.getAttribute("target") === "_blank") {
            element.setAttribute("rel", "noopener noreferrer");
        }

        if (tagName === "img") {
            element.setAttribute("loading", "lazy");
        }
    }

    return documentNode.body.innerHTML;
}

function SafeLegacyHtml({ content, className }: { content: string; className: string }) {
    const [sanitizedContent, setSanitizedContent] = useState("");

    useEffect(() => {
        try {
            setSanitizedContent(sanitizeLegacyHtml(content));
        } catch {
            // Keep malformed legacy HTML readable rather than falling back to unsafe rendering.
            setSanitizedContent("");
        }
    }, [content]);

    if (!sanitizedContent) {
        return <pre className={`${className} whitespace-pre-wrap`}>{content}</pre>;
    }

    return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
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
        return <SafeLegacyHtml content={content} className={className} />;
    }

    return (
        <div className={className}>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                {content}
            </ReactMarkdown>
        </div>
    );
});
