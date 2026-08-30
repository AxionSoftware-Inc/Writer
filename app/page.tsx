import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sigma } from "lucide-react";

import { WriterHeroScene } from "@/components/home/writer-hero-scene";

function WriterMark() {
    return (
        <svg viewBox="0 0 36 36" className="h-8 w-8 text-[var(--ax-accent)]" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M10 11h16M10 16h16M10 21h12M10 26h9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.72" />
            <path d="M23 24l4-4 2 2-4 4-3 1z" fill="currentColor" opacity="0.85" />
        </svg>
    );
}

const navLink = "rounded-[var(--ax-radius-control)] px-2 py-1.5 text-[12px] font-semibold text-[var(--ax-text-soft)] outline-none transition-colors duration-[var(--ax-motion-fast)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)] focus-visible:shadow-[var(--ax-focus-ring)]";

export default function WriterHomePage() {
    return (
        <div className="min-h-[calc(100vh-32px)] bg-[var(--ax-canvas)] text-[var(--ax-text)]">
            <header className="sticky top-0 z-40 border-b border-[var(--ax-line)] bg-[color-mix(in_srgb,var(--ax-surface)_96%,transparent)] backdrop-blur-xl">
                <div className="mx-auto flex h-16 w-full max-w-[var(--ax-content-max)] items-center justify-between gap-5 px-4 sm:px-6">
                    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-[var(--ax-radius-control)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
                        <WriterMark />
                        <span className="truncate text-[19px] font-medium tracking-[-0.025em] sm:text-[20px]">Axion Writer</span>
                    </Link>
                    <nav className="flex items-center gap-1 sm:gap-3" aria-label="Writer">
                        <div className="hidden items-center gap-1 lg:flex">
                            <Link href="#workflow" className={navLink}>Workflow</Link>
                            <Link href="/project" className={navLink}>Project results</Link>
                            <Link href="/documents" className={navLink}>Documents</Link>
                        </div>
                        <Link href="/documents" className="ml-1 inline-flex h-9 items-center rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-4 text-[11px] font-semibold text-white outline-none transition-colors hover:bg-[var(--ax-accent)] focus-visible:shadow-[var(--ax-focus-ring)]">Open Writer</Link>
                    </nav>
                </div>
            </header>

            <main>
                <section className="relative mx-auto grid min-h-[600px] max-w-[1540px] items-center gap-4 overflow-hidden px-6 pb-6 pt-8 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-0 lg:px-10 lg:pb-4 lg:pt-4 xl:px-12">
                    <div className="relative z-10 max-w-[560px] py-8 lg:py-14">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Axion Writer · scientific publishing</p>
                        <h1 className="mt-4 font-serif text-[clamp(3.65rem,5.9vw,6.65rem)] font-medium leading-[0.92] tracking-[-0.058em]">
                            Research,
                            <br />
                            ready to <span className="italic">publish.</span>
                        </h1>
                        <div className="mt-7 flex items-center gap-2" aria-hidden="true"><span className="h-[3px] w-16 rounded-full bg-[var(--ax-accent)]" /><span className="h-1.5 w-1.5 rounded-full bg-[#9b8cf0]" /></div>
                        <p className="mt-6 max-w-[470px] text-[17px] leading-8 text-[var(--ax-text-soft)] sm:text-[18px]">Write papers, reports and books while keeping equations, figures and scientific results connected to the Project they came from.</p>
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Link href="/documents" className="inline-flex h-11 items-center gap-2 rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-5 text-sm font-semibold text-white shadow-[var(--ax-shadow-subtle)] transition-colors hover:bg-[var(--ax-accent)]">Open Writer <ArrowRight className="h-4 w-4" /></Link>
                            <Link href="/project" className="inline-flex h-11 items-center gap-2 rounded-[var(--ax-radius-control)] px-4 text-sm font-semibold text-[var(--ax-text)] transition-colors hover:bg-[var(--ax-surface-soft)]">Use Project results <ArrowRight className="h-3.5 w-3.5 text-[var(--ax-text-faint)]" /></Link>
                        </div>
                    </div>
                    <div className="relative min-w-0 lg:-ml-14 lg:-mr-12 xl:-ml-20 xl:-mr-20"><WriterHeroScene /></div>
                </section>

                <section id="workflow" className="border-y border-[var(--ax-line)] bg-[var(--ax-surface)]">
                    <div className="mx-auto grid max-w-[1180px] gap-0 px-6 sm:px-8 md:grid-cols-3">
                        {[
                            { icon: FileText, title: 'Write', text: 'A quiet manuscript-first environment for scientific documents.' },
                            { icon: Sigma, title: 'Insert evidence', text: 'Bring equations, figures and saved results from the active Project.' },
                            { icon: BookOpen, title: 'Publish', text: 'Keep structure clean for export, review and final publication.' },
                        ].map((item, index) => (
                            <div key={item.title} className={`py-6 md:px-7 ${index ? 'md:border-l md:border-[var(--ax-line)]' : ''}`}>
                                <item.icon className="h-4 w-4 text-[var(--ax-accent)]" />
                                <div className="mt-3 text-sm font-semibold">{item.title}</div>
                                <p className="mt-1 text-sm leading-6 text-[var(--ax-text-soft)]">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1180px] px-6 py-14 sm:px-8 lg:py-20">
                    <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-accent)]">Publication without broken handoffs</p>
                            <h2 className="mt-3 font-serif text-4xl tracking-[-0.04em] sm:text-5xl">The manuscript stays clean. The science stays traceable.</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {['Papers & reports', 'Books & long-form work', 'Linked figures & equations', 'Project-aware provenance'].map((item) => (
                                <div key={item} className="border-t border-[var(--ax-line)] py-4 text-sm font-semibold text-[var(--ax-text)]">{item}</div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
