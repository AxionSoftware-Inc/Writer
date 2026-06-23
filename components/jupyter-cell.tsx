"use client";

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { Play, Loader2, Code2, Terminal } from 'lucide-react';

interface PyodideWindow extends Window {
    loadPyodide: (config: { indexURL: string }) => Promise<any>;
}

export function JupyterTerminalElement({ code: initialCode }: { code: string }) {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState<string>('');
    const [plots, setPlots] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [pyodideReady, setPyodideReady] = useState(false);
    const pyodideRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initial setup to load pyodide from CDN when first component mounts
        const initPyodide = async () => {
            if (window) {
                const w = window as unknown as PyodideWindow;
                if (!w.loadPyodide) {
                    const checkInterval = setInterval(async () => {
                        if (typeof w.loadPyodide === 'function') {
                            clearInterval(checkInterval);
                            await initializePyodideInstance(w);
                        }
                    }, 100);
                } else if (!pyodideRef.current) {
                    await initializePyodideInstance(w);
                } else {
                    setPyodideReady(true);
                }
            }
        };

        initPyodide();
    }, []);

    const initializePyodideInstance = async (w: PyodideWindow) => {
        try {
            const pyodide = await w.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
            });
            // Override stdout to capture Python print statements
            pyodide.setStdout({ batched: (str: string) => setOutput(prev => prev + str + '\n') });
            pyodide.setStderr({ batched: (str: string) => setOutput(prev => prev + str + '\n') });
            
            // Load essential data science packages
            await pyodide.loadPackage(['numpy', 'pandas', 'scipy', 'matplotlib']);
            
            pyodideRef.current = pyodide;
            setPyodideReady(true);
        } catch (err: any) {
            console.error("Pyodide yuklashda xatolik:", err);
            setError("Python Engine ishga tushmadi: " + err.message);
        }
    };

    const handleRun = async () => {
        if (!pyodideReady || !pyodideRef.current) return;
        
        setIsRunning(true);
        setOutput('');
        setError(null);
        setPlots([]);
        
        try {
            const pyodide = pyodideRef.current;
            
            // Setup a python wrapper that catches plt.show() and turns it into base64 
            // string that we can render, instead of failing since we don't have a DOM for canvas.
            const wrappedCode = `
import sys
import io
import base64

def _display_matplotlib():
    try:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            img_str = base64.b64encode(buf.read()).decode('utf-8')
            plt.clf()
            return img_str
    except ImportError:
        pass
    return None

${code.split('\\n').map(line => '    ' + line).join('\\n')}

_display_matplotlib()
`;
            
            const result = await pyodide.runPythonAsync(wrappedCode);
            
            // Check if result returned any base64 image data
            if (typeof result === 'string' && result.length > 100 && !result.includes('\n')) {
                setPlots((prev: string[]) => [...prev, result]);
            } else if (result !== undefined && typeof result !== 'function') {
                setOutput(prev => prev + (prev.endsWith('\n') ? '' : '\n') + String(result));
            }
            
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="my-6 rounded-xl overflow-hidden border border-border bg-card shadow-sm flex flex-col font-sans">
            <Script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js" strategy="lazyOnload" />
            
            {/* Header / Cell Toolbar */}
            <div className="bg-muted/30 border-b border-border/50 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-mono font-medium">
                    <Code2 className="w-3.5 h-3.5" />
                    Python Jupyter Cell
                </div>
                <div className="flex items-center gap-2">
                    {!pyodideReady ? (
                        <div className="flex items-center gap-1.5 text-orange-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Engine yuklanmoqda...
                        </div>
                    ) : (
                        <button 
                            onClick={handleRun}
                            disabled={isRunning}
                            className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 px-3 py-1 rounded transition-colors disabled:opacity-50"
                        >
                            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            Run Code
                        </button>
                    )}
                </div>
            </div>

            {/* Code Input Area */}
            <div className="relative group bg-muted/10">
                <textarea 
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full min-h-[100px] bg-transparent border-none focus:outline-none p-4 font-mono text-sm leading-relaxed text-foreground resize-y whitespace-pre"
                    spellCheck="false"
                />
            </div>

            {/* Output Area (Only visible if there is output or error or plots) */}
            {(output || error || plots.length > 0) && (
                <div className="border-t border-border/50 bg-[#1e1e1e] dark:bg-[#0d0d0d] p-4 text-sm font-mono flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest font-sans mb-1">
                        <Terminal className="w-3.5 h-3.5" /> Output
                    </div>
                    {plots.map((imgBase64, idx) => (
                        <div key={idx} className="my-2 p-2 bg-white rounded flex justify-center w-full overflow-x-auto">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`data:image/png;base64,${imgBase64}`} alt="Matplotlib Plot" className="max-w-full" />
                        </div>
                    ))}
                    {output && <pre className="text-gray-300 whitespace-pre-wrap overflow-x-auto">{output}</pre>}
                    {error && <pre className="text-red-400 whitespace-pre-wrap overflow-x-auto border-t border-red-500/20 pt-2 mt-2">{error}</pre>}
                </div>
            )}
        </div>
    );
}
