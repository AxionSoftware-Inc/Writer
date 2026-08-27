"use client";

import React, { useState } from "react";
import { Check, Code2, Loader2, Play, Terminal } from "lucide-react";

interface PyodideWindow extends Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<any>;
}

const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/";
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

let pyodideScriptPromise: Promise<void> | null = null;
let sharedPyodidePromise: Promise<any> | null = null;
let executionQueue: Promise<void> = Promise.resolve();

function ensurePyodideScript() {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Python engine faqat brauzerda ishlaydi."));
    }

    const pyodideWindow = window as PyodideWindow;
    if (typeof pyodideWindow.loadPyodide === "function") return Promise.resolve();

    if (!pyodideScriptPromise) {
        pyodideScriptPromise = new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(`script[src="${PYODIDE_SCRIPT_URL}"]`);
            if (existing) {
                if (typeof pyodideWindow.loadPyodide === "function") {
                    resolve();
                    return;
                }
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Pyodide script yuklanmadi.")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = PYODIDE_SCRIPT_URL;
            script.async = true;
            script.dataset.writerPyodide = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Pyodide script yuklanmadi."));
            document.head.appendChild(script);
        });
    }

    return pyodideScriptPromise;
}

async function getSharedPyodide() {
    await ensurePyodideScript();

    if (!sharedPyodidePromise) {
        sharedPyodidePromise = (async () => {
            const pyodideWindow = window as PyodideWindow;
            if (typeof pyodideWindow.loadPyodide !== "function") {
                throw new Error("Pyodide loader topilmadi.");
            }
            return pyodideWindow.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
        })();
    }

    return sharedPyodidePromise;
}

function enqueueExecution<T>(task: () => Promise<T>) {
    const run = executionQueue.then(task, task);
    executionQueue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

export function JupyterTerminalElement({ code: initialCode }: { code: string }) {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState("");
    const [plots, setPlots] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [engineStatus, setEngineStatus] = useState<"idle" | "loading" | "ready">("idle");
    const [error, setError] = useState<string | null>(null);

    const handleRun = async () => {
        if (isRunning) return;

        setIsRunning(true);
        setEngineStatus((current) => (current === "ready" ? "ready" : "loading"));
        setOutput("");
        setError(null);
        setPlots([]);

        try {
            const result = await enqueueExecution(async () => {
                const pyodide = await getSharedPyodide();
                setEngineStatus("ready");

                pyodide.setStdout({ batched: (value: string) => setOutput((current) => `${current}${value}\n`) });
                pyodide.setStderr({ batched: (value: string) => setOutput((current) => `${current}${value}\n`) });

                if (typeof pyodide.loadPackagesFromImports === "function") {
                    await pyodide.loadPackagesFromImports(code);
                }

                const needsMatplotlib = /\bmatplotlib\b|\bplt\./.test(code);
                if (needsMatplotlib) await pyodide.loadPackage("matplotlib");

                const wrappedCode = needsMatplotlib
                    ? `
import io
import base64
${code}

try:
    import matplotlib.pyplot as plt
    if plt.get_fignums():
        _writer_buf = io.BytesIO()
        plt.savefig(_writer_buf, format='png', bbox_inches='tight')
        _writer_buf.seek(0)
        _writer_result = base64.b64encode(_writer_buf.read()).decode('utf-8')
        plt.close('all')
        _writer_result
    else:
        None
except Exception:
    None
`
                    : code;

                return pyodide.runPythonAsync(wrappedCode);
            });

            if (typeof result === "string" && result.length > 100 && !result.includes("\n")) {
                setPlots([result]);
            } else if (result !== undefined && result !== null && typeof result !== "function") {
                setOutput((current) => `${current}${current && !current.endsWith("\n") ? "\n" : ""}${String(result)}`);
            }
        } catch (caughtError: unknown) {
            console.error("Python execution error:", caughtError);
            setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        } finally {
            setIsRunning(false);
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

                    {output ? <pre className="overflow-x-auto whitespace-pre-wrap text-slate-300">{output}</pre> : null}
                    {error ? (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border-t border-red-500/20 pt-2 text-red-400">
                            {error}
                        </pre>
                    ) : null}
                </div>
            )}
        </div>
    );
}
