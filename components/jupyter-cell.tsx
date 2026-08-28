"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Code2, Loader2, Play, Terminal } from "lucide-react";

import { executeWriterPython } from "@/lib/writer-python-runtime";

const MAX_OUTPUT_CHARACTERS = 120_000;

function appendBoundedOutput(current: string, value: string) {
    if (current.length >= MAX_OUTPUT_CHARACTERS) return current;

    const next = `${current}${value}`;
    if (next.length <= MAX_OUTPUT_CHARACTERS) return next;

    return `${next.slice(0, MAX_OUTPUT_CHARACTERS)}\n… output truncated by Writer …\n`;
}

export function JupyterTerminalElement({ code: initialCode }: { code: string }) {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState("");
    const [plots, setPlots] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [engineStatus, setEngineStatus] = useState<"idle" | "loading" | "ready">("idle");
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const handleRun = async () => {
        if (isRunning) return;

        setIsRunning(true);
        setEngineStatus((current) => (current === "ready" ? "ready" : "loading"));
        setOutput("");
        setError(null);
        setPlots([]);

        try {
            const result = await executeWriterPython(code, {
                onStatus(status) {
                    if (!mountedRef.current) return;
                    setEngineStatus(status);
                },
                onOutput(value) {
                    if (!mountedRef.current) return;
                    setOutput((current) => appendBoundedOutput(current, value));
                },
            });

            if (!mountedRef.current) return;
            if (result.kind === "plot") {
                setPlots([result.value]);
            } else if (result.kind === "text" && result.value) {
                setOutput((current) =>
                    appendBoundedOutput(current, `${current && !current.endsWith("\n") ? "\n" : ""}${result.value}`),
                );
            }
        } catch (caughtError: unknown) {
            console.error("Python execution error:", caughtError);
            if (mountedRef.current) {
                setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
            }
        } finally {
            if (mountedRef.current) setIsRunning(false);
        }
    };

    const runLabel =
        engineStatus === "loading"
            ? "Engine loading"
            : isRunning
              ? "Running"
              : engineStatus === "ready"
                ? "Run again"
                : "Run";

    return (
        <div
            className="my-6 overflow-hidden rounded-xl border border-black/10 bg-[#efede7] font-sans shadow-none"
            style={{ contentVisibility: "auto", containIntrinsicSize: "240px" }}
        >
            <div className="flex items-center justify-between border-b border-black/10 px-3.5 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                    <Code2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="font-mono text-[11px] font-semibold text-slate-600">Python cell</span>
                    {engineStatus === "ready" && !isRunning ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                            <Check className="h-2.5 w-2.5" /> Ready
                        </span>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={handleRun}
                    disabled={isRunning}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-black/10 bg-white/70 px-2.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-white hover:text-slate-950 disabled:cursor-wait disabled:opacity-65"
                >
                    {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {runLabel}
                </button>
            </div>

            <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="min-h-[118px] w-full resize-y border-0 bg-transparent px-4 py-3.5 font-mono text-[12px] leading-6 text-slate-800 outline-none selection:bg-indigo-200"
                spellCheck={false}
                aria-label="Python code"
            />

            {(output || error || plots.length > 0) && (
                <div className="border-t border-black/10 bg-[#17191d] p-3.5 font-mono text-[11px] leading-5">
                    <div className="mb-2 flex items-center gap-1.5 font-sans text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">
                        <Terminal className="h-3 w-3" /> Output
                    </div>

                    {plots.map((imgBase64, index) => (
                        <div key={index} className="my-2 flex w-full justify-center overflow-x-auto rounded-lg bg-white p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`data:image/png;base64,${imgBase64}`} alt="Matplotlib plot" className="max-w-full" />
                        </div>
                    ))}

                    {output ? <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-slate-300">{output}</pre> : null}
                    {error ? (
                        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap border-t border-red-500/20 pt-2 text-red-400">
                            {error}
                        </pre>
                    ) : null}
                </div>
            )}
        </div>
    );
}
