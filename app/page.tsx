import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sigma } from "lucide-react";

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
                        <Link href="/documents" className="ml-1 inline-flex h-9 items-center rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-4 text-[11px] font-semibold text-white outline-none transition-colors hover:bg-[var(--ax-accent)] focus-visible:shadow-[var(--ax-focus-ring)]">
                            Open Writer
                        </Link>
                    </nav>
                </div>
            </header>

            <main>
                <section className="mx-auto grid max-w-[1440px] items-center gap-10 px-6 pb-12 pt-12 sm:px-8 lg:grid-cols-[0.66fr_1.34fr] lg:gap-12 lg:px-10 lg:pb-10 lg:pt-10 xl:px-12">
                    <div className="max-w-[500px] lg:pb-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-accent)]">Scientific writing · connected to evidence</p>
                        <h1 className="mt-4 font-serif text-[clamp(3.35rem,5.4vw,5.9rem)] font-medium leading-[0.95] tracking-[-0.055em]">
                            Research,
                            <br />
                            ready to publish.
                        </h1>
                        <div className="mt-6 h-[3px] w-14 bg-[var(--ax-accent)]" />
                        <p className="mt-5 max-w-[440px] text-[17px] leading-7 text-[var(--ax-text-soft)] sm:text-[18px]">
                            Write papers, reports and books while keeping equations, figures and scientific results connected to the Project they came from.
                        </p>
                        <div className="mt-7 flex flex-wrap items-center gap-3">
                            <Link href="/documents" className="inline-flex h-11 items-center gap-2 rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-5 text-sm font-semibold text-white shadow-[var(--ax-shadow-subtle)]">
                                Open Writer <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link href="/project" className="inline-flex h-11 items-center rounded-[var(--ax-radius-control)] border border-[var(--ax-line-strong)] bg-[var(--ax-surface)] px-5 text-sm font-semibold text-[var(--ax-text)]">
                                Use Project results
                            </Link>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[15px] border border-[var(--ax-line)] bg-[var(--ax-surface)] shadow-[var(--ax-shadow-floating)]">
                        <div className="flex h-9 items-center justify-between border-b border-[var(--ax-line)] px-3.5 text-[10px] text-[var(--ax-text-faint)]">
                            <span>Manuscript · Diffusion in bounded media</span><span>Draft</span>
                        </div>
                        <div className="grid min-h-[390px] md:grid-cols-[150px_1fr]">
                            <aside className="border-b border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-3 md:border-b-0 md:border-r">
                                <div className="text-[8px] font-semibold uppercase tracking-[0.13em] text-[var(--ax-text-faint)]">Document</div>
                                <div className="mt-3 space-y-1 text-[10px] text-[var(--ax-text-soft)]">
                                    {['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'References'].map((item, index) => (
                                        <div key={item} className={`rounded-[6px] px-2 py-2 ${index === 3 ? 'bg-[var(--ax-surface)] font-semibold text-[var(--ax-text)] shadow-[0_1px_2px_rgb(23_36_54_/_0.05)]' : ''}`}>{item}</div>
                                    ))}
                                </div>
                            </aside>
                            <div className="bg-[var(--ax-canvas)] p-4 sm:p-6">
                                <div className="mx-auto min-h-[335px] max-w-[700px] border border-[var(--ax-line)] bg-white px-7 py-8 shadow-[0_8px_24px_rgb(23_36_54_/_0.05)] sm:px-10">
                                    <div className="text-center font-serif text-[24px] tracking-[-0.03em] text-[#15181e]">Diffusion in bounded media</div>
                                    <div className="mt-2 text-center text-[9px] text-[#8b95a3]">A. Researcher · Axion Science Project</div>
                                    <div className="mt-6 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7480]">Results</div>
                                    <p className="mt-2 text-[11px] leading-5 text-[#555f6c]">The dominant spatial mode decays exponentially while preserving the expected symmetry of the boundary-constrained solution.</p>
                                    <div className="mt-4 rounded-[7px] border border-[#e3e7ed] bg-[#fbfcfe] px-4 py-3 text-center font-serif text-[18px] text-[#171a20]">u(x,t) = e<sup>−αt</sup> sin(x)</div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                                        <div className="rounded-[7px] border border-[#e3e7ed] bg-[#fbfcfe] p-3">
                                            <div className="text-[8px] text-[#8b95a3]">Figure 4 · linked result</div>
                                            <svg viewBox="0 0 250 80" className="mt-2 h-[80px] w-full" aria-hidden="true">
                                                <path d="M4 40H246" stroke="#d7dde5" strokeWidth="1" />
                                                <path d="M4 40 C30 10 58 10 84 40 C110 70 138 70 164 40 C190 10 218 10 246 40" fill="none" stroke="#245da8" strokeWidth="2" />
                                            </svg>
                                        </div>
                                        <div className="rounded-[7px] border border-[#e3e7ed] bg-white p-3 text-[9px] leading-5 text-[#66707c]">
                                            <span className="font-semibold text-[#20242b]">Source</span><br />Math · PDE result<br /><br /><span className="font-semibold text-[#20242b]">Revision</span><br />Pinned · r4
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
