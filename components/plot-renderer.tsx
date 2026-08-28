"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { compile } from "mathjs";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
    loading: () => (
        <div className="writer-plot-shell my-6 flex min-h-56 items-center justify-center rounded-xl border border-black/10 bg-[#f0eee8] text-sm text-slate-500">
            Grafik tayyorlanmoqda...
        </div>
    ),
});

interface PlotProp {
    code: string;
    type: "plot2d" | "plot3d";
}

type PlotPayload =
    | {
          data: unknown[];
          layout: Record<string, unknown>;
          error?: never;
      }
    | {
          error: string;
          data?: never;
          layout?: never;
      };

function clampSteps(value: unknown, fallback: number, min: number, max: number) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    return Math.min(max, Math.max(min, Math.round(numericValue)));
}

function finiteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export const PlotRenderer = React.memo(function PlotRenderer({ code, type }: PlotProp) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (shouldRender) return;

        const node = containerRef.current;
        if (!node || typeof IntersectionObserver === "undefined") {
            const frameId = window.requestAnimationFrame(() => setShouldRender(true));
            return () => window.cancelAnimationFrame(frameId);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setShouldRender(true);
                    observer.disconnect();
                }
            },
            // Plotly is a large client module. Do not wake it up several screens early.
            { rootMargin: "180px 0px" },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [shouldRender]);

    const plotMeta = useMemo(() => {
        try {
            const config = JSON.parse(code);
            const expression = config.f || config.expression || "x^2";
            return {
                title: config.title || (type === "plot3d" ? `f(x,y) = ${expression}` : `f(x) = ${expression}`),
                expression,
                description:
                    type === "plot3d"
                        ? "3D surface preview faqat ko‘rinadigan hududga yaqinlashganda hisoblanadi."
                        : "Grafik preview faqat ko‘rinadigan hududga yaqinlashganda hisoblanadi.",
            };
        } catch {
            return {
                title: type === "plot3d" ? "3D grafik" : "2D grafik",
                expression: "",
                description: "Grafik konfiguratsiyasi render vaqtida tekshiriladi.",
            };
        }
    }, [code, type]);

    const plotData = useMemo<PlotPayload | null>(() => {
        if (!shouldRender) return null;

        try {
            const config = JSON.parse(code);
            const expression = config.f || config.expression || "x^2";
            const compiledExpr = compile(expression);

            if (type === "plot2d") {
                const domain = Array.isArray(config.domain) && config.domain.length >= 2 ? config.domain : [-10, 10];
                const steps = clampSteps(config.previewSteps ?? config.steps, 160, 72, 280);
                const start = Number(domain[0]);
                const end = Number(domain[1]);
                const step = (end - start) / steps;
                const xValues: number[] = [];
                const yValues: Array<number | null> = [];

                for (let index = 0; index <= steps; index += 1) {
                    const x = start + step * index;
                    xValues.push(x);
                    try {
                        const y = compiledExpr.evaluate({ x });
                        yValues.push(finiteNumber(y) ? y : null);
                    } catch {
                        yValues.push(null);
                    }
                }

                return {
                    data: [
                        {
                            x: xValues,
                            y: yValues,
                            type: "scatter",
                            mode: "lines",
                            line: { color: "#5369c9", width: 2.4 },
                            name: `f(x) = ${expression}`,
                        },
                    ],
                    layout: {
                        title: { text: config.title || `f(x) = ${expression}`, font: { size: 15, color: "#31353a" } },
                        paper_bgcolor: "transparent",
                        plot_bgcolor: "transparent",
                        font: { color: "#6c7178", family: "Manrope, system-ui, sans-serif", size: 11 },
                        margin: { l: 48, r: 22, t: 52, b: 44 },
                        hovermode: "closest",
                        xaxis: {
                            gridcolor: "rgba(50, 54, 60, 0.10)",
                            zerolinecolor: "rgba(50, 54, 60, 0.18)",
                        },
                        yaxis: {
                            gridcolor: "rgba(50, 54, 60, 0.10)",
                            zerolinecolor: "rgba(50, 54, 60, 0.18)",
                        },
                    },
                };
            }

            const xDomain = Array.isArray(config.xDomain) && config.xDomain.length >= 2 ? config.xDomain : [-5, 5];
            const yDomain = Array.isArray(config.yDomain) && config.yDomain.length >= 2 ? config.yDomain : [-5, 5];
            // The preview is intentionally lighter than an analysis render. Users can
            // request a higher value explicitly via previewSteps if they need it.
            const steps = clampSteps(config.previewSteps ?? config.steps, 24, 12, 32);
            const xValues: number[] = [];
            const yValues: number[] = [];
            const zValues: Array<Array<number | null>> = [];
            const xStart = Number(xDomain[0]);
            const xEnd = Number(xDomain[1]);
            const yStart = Number(yDomain[0]);
            const yEnd = Number(yDomain[1]);

            for (let index = 0; index <= steps; index += 1) {
                xValues.push(xStart + ((xEnd - xStart) * index) / steps);
                yValues.push(yStart + ((yEnd - yStart) * index) / steps);
            }

            for (const y of yValues) {
                const row: Array<number | null> = [];
                for (const x of xValues) {
                    try {
                        const z = compiledExpr.evaluate({ x, y });
                        row.push(finiteNumber(z) ? z : null);
                    } catch {
                        row.push(null);
                    }
                }
                zValues.push(row);
            }

            return {
                data: [
                    {
                        x: xValues,
                        y: yValues,
                        z: zValues,
                        type: "surface",
                        colorscale: "Viridis",
                        showscale: false,
                    },
                ],
                layout: {
                    title: { text: config.title || `f(x,y) = ${expression}`, font: { size: 15, color: "#31353a" } },
                    paper_bgcolor: "transparent",
                    plot_bgcolor: "transparent",
                    font: { color: "#6c7178", family: "Manrope, system-ui, sans-serif", size: 11 },
                    margin: { l: 0, r: 0, t: 52, b: 0 },
                    scene: {
                        bgcolor: "transparent",
                        xaxis: { title: "X", gridcolor: "rgba(50, 54, 60, 0.10)" },
                        yaxis: { title: "Y", gridcolor: "rgba(50, 54, 60, 0.10)" },
                        zaxis: { title: "Z", gridcolor: "rgba(50, 54, 60, 0.10)" },
                    },
                },
            };
        } catch (error: unknown) {
            return { error: `Parsing error: ${error instanceof Error ? error.message : String(error)}` };
        }
    }, [code, shouldRender, type]);

    if (!shouldRender) {
        return (
            <div
                ref={containerRef}
                className="writer-plot-shell my-6 flex min-h-48 flex-col justify-between rounded-xl border border-black/10 bg-[#f0eee8] p-5 shadow-none"
                style={{ contentVisibility: "auto", containIntrinsicSize: "220px" }}
            >
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        {type === "plot3d" ? "3D plot" : "Plot"}
                    </div>
                    <div className="mt-2 text-base font-black text-slate-800">{plotMeta.title}</div>
                    <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">{plotMeta.description}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="max-w-[70%] truncate rounded-md border border-black/10 bg-white/55 px-2.5 py-1.5 font-mono text-[10px] text-slate-500">
                        {plotMeta.expression || "Expression hidden"}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShouldRender(true)}
                        className="rounded-md border border-black/10 bg-white/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                    >
                        Render now
                    </button>
                </div>
            </div>
        );
    }

    if (plotData?.error) {
        return (
            <div className="my-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 font-mono text-sm text-red-600">
                [Plot rendering failed: {plotData.error}]
            </div>
        );
    }

    if (!plotData) return null;

    const PlotComponent = Plot as unknown as React.ComponentType<{
        data: unknown[];
        layout: Record<string, unknown>;
        useResizeHandler: boolean;
        className: string;
        config: { displayModeBar: boolean; responsive: boolean; scrollZoom: boolean; doubleClick: false | "reset" | "autosize" | "reset+autosize" };
    }>;

    return (
        <div
            className="writer-plot-shell my-6 overflow-hidden rounded-xl border border-black/10 bg-[#f0eee8] shadow-none"
            style={{ contentVisibility: "auto", containIntrinsicSize: type === "plot3d" ? "430px" : "360px" }}
        >
            <PlotComponent
                data={plotData.data}
                layout={{ ...plotData.layout, autosize: true }}
                useResizeHandler
                className={type === "plot3d" ? "h-[380px] w-full md:h-[430px]" : "h-[320px] w-full md:h-[360px]"}
                config={{ displayModeBar: false, responsive: true, scrollZoom: false, doubleClick: "reset" }}
            />
        </div>
    );
});
