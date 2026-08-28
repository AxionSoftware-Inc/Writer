"use client";

import { useEffect, useState } from "react";
import { Calculator, X } from "lucide-react";

export type MathSymbol = {
    tex: string;
    disp: string;
};

const SYMBOL_CATEGORIES: Record<string, MathSymbol[]> = {
    Greek: [
        { tex: "\\alpha", disp: "α" }, { tex: "\\beta", disp: "β" }, { tex: "\\gamma", disp: "γ" },
        { tex: "\\delta", disp: "δ" }, { tex: "\\epsilon", disp: "ε" }, { tex: "\\theta", disp: "θ" },
        { tex: "\\lambda", disp: "λ" }, { tex: "\\mu", disp: "μ" }, { tex: "\\pi", disp: "π" },
        { tex: "\\sigma", disp: "σ" }, { tex: "\\phi", disp: "φ" }, { tex: "\\omega", disp: "ω" },
        { tex: "\\Delta", disp: "Δ" }, { tex: "\\Sigma", disp: "Σ" }, { tex: "\\Omega", disp: "Ω" },
    ],
    Calculus: [
        { tex: "\\int", disp: "∫" }, { tex: "\\iint", disp: "∬" }, { tex: "\\oint", disp: "∮" },
        { tex: "\\partial", disp: "∂" }, { tex: "\\nabla", disp: "∇" }, { tex: "\\infty", disp: "∞" },
        { tex: "\\lim_{x \\to \\infty}", disp: "lim" }, { tex: "\\sum_{i=1}^{n}", disp: "∑" }, { tex: "\\prod_{i=1}^{n}", disp: "∏" },
        { tex: "\\frac{d}{dx}", disp: "d/dx" },
    ],
    Algebra: [
        { tex: "\\sqrt{x}", disp: "√x" }, { tex: "\\sqrt[n]{x}", disp: "n√x" },
        { tex: "\\frac{a}{b}", disp: "a/b" }, { tex: "x^{2}", disp: "x²" }, { tex: "x_{i}", disp: "xᵢ" },
        { tex: "\\log_{b}(x)", disp: "log" }, { tex: "\\ln(x)", disp: "ln" }, { tex: "\\sin(x)", disp: "sin" },
        { tex: "\\cos(x)", disp: "cos" }, { tex: "\\tan(x)", disp: "tan" },
    ],
    "Logic & Set": [
        { tex: "\\forall", disp: "∀" }, { tex: "\\exists", disp: "∃" }, { tex: "\\nexists", disp: "∄" },
        { tex: "\\in", disp: "∈" }, { tex: "\\notin", disp: "∉" }, { tex: "\\subset", disp: "⊂" },
        { tex: "\\subseteq", disp: "⊆" }, { tex: "\\cup", disp: "∪" }, { tex: "\\cap", disp: "∩" },
        { tex: "\\emptyset", disp: "∅" }, { tex: "\\mathbb{R}", disp: "ℝ" }, { tex: "\\mathbb{N}", disp: "ℕ" },
        { tex: "\\mathbb{Z}", disp: "ℤ" }, { tex: "\\mathbb{C}", disp: "ℂ" }, { tex: "\\mathbb{Q}", disp: "ℚ" },
    ],
    Operators: [
        { tex: "\\approx", disp: "≈" }, { tex: "\\neq", disp: "≠" }, { tex: "\\le", disp: "≤" },
        { tex: "\\ge", disp: "≥" }, { tex: "\\pm", disp: "±" }, { tex: "\\mp", disp: "∓" },
        { tex: "\\times", disp: "×" }, { tex: "\\div", disp: "÷" }, { tex: "\\cdot", disp: "⋅" },
        { tex: "\\equiv", disp: "≡" }, { tex: "\\sim", disp: "∼" }, { tex: "\\propto", disp: "∝" },
    ],
    Arrows: [
        { tex: "\\rightarrow", disp: "→" }, { tex: "\\leftarrow", disp: "←" }, { tex: "\\leftrightarrow", disp: "↔" },
        { tex: "\\Rightarrow", disp: "⇒" }, { tex: "\\Leftarrow", disp: "⇐" }, { tex: "\\Leftrightarrow", disp: "⇔" },
        { tex: "\\mapsto", disp: "↦" }, { tex: "\\uparrow", disp: "↑" }, { tex: "\\downarrow", disp: "↓" },
    ],
    Matrices: [
        { tex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", disp: "[ ]²" },
        { tex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", disp: "( )²" },
        { tex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", disp: "| |²" },
        { tex: "\\begin{cases} x & \\text{if } x > 0 \\\\ -x & \\text{if } x < 0 \\end{cases}", disp: "{ cases" },
    ],
};

const categoryNames = Object.keys(SYMBOL_CATEGORIES);

export function MathKeyboard({ onInsert }: { onInsert: (snippet: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(categoryNames[0]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const insertSymbol = (symbol: MathSymbol) => {
        const snippet =
            activeTab === "Matrices"
                ? `\n$$\n${symbol.tex}\n$$\n`
                : ` $${symbol.tex}$ `;
        onInsert(snippet);
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-foreground/15 hover:bg-muted/30 hover:text-foreground"
                title="LaTeX simvollar klaviaturasi"
            >
                <Calculator className="h-3.5 w-3.5" />
                Math keyboard
            </button>
        );
    }

    return (
        <div
            className="fixed bottom-4 right-4 z-50 flex max-h-[min(520px,calc(100dvh-2rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border/70 bg-background shadow-2xl"
            role="dialog"
            aria-label="Math keyboard"
        >
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-sm font-black tracking-tight">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    Math keyboard
                </div>
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Math keyboardni yopish"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex shrink-0 overflow-x-auto border-b border-border/60 bg-muted/5 scrollbar-none" role="tablist">
                {categoryNames.map((category) => (
                    <button
                        key={category}
                        type="button"
                        onClick={() => setActiveTab(category)}
                        className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
                            activeTab === category
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        role="tab"
                        aria-selected={activeTab === category}
                    >
                        {category}
                    </button>
                ))}
            </div>

            <div className="grid flex-1 content-start grid-cols-4 gap-1.5 overflow-y-auto bg-muted/5 p-2.5 sm:grid-cols-5">
                {SYMBOL_CATEGORIES[activeTab].map((symbol) => (
                    <button
                        key={`${activeTab}-${symbol.tex}`}
                        type="button"
                        onClick={() => insertSymbol(symbol)}
                        className="flex h-11 items-center justify-center rounded-lg border border-border/50 bg-background font-mono text-xs font-semibold transition-colors hover:border-foreground/15 hover:bg-muted/30"
                        title={symbol.tex}
                        aria-label={`${symbol.disp}: ${symbol.tex}`}
                    >
                        {symbol.disp}
                    </button>
                ))}
            </div>
        </div>
    );
}
