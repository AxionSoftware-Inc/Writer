"use client";

import { Activity, Link2, Sigma, Waves } from "lucide-react";

import { CartesianPlot } from "@/components/laboratory/cartesian-plot";
import { type WriterBridgeBlockData } from "@/lib/live-writer-bridge";

function formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("uz-UZ", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function LabResultCard({ block }: { block: WriterBridgeBlockData }) {
    return (
        <div className="my-8 overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/85 shadow-sm">
            <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            <Link2 className="h-3.5 w-3.5" />
                            Saved Laboratory Result
                        </div>
                        {block.profile ? (
                            <div className="mt-2 inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                {block.profile}
                            </div>
                        ) : null}
                        <h3 className="mt-3 font-serif text-2xl font-black">{block.title}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{block.summary}</p>
                    </div>
                    <div className="rounded-full border border-border/70 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        {block.savedResultRevision ? `Snapshot r${block.savedResultRevision}` : block.status === "ready" ? "Snapshot" : "Draft"}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                    {block.plotSeries?.length ? (
                        <CartesianPlot series={block.plotSeries} />
                    ) : null}

                    {block.matrixTables?.length ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {block.matrixTables.map((table) => (
                                <div key={table.label} className="rounded-[1.25rem] border border-border bg-background/60 p-4">
                                    <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                        {table.label}
                                    </div>
                                    <div className="overflow-x-auto rounded-[1rem] border border-border/70">
                                        <table className="min-w-full border-collapse text-center text-sm">
                                            <tbody>
                                                {table.matrix.map((row, rowIndex) => (
                                                    <tr key={`${table.label}-${rowIndex}`}>
                                                        {row.map((value, columnIndex) => (
                                                            <td key={`${table.label}-${rowIndex}-${columnIndex}`} className="border border-border/70 px-3 py-2 font-semibold">
                                                                {Number(value.toFixed(4))}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {block.notes?.length ? (
                        <div className="rounded-[1.25rem] border border-border bg-background/60 p-4">
                            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                <Activity className="h-3.5 w-3.5" />
                                Notes
                            </div>
                            <div className="mt-3 space-y-2">
                                {block.notes.map((note) => (
                                    <div key={note} className="rounded-2xl border border-border/70 bg-background/65 px-3 py-2 text-sm leading-6 text-muted-foreground">
                                        {note}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-4">
                    <div className="rounded-[1.25rem] border border-border bg-background/60 p-4">
                        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                            <Waves className="h-3.5 w-3.5" />
                            Metrics
                        </div>
                        <div className="mt-3 grid gap-3">
                            {block.metrics.map((metric) => (
                                <div key={metric.label} className="rounded-2xl border border-border/70 bg-background/65 px-3 py-3">
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</div>
                                    <div className="mt-2 font-serif text-2xl font-black">{metric.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {block.coefficients?.length ? (
                        <div className="rounded-[1.25rem] border border-border bg-background/60 p-4">
                            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                <Sigma className="h-3.5 w-3.5" />
                                Coefficients
                            </div>
                            <div className="mt-3 overflow-hidden rounded-2xl border border-border/70">
                                <div className="grid grid-cols-3 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                                    <div>order</div>
                                    <div>f^k(a)</div>
                                    <div>coef</div>
                                </div>
                                {block.coefficients.slice(0, 8).map((row) => (
                                    <div key={row.order} className="grid grid-cols-3 border-b border-border/70 px-3 py-2 text-xs last:border-b-0">
                                        <div className="font-semibold">{row.order}</div>
                                        <div>{row.derivativeValue}</div>
                                        <div>{row.coefficient}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-[1.25rem] border border-border bg-background/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                        Import qilingan holat: {formatTimestamp(block.generatedAt)}
                    </div>
                </div>
            </div>
        </div>
    );
}
