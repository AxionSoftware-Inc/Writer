"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";

export type MathSymbol = {
    tex: string;
    disp: string;
};

const SYMBOL_CATEGORIES: Record<string, MathSymbol[]> = {
    "Greek": [
        { tex: "\\alpha", disp: "α" }, { tex: "\\beta", disp: "β" }, { tex: "\\gamma", disp: "γ" },
        { tex: "\\delta", disp: "δ" }, { tex: "\\epsilon", disp: "ε" }, { tex: "\\theta", disp: "θ" },
        { tex: "\\lambda", disp: "λ" }, { tex: "\\mu", disp: "μ" }, { tex: "\\pi", disp: "π" },
        { tex: "\\sigma", disp: "σ" }, { tex: "\\phi", disp: "φ" }, { tex: "\\omega", disp: "ω" },
        { tex: "\\Delta", disp: "Δ" }, { tex: "\\Sigma", disp: "Σ" }, { tex: "\\Omega", disp: "Ω" },
    ],
    "Calculus": [
        { tex: "\\int", disp: "∫" }, { tex: "\\iint", disp: "∬" }, { tex: "\\oint", disp: "∮" },
        { tex: "\\partial", disp: "∂" }, { tex: "\\nabla", disp: "∇" }, { tex: "\\infty", disp: "∞" },
        { tex: "\\lim_{x \\to \\infty}", disp: "lim" }, { tex: "\\sum_{i=1}^{n}", disp: "∑" }, { tex: "\\prod_{i=1}^{n}", disp: "∏" },
        { tex: "d/dx", disp: "d/dx" },
    ],
    "Algebra": [
        { tex: "\\sqrt{x}", disp: "√x" }, { tex: "\\sqrt[n]{x}", disp: "n√x" },
        { tex: "\\frac{a}{b}", disp: "a/b" }, { tex: "x^{2}", disp: "x²" }, { tex: "x_{i}", disp: "x_i" },
        { tex: "\\log_{b}(x)", disp: "log" }, { tex: "\\ln(x)", disp: "ln" }, { tex: "\\sin(x)", disp: "sin" },
        { tex: "\\cos(x)", disp: "cos" }, { tex: "\\tan(x)", disp: "tan" },
    ],
    "Logic & Set": [
        { tex: "\\forall", disp: "∀" }, { tex: "\\exists", disp: "∃" }, { tex: "\\nexists", disp: "∄" },
        { tex: "\\in", disp: "∈" }, { tex: "\\notin", disp: "∉" }, { tex: "\\subset", disp: "⊂" },
        { tex: "\\subseteq", disp: "⊆" }, { tex: "\\cup", disp: "∪" }, { tex: "\\cap", disp: "∩" },
        { tex: "\\emptyset", disp: "∅" }, { tex: "\\mathbb{R}", disp: "ℝ" }, { tex: "\\mathbb{N}", disp: "ℕ" },
        { tex: "\\mathbb{Z}", disp: "ℤ" }, { tex: "\\mathbb{C}", disp: "ℂ" }, { tex: "\\mathbb{Q}", disp: "ℚ" }
    ],
    "Operators": [
        { tex: "\\approx", disp: "≈" }, { tex: "\\neq", disp: "≠" }, { tex: "\\le", disp: "≤" },
        { tex: "\\ge", disp: "≥" }, { tex: "\\pm", disp: "±" }, { tex: "\\mp", disp: "∓" },
        { tex: "\\times", disp: "×" }, { tex: "\\div", disp: "÷" }, { tex: "\\cdot", disp: "⋅" },
        { tex: "\\equiv", disp: "≡" }, { tex: "\\sim", disp: "∼" }, { tex: "\\propto", disp: "∝" }
    ],
    "Arrows": [
        { tex: "\\rightarrow", disp: "→" }, { tex: "\\leftarrow", disp: "←" }, { tex: "\\leftrightarrow", disp: "↔" },
        { tex: "\\Rightarrow", disp: "⇒" }, { tex: "\\Leftarrow", disp: "⇐" }, { tex: "\\Leftrightarrow", disp: "⇔" },
        { tex: "\\mapsto", disp: "↦" }, { tex: "\\uparrow", disp: "↑" }, { tex: "\\downarrow", disp: "↓" }
    ],
    "Matrices": [
        { tex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", disp: "[ ]²" },
        { tex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", disp: "( )²" },
        { tex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", disp: "| |²" },
        { tex: "\\begin{cases} x & \\text{if } x > 0 \\\\ -x & \\text{if } x < 0 \\end{cases}", disp: "{ cases" }
    ]
};

export function MathKeyboard({ onInsert }: { onInsert: (snippet: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>(Object.keys(SYMBOL_CATEGORIES)[0]);

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-accent transition-colors hover:opacity-90 shadow-sm"
                title="LaTeX simvollar klaviaturasi"
            >
                <Calculator className="h-4 w-4" />
                Math Keyboard
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex max-h-[500px] w-80 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl transition-all md:w-96">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2 text-sm font-black tracking-tight">
                    <Calculator className="h-4 w-4 text-accent" />
                    Math Keyboard
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-border/60 bg-muted/10 shrink-0 scrollbar-none">
                {Object.keys(SYMBOL_CATEGORIES).map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            activeTab === cat
                                ? "border-b-2 border-accent text-accent"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Symbols Grid */}
            <div className="grid flex-1 content-start grid-cols-4 gap-2 overflow-y-auto bg-muted/10 p-3 md:grid-cols-5">
                {SYMBOL_CATEGORIES[activeTab].map((symbol, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            // Insert with $$ or spaces if needed, but usually just raw tex is fine.
                            // Small heurictic: matrices output block format, others inline.
                            let snippet = symbol.tex;
                            if (activeTab === "Matrices") {
                                snippet = "\\n$$ " + snippet + " $$\\n";
                            } else {
                                snippet = " $" + snippet + "$ ";
                            }
                            onInsert(snippet);
                        }}
                        className="flex h-12 flex-col items-center justify-center rounded-xl border border-border/50 bg-background/80 shadow-sm transition-colors hover:border-accent/30 hover:bg-[var(--accent-soft)] hover:text-accent active:scale-95"
                        title={symbol.tex}
                    >
                        <span className="font-mono text-xs font-medium opacity-80 mb-0.5 pointer-events-none">
                            {symbol.disp}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
