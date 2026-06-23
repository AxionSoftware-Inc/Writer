import React from "react";
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Area,
    ComposedChart,
    ReferenceLine
} from "recharts";

export type PlotPoint = {
    x: number;
    y: number;
};

export type PlotSeries = {
    label: string;
    color: string;
    points: PlotPoint[];
};

export function CartesianPlot({
    series,
    height = 360,
    domainX = ["auto", "auto"],
    title,
    highlightInterval
}: {
    series: PlotSeries[];
    height?: number;
    domainX?: [number | "auto", number | "auto"];
    title?: string;
    highlightInterval?: {
        start: number;
        end: number;
        color?: string;
        label?: string;
    };
}) {
    // Stable series normalization
    const normalizedSeriesString = JSON.stringify(series);
    const normalizedSeries = React.useMemo(() => {
        const parsed = JSON.parse(normalizedSeriesString) as PlotSeries[];
        return parsed
            .map((entry, index) => ({
                label: entry.label || `Series ${index + 1}`,
                color: entry.color || "var(--accent)",
                points: (entry.points || []).filter(
                    (point) =>
                        typeof point?.x === "number" &&
                        Number.isFinite(point.x) &&
                        typeof point?.y === "number" &&
                        Number.isFinite(point.y),
                ),
            }))
            .filter((entry) => entry.points.length);
    }, [normalizedSeriesString]);

    const data = React.useMemo(() => {
        const mergedMap = new Map<number, Record<string, number>>();

        normalizedSeries.forEach((entry) => {
            entry.points.forEach((point) => {
                const roundedX = Number(point.x.toFixed(6));
                if (!Number.isFinite(roundedX)) {
                    return;
                }

                if (!mergedMap.has(roundedX)) {
                    mergedMap.set(roundedX, { x: roundedX });
                }

                mergedMap.get(roundedX)![entry.label] = point.y;
            });
        });

        return Array.from(mergedMap.values()).sort((a, b) => (a.x || 0) - (b.x || 0));
    }, [normalizedSeries]);

    const formatAxisNumber = React.useCallback((value: unknown, digits: number) => {
        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "--";
        }
        return numericValue.toFixed(digits);
    }, []);

    const formatYAxisNumber = React.useCallback((value: unknown) => {
        const numericValue = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return "--";
        }
        return Math.abs(numericValue) > 1000 ? numericValue.toExponential(1) : numericValue.toPrecision(3);
    }, []);

    const chartMargin = React.useMemo(() => ({ top: 30, right: 30, left: 10, bottom: 10 }), []);
    const tooltipContentStyle = React.useMemo(() => ({ 
        backgroundColor: 'var(--background)', 
        borderColor: 'var(--border)',
        borderRadius: '1rem',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
        color: 'var(--foreground)',
        padding: '12px'
    }), []);
    const tooltipItemStyle = React.useMemo(() => ({ fontWeight: 600, fontSize: 12, paddingBottom: 2 }), []);
    const tooltipLabelStyle = React.useMemo(() => ({ color: 'var(--muted-foreground)', marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }), []);
    const legendWrapperStyle = React.useMemo(() => ({ paddingTop: "15px", fontSize: "11px", fontWeight: 700, color: 'var(--muted-foreground)' }), []);

    const tooltipFormatter = React.useCallback((value: any) => {
        if (typeof value !== "number") {
            return value ?? "";
        }
        if (Math.abs(value) > 10000 || (Math.abs(value) < 0.001 && value !== 0)) {
            return value.toExponential(4);
        }
        return Number.isInteger(value) ? value : value.toFixed(4);
    }, []);

    const tooltipLabelFormatter = React.useCallback((label: any) => 
        typeof label === "number" ? `x = ${label.toFixed(6)}` : `x = ${String(label)}`
    , []);

    const xAxisTickFormatter = React.useCallback((val: any) => formatAxisNumber(val, 2), [formatAxisNumber]);

    // Calculate area data if we have a highlight interval
    const areaData = React.useMemo(() => {
        if (!highlightInterval || !normalizedSeries.length) return null;
        const mainSeries = normalizedSeries[0]; // Usually the function
        const filtered = mainSeries.points.filter(p => 
            p.x >= highlightInterval.start && p.x <= highlightInterval.end
        );
        // Ensure we include exact bounds even if not in original points
        return filtered;
    }, [highlightInterval, normalizedSeries]);

    if (!normalizedSeries.length || !data.length) {
        return (
            <div className="site-panel w-full min-w-0 min-h-0 overflow-hidden p-4">
                {title ? (
                    <div className="pb-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
                    </div>
                ) : null}
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/45 px-4 py-6 text-sm leading-7 text-muted-foreground">
                    Plot uchun yaroqli nuqtalar topilmadi.
                </div>
            </div>
        );
    }

    return (
        <div className="site-panel w-full min-w-0 min-h-0 overflow-hidden hover:shadow-lg transition-shadow duration-300">
            {title && (
                <div className="px-5 pt-4 pb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
                </div>
            )}
            <div style={{ height }} className="relative w-full min-h-0 px-2 py-4">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                    <ComposedChart data={data} margin={chartMargin}>
                        <CartesianGrid 
                            strokeDasharray="4 4" 
                            stroke="var(--border)" 
                            opacity={0.4} 
                            vertical={true} 
                        />
                        <XAxis 
                            dataKey="x" 
                            type="number" 
                            domain={domainX} 
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)', strokeWidth: 1.5 }}
                            minTickGap={40}
                            tickFormatter={xAxisTickFormatter}
                        />
                        <YAxis 
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                            tickLine={false}
                            axisLine={false}
                            width={75}
                            tickFormatter={formatYAxisNumber}
                        />
                        <Tooltip 
                            contentStyle={tooltipContentStyle}
                            itemStyle={tooltipItemStyle}
                            labelStyle={tooltipLabelStyle}
                            formatter={tooltipFormatter}
                            labelFormatter={tooltipLabelFormatter}
                        />
                        <Legend 
                            wrapperStyle={legendWrapperStyle}
                            iconType="circle"
                            iconSize={6}
                        />

                        {highlightInterval && areaData && (
                            <>
                                <Area
                                    type="monotone"
                                    data={areaData}
                                    dataKey="y"
                                    stroke="none"
                                    fill={highlightInterval.color || "var(--accent)"}
                                    fillOpacity={0.15}
                                    name={highlightInterval.label || "Integrated Area"}
                                    isAnimationActive={true}
                                />
                                <ReferenceLine 
                                    x={highlightInterval.start} 
                                    stroke="var(--accent)" 
                                    strokeDasharray="4 4"
                                    strokeWidth={2}
                                    label={{ value: 'a', position: 'top', fill: 'var(--accent)', fontSize: 10, fontWeight: 800 }} 
                                />
                                <ReferenceLine 
                                    x={highlightInterval.end} 
                                    stroke="var(--accent)" 
                                    strokeDasharray="4 4" 
                                    strokeWidth={2}
                                    label={{ value: 'b', position: 'top', fill: 'var(--accent)', fontSize: 10, fontWeight: 800 }}
                                />
                            </>
                        )}

                        {normalizedSeries.map((s) => (
                            <Line
                                key={s.label}
                                type="monotone"
                                dataKey={s.label}
                                stroke={s.color}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 1.5, stroke: 'var(--background)' }}
                                animationDuration={1000}
                                isAnimationActive={true}
                                connectNulls
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
