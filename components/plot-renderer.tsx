"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { compile } from 'mathjs';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { 
    ssr: false, 
    loading: () => <div className="w-full h-64 flex items-center justify-center bg-muted/20 border border-border/50 rounded-xl">Grafik yuklanmoqda...</div>
});

interface PlotProp {
    code: string;
    type: 'plot2d' | 'plot3d';
}

function clampSteps(value: unknown, fallback: number, min: number, max: number) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export const PlotRenderer = React.memo(function PlotRenderer({ code, type }: PlotProp) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (shouldRender) {
            return;
        }

        const node = containerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            const frameId = window.requestAnimationFrame(() => {
                setShouldRender(true);
            });

            return () => window.cancelAnimationFrame(frameId);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setShouldRender(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '480px 0px' },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [shouldRender]);

    const plotMeta = useMemo(() => {
        try {
            const config = JSON.parse(code);
            const expression = config.f || config.expression || 'x^2';
            return {
                title: config.title || (type === 'plot3d' ? `f(x,y) = ${expression}` : `f(x) = ${expression}`),
                expression,
                description:
                    type === 'plot3d'
                        ? '3D surface preview viewportga kelganda yuklanadi.'
                        : 'Grafik preview viewportga kelganda yuklanadi.',
            };
        } catch {
            return {
                title: type === 'plot3d' ? '3D grafik' : '2D grafik',
                expression: '',
                description: 'Grafik konfiguratsiyasi viewportga kelganda tekshiriladi.',
            };
        }
    }, [code, type]);

    const plotData = useMemo(() => {
        if (!shouldRender) {
            return null;
        }

        try {
            // Attempt to parse JSON config
            const config = JSON.parse(code);
            const expression = config.f || config.expression || 'x^2';
            const compiledExpr = compile(expression);

            if (type === 'plot2d') {
                const domain = config.domain || [-10, 10];
                const steps = clampSteps(config.previewSteps ?? config.steps, 200, 80, 360);
                
                const xValues = [];
                const yValues = [];
                const step = (domain[1] - domain[0]) / steps;

                for (let x = domain[0]; x <= domain[1]; x += step) {
                    xValues.push(x);
                    try {
                        const y = compiledExpr.evaluate({ x });
                        // Handle complex outputs or infinities 
                        if (typeof y === 'number' && !isNaN(y) && isFinite(y)) {
                            yValues.push(y);
                        } else {
                            yValues.push(null); // breaks the line
                        }
                    } catch {
                        yValues.push(null);
                    }
                }

                return {
                    data: [{
                        x: xValues,
                        y: yValues,
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: '#6366f1', width: 2 }, // Indigo 500
                        name: `f(x) = ${expression}`
                    }],
                    layout: {
                        title: config.title || `f(x) = ${expression}`,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: '#71717a' }, // muted-foreground
                        margin: { l: 40, r: 20, t: 40, b: 40 },
                        xaxis: { gridcolor: '#e4e4e7' },
                        yaxis: { gridcolor: '#e4e4e7' }
                    }
                };
            } else if (type === 'plot3d') {
                const xDomain = config.xDomain || [-5, 5];
                const yDomain = config.yDomain || [-5, 5];
                const steps = clampSteps(config.previewSteps ?? config.steps, 28, 12, 36);

                const xValues = [];
                const yValues = [];
                const zValues = [];

                const xStep = (xDomain[1] - xDomain[0]) / steps;
                const yStep = (yDomain[1] - yDomain[0]) / steps;

                for (let x = xDomain[0]; x <= xDomain[1]; x += xStep) {
                    xValues.push(x);
                }
                for (let y = yDomain[0]; y <= yDomain[1]; y += yStep) {
                    yValues.push(y);
                }

                for (const y of yValues) {
                    const zRow = [];
                    for (const x of xValues) {
                        try {
                            const z = compiledExpr.evaluate({ x, y });
                            if (typeof z === 'number' && !isNaN(z) && isFinite(z)) {
                                zRow.push(z);
                            } else {
                                zRow.push(null);
                            }
                        } catch {
                            zRow.push(null);
                        }
                    }
                    zValues.push(zRow);
                }

                return {
                    data: [{
                        x: xValues,
                        y: yValues,
                        z: zValues,
                        type: 'surface',
                        colorscale: 'Viridis',
                        showscale: false
                    }],
                    layout: {
                        title: config.title || `f(x,y) = ${expression}`,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: '#71717a' },
                        margin: { l: 0, r: 0, t: 40, b: 0 },
                        scene: {
                            xaxis: { title: 'X' },
                            yaxis: { title: 'Y' },
                            zaxis: { title: 'Z' }
                        }
                    }
                };
            }
        } catch (error: unknown) {
            return { error: `Parsing error: ${error instanceof Error ? error.message : String(error)}` };
        }
        return { error: 'Unknown type' };
    }, [code, shouldRender, type]);

    if (!shouldRender) {
        return (
            <div
                ref={containerRef}
                className="my-6 flex min-h-52 flex-col justify-between rounded-2xl border border-border/50 bg-background/70 p-5 shadow-sm"
            >
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {type === 'plot3d' ? '3D Plot Queue' : 'Plot Queue'}
                    </div>
                    <div className="mt-2 text-lg font-black">{plotMeta.title}</div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{plotMeta.description}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="rounded-full border border-border/60 bg-background/75 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                        {plotMeta.expression || 'Expression hidden'}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShouldRender(true)}
                        className="rounded-full border border-border/60 bg-background/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Hozir render qilish
                    </button>
                </div>
            </div>
        );
    }

    if (plotData?.error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl my-4 text-sm font-mono">
                [Plot rendering failed: {plotData.error}]
            </div>
        );
    }

    if (!plotData) {
        return null;
    }

    const PlotComponent = Plot as unknown as React.ComponentType<{
        data: unknown;
        layout: unknown;
        useResizeHandler: boolean;
        className: string;
        config: { displayModeBar: boolean; responsive: boolean };
    }>;

    return (
        <div className="my-6 rounded-2xl overflow-hidden border border-border/50 bg-background shadow-sm hover:shadow-md transition-shadow">
            <PlotComponent
                data={plotData.data}
                layout={{
                    ...plotData.layout,
                    autosize: true
                }}
                useResizeHandler={true}
                className="w-full h-[400px] md:h-[500px]"
                config={{ displayModeBar: false, responsive: true }}
            />
        </div>
    );
});
