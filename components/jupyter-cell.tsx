"use client";

import React, { useState } from "react";
import { Play, Loader2, Code2, Terminal } from "lucide-react";

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
    if (typeof pyodideWindow.loadPyodide === "function") {
        return Promise.resolve();
    }

    if (!pyodideScriptPromise) {
        pyodideScriptPromise = new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(`script[src="${PYODIDE_SCRIPT_URL}"]`);
            if (existing) {
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
                if (needsMatplotlib) {
                    await pyodide.loadPackage("matplotlib");
                }

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

    return (
        <div className="my-6 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm font-sans">
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-mono font-medium">
                    <Code2 className="h-3.5 w-3.5" />
                    Python cell
                </div>
                <button
                    type="button"
                    onClick={handleRun}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 font-semibold text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                    {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {engineStatus === "loading" ? "Engine loading" : isRunning ? "Running" : "Run"}
                </button>
            </div>

            <div className="relative bg-muted/5">
                <textarea
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="min-h-[112px] w-full resize-y border-none bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none whitespace-pre"
                    spellCheck={false}
                />
            </div>

            {(output || error || plots.length > 0) && (
                <div className="flex flex-col gap-2 border-t border-border/50 bg-[#111214] p-4 font-mono text-sm">
                    <div className="mb-1 flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-gray-400">
                        <Terminal className="h-3.5 w-3.5" /> Output
                    </div>
                    {plots.map((imgBase64, index) => (
                        <div key={index} className="my-2 flex w-full justify-center overflow-x-auto rounded-lg bg-white p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`data:image/png;base64,${imgBase64}`} alt="Matplotlib Plot" className="max-w-full" />
                        </div>
                    ))}
                    {output && <pre className="overflow-x-auto whitespace-pre-wrap text-gray-300">{output}</pre>}
                    {error && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border-t border-red-500/20 pt-2 text-red-400">{error}</pre>}
                </div>
            )}
        </div>
    );
}
