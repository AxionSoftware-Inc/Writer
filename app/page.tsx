import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sigma } from "lucide-react";

import { WriterHeroScene } from "@/components/home/writer-hero-scene";

function WriterMark() {
    return (
        <svg viewBox="0 0 40 40" className="h-9 w-9 text-[var(--ax-accent)]" aria-hidden="true">
            <circle cx="20" cy="20" r="17.2" fill="none" stroke="currentColor" strokeWidth="1.05" />
            <path d="M11 12h18M11 17.5h18M11 23h14M11 28.5h10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.68" />
            <path d="M26 27l5-5 2 2-5 5-3 1z" fill="currentColor" opacity="0.9" />
        </svg>
    );
}

const navLink = "rounded-[var(--ax-radius-control)] px-2.5 py-2 text-[12px] font-semibold text-[var(--ax-text-soft)] outline-none transition-colors duration-[var(--ax-motion-fast)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)] focus-visible:shadow-[var(--ax-focus-ring)]";
const container = "mx-auto w-full max-w-[1520px] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20";

function ManuscriptPreview() {
    return (
        <div className="overflow-hidden rounded-[18px] border border-[var(--ax-line)] bg-[var(--ax-surface)] shadow-[var(--ax-shadow-floating)]">
            <div className="flex h-10 items-center justify-between border-b border-[var(--ax-line)] px-4 text-[10px] text-[var(--ax-text-faint)]"><span>Manuscript · Diffusion in bounded media</span><span>Draft · evidence linked</span></div>
            <div className="grid min-h-[540px] lg:grid-cols-[205px_minmax(0,1fr)]">
                <aside className="border-b border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-5 lg:border-b-0 lg:border-r">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">Document</div>
                    <div className="mt-4 space-y-1.5 text-[11px] font-semibold text-[var(--ax-text-soft)]">
                        {['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'References'].map((item, index) => (
                            <div key={item} className={`rounded-[7px] px-3 py-2.5 ${index === 3 ? 'bg-[var(--ax-surface)] text-[var(--ax-text)] shadow-[0_1px_2px_rgb(23_36_54_/_0.05)]' : ''}`}>{item}</div>
                        ))}
                    </div>
                    <div className="mt-8 border-t border-[var(--ax-line)] pt-5 text-[10px] leading-5 text-[var(--ax-text-faint)]">Papers + reports<br />Figures + equations<br />Project evidence</div>
                </aside>

                <div className="bg-[var(--ax-canvas)] p-5 sm:p-8 lg:p-10">
                    <article className="mx-auto max-w-[760px] border border-[var(--ax-line)] bg-white px-7 py-9 shadow-[0_12px_32px_rgb(23_36_54_/_0.055)] sm:px-12 sm:py-12">
                        <div className="text-center font-serif text-[34px] leading-tight tracking-[-0.04em] text-[#15181e]">Diffusion in bounded media</div>
                        <div className="mt-2 text-center text-[9px] uppercase tracking-[0.12em] text-[#8993a0]">A. Researcher · Axion Science Project</div>
                        <div className="mt-8 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#6a7380]">Results</div>
                        <p className="mt-3 text-[12px] leading-6 text-[#59636f]">The dominant spatial mode decays exponentially while preserving the expected symmetry of the boundary-constrained solution.</p>
                        <div className="mt-5 border-y border-[#e3e7ed] bg-[#fbfcfe] px-4 py-4 text-center font-serif text-[23px] text-[#171a20]">u(x,t) = e<sup>−αt</sup> sin(x)</div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                            <div className="border border-[#e3e7ed] bg-[#fbfcfe] p-4">
                                <div className="text-[8px] uppercase tracking-[0.12em] text-[#8b95a3]">Figure 4 · linked result</div>
                                <svg viewBox="0 0 300 150" className="mt-3 h-[150px] w-full" aria-hidden="true">
                                    <path d="M10 75H290M150 12V138" stroke="#d7dde5" strokeWidth="1" />
                                    <path d="M10 75 C42 29 74 30 105 75 C136 120 166 120 198 75 C230 30 260 32 290 75" fill="none" stroke="#2f6fbe" strokeWidth="2.2" />
                                </svg>
                            </div>
                            <div className="border border-[#e3e7ed] bg-white p-4 text-[10px] leading-5 text-[#66707c]">
                                <div className="text-[8px] uppercase tracking-[0.12em] text-[#8b95a3]">Evidence</div>
                                <div className="mt-4"><span className="font-semibold text-[#20242b]">Source</span><br />Math · PDE result</div>
                                <div className="mt-4"><span className="font-semibold text-[#20242b]">Revision</span><br />Pinned · r4</div>
                                <div className="mt-4"><span className="font-semibold text-[#20242b]">Project</span><br />Thermal transport</div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </div>
    );
}

export default function WriterHomePage() {
    return (
        <div className="min-h-[calc(100vh-32px)] bg-[var(--ax-canvas)] text-[var(--ax-text)]">
            <header className="sticky top-0 z-40 border-b border-[var(--ax-line)] bg-[color-mix(in_srgb,var(--ax-surface)_94%,transparent)] backdrop-blur-xl">
                <div className={`${container} flex h-[72px] items-center justify-between gap-6`}>
                    <Link href="/" className="flex min-w-0 items-center gap-3.5 rounded-[var(--ax-radius-control)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]"><WriterMark /><span className="min-w-0 leading-none"><span className="block truncate font-serif text-[23px] font-medium tracking-[-0.035em]">Axion Writer</span><span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.28em] text-[var(--ax-text-faint)]">Scientific publishing</span></span></Link>
                    <nav className="hidden items-center gap-1 xl:flex" aria-label="Writer product"><Link href="#product" className={navLink}>Product</Link><Link href="#workflow" className={navLink}>Workflow</Link><Link href="#capabilities" className={navLink}>Capabilities</Link><Link href="#ecosystem" className={navLink}>Ecosystem</Link></nav>
                    <div className="flex items-center gap-2"><Link href="/project" className="hidden rounded-[var(--ax-radius-control)] px-3 py-2 text-[11px] font-semibold text-[var(--ax-text-soft)] hover:bg-[var(--ax-surface-soft)] sm:inline-flex">Project results</Link><Link href="/documents" className="inline-flex h-10 items-center rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--ax-accent)] sm:px-5">Open Writer <span className="ml-2 text-sm">→</span></Link></div>
                </div>
            </header>

            <main>
                <div className={container}><section className="relative grid min-h-[620px] items-center gap-6 overflow-hidden pb-8 pt-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-0 lg:pb-5 lg:pt-5"><div className="relative z-10 max-w-[570px] py-10 lg:py-16"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Axion Writer · scientific publishing</p><h1 className="mt-4 font-serif text-[clamp(3.75rem,5.9vw,6.8rem)] font-medium leading-[0.92] tracking-[-0.058em]">Research,<br />ready to <span className="italic">publish.</span></h1><div className="mt-7 flex items-center gap-2" aria-hidden="true"><span className="h-[3px] w-16 rounded-full bg-[var(--ax-accent)]" /><span className="h-1.5 w-1.5 rounded-full bg-[#9b8cf0]" /></div><p className="mt-6 max-w-[480px] text-[17px] leading-8 text-[var(--ax-text-soft)] sm:text-[18px]">Write papers, reports and books while keeping equations, figures and scientific results connected to the Project they came from.</p><div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/documents" className="inline-flex h-11 items-center gap-2 rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-5 text-sm font-semibold text-white shadow-[var(--ax-shadow-subtle)] hover:bg-[var(--ax-accent)]">Open Writer <ArrowRight className="h-4 w-4" /></Link><Link href="#product" className="inline-flex h-11 items-center gap-2 rounded-[var(--ax-radius-control)] px-4 text-sm font-semibold hover:bg-[var(--ax-surface-soft)]">Explore the product <ArrowRight className="h-3.5 w-3.5 text-[var(--ax-text-faint)]" /></Link></div></div><div className="relative min-w-0 lg:-ml-14 lg:-mr-8 xl:-ml-20 xl:-mr-12"><WriterHeroScene /></div></section></div>

                <section className="border-y border-[var(--ax-line)] bg-[var(--ax-surface)]"><div className={`${container} grid md:grid-cols-3 md:divide-x md:divide-[var(--ax-line)]`}>{[["Write","A quiet manuscript-first environment for scientific documents."],["Evidence","Bring equations, figures and results from the active Project."],["Publish","Keep structure clean for review, export and final publication."]].map(([title,text])=><div key={title} className="border-b border-[var(--ax-line)] py-7 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0"><div className="font-serif text-[24px] tracking-[-0.035em]">{title}</div><p className="mt-2 max-w-sm text-[13px] leading-6 text-[var(--ax-text-soft)]">{text}</p></div>)}</div></section>

                <section id="product" className="py-20 md:py-24 lg:py-28"><div className={container}><div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">The product</p><h2 className="mt-4 max-w-[650px] font-serif text-[clamp(2.8rem,4.2vw,5.1rem)] leading-[0.98] tracking-[-0.05em]">A manuscript workspace where the science stays traceable.</h2></div><p className="max-w-[650px] text-[16px] leading-8 text-[var(--ax-text-soft)] lg:justify-self-end">Writer keeps the page clean while equations, figures and scientific objects remain connected to the Project behind them.</p></div><div className="mt-12"><ManuscriptPreview /></div></div></section>

                <section id="workflow" className="border-y border-[var(--ax-line)] bg-[var(--ax-surface)] py-20 md:py-24"><div className={container}><div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Publication workflow</p><h2 className="mt-4 font-serif text-[clamp(2.8rem,4vw,4.7rem)] leading-[1] tracking-[-0.05em]">From evidence to publication without the broken handoff.</h2><p className="mt-5 max-w-[440px] text-[15px] leading-7 text-[var(--ax-text-soft)]">The manuscript is the hero. Scientific provenance stays available without turning the writing surface into an engineering dashboard.</p></div><div className="divide-y divide-[var(--ax-line)] border-y border-[var(--ax-line)]">{[["01","Evidence","Bring a saved result, equation or figure from the Project."],["02","Structure","Build the paper, report or book around a clear document hierarchy."],["03","Write","Develop argument, methods, results and discussion in a quiet page-first workspace."],["04","Review","Keep scientific source context available while editing."],["05","Publish","Export a clean document without losing the trail behind it."]].map(([step,title,text])=><div key={step} className="grid gap-3 py-5 sm:grid-cols-[60px_150px_1fr] sm:items-center"><div className="font-serif text-[18px] text-[var(--ax-text-faint)]">{step}</div><div className="font-serif text-[25px] tracking-[-0.035em]">{title}</div><div className="text-[12px] leading-6 text-[var(--ax-text-soft)]">{text}</div></div>)}</div></div></div></section>

                <section id="capabilities" className="py-20 md:py-24 lg:py-28"><div className={container}><div className="max-w-[760px]"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Built for serious scientific writing</p><h2 className="mt-4 font-serif text-[clamp(2.9rem,4.4vw,5.2rem)] leading-[0.98] tracking-[-0.05em]">The manuscript stays elegant. The evidence stays underneath.</h2></div><div className="mt-14 divide-y divide-[var(--ax-line)] border-y border-[var(--ax-line)]">
                    <article className="grid gap-8 py-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:py-14"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">01 · Manuscript first</div><h3 className="mt-3 font-serif text-[34px] tracking-[-0.04em]">A page should still feel like a page.</h3><p className="mt-4 max-w-[470px] text-sm leading-7 text-[var(--ax-text-soft)]">Typography, whitespace and document structure stay dominant. Tooling supports the writing instead of surrounding it with chrome.</p></div><div className="lg:border-l lg:border-[var(--ax-line)] lg:pl-12"><div className="border border-[var(--ax-line)] bg-white px-8 py-10 shadow-[0_10px_28px_rgb(23_36_54_/_0.04)]"><div className="text-center font-serif text-[29px]">A Study of Diffusion Dynamics</div><div className="mx-auto mt-5 h-px max-w-[360px] bg-[var(--ax-line)]" /><p className="mx-auto mt-5 max-w-[480px] text-[12px] leading-6 text-[var(--ax-text-soft)]">A manuscript-first surface designed for long-form scientific reading and writing.</p></div></div></article>
                    <article className="grid gap-8 py-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:py-14"><div className="order-2 lg:order-1">{[["Equation","u(x,t) = e⁻ᵅᵗ sin(x)"],["Figure","Linked Math visualization"],["Source","PDE result · revision 4"],["Project","Thermal transport"]].map(([label,value])=><div key={label} className="grid grid-cols-[110px_1fr] border-b border-[var(--ax-line)] py-3 text-[12px]"><span className="text-[var(--ax-text-faint)]">{label}</span><span className="font-semibold">{value}</span></div>)}</div><div className="order-1 lg:order-2 lg:pl-10"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">02 · Evidence stays connected</div><h3 className="mt-3 font-serif text-[34px] tracking-[-0.04em]">Use the result, not a pasted screenshot of it.</h3><p className="mt-4 max-w-[470px] text-sm leading-7 text-[var(--ax-text-soft)]">Bring structured scientific objects into the document with enough provenance to understand where they came from.</p></div></article>
                    <article className="grid gap-8 py-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:py-14"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-text-faint)]">03 · Publication-ready structure</div><h3 className="mt-3 font-serif text-[34px] tracking-[-0.04em]">Write once. Prepare for review and export.</h3><p className="mt-4 max-w-[470px] text-sm leading-7 text-[var(--ax-text-soft)]">Sections, references, figures and document metadata stay organized for later PDF, DOCX and publication workflows.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:border-l lg:border-[var(--ax-line)] lg:pl-12">{['Papers & reports','Books & long-form work','Figures & equations','References & export'].map((item)=><div key={item} className="border-t border-[var(--ax-line)] py-4 font-serif text-[22px] tracking-[-0.03em]">{item}</div>)}</div></article>
                </div></div></section>

                <section id="ecosystem" className="border-y border-[var(--ax-line)] bg-[var(--ax-surface)] py-20 md:py-24 lg:py-28"><div className={container}><div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Connected scientific work</p><h2 className="mt-4 font-serif text-[clamp(2.8rem,4.2vw,5rem)] leading-[1] tracking-[-0.05em]">Writer is where the research becomes communicable.</h2><p className="mt-5 max-w-[500px] text-[15px] leading-7 text-[var(--ax-text-soft)]">Math creates evidence. Notebook develops interpretation. Writer turns both into a publication without severing their context.</p></div><div className="grid md:grid-cols-3">{[{step:'01',title:'Math',text:'Create the evidence.',icon:Sigma},{step:'02',title:'Notebook',text:'Develop the reasoning.',icon:BookOpen},{step:'03',title:'Writer',text:'Publish the work.',icon:FileText}].map((item,index)=><div key={item.title} className={`relative border-t border-[var(--ax-line)] py-6 md:border-t-0 md:px-7 ${index?'md:border-l':''}`}><div className="flex items-center justify-between"><item.icon className="h-5 w-5 text-[var(--ax-accent)]" /><span className="font-serif text-[18px] text-[var(--ax-text-faint)]">{item.step}</span></div><div className="mt-8 font-serif text-[28px] tracking-[-0.04em]">{item.title}</div><p className="mt-2 text-[12px] leading-6 text-[var(--ax-text-soft)]">{item.text}</p>{index<2?<ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-[var(--ax-text-faint)] md:block" />:null}</div>)}</div></div></div></section>

                <section className="py-24 md:py-32"><div className={container}><div className="mx-auto max-w-[980px] text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ax-accent)]">Axion Writer</p><h2 className="mt-5 font-serif text-[clamp(3rem,5.2vw,6.2rem)] leading-[0.95] tracking-[-0.055em]">Turn scientific evidence into something worth <span className="italic">reading.</span></h2><p className="mx-auto mt-6 max-w-[620px] text-[16px] leading-8 text-[var(--ax-text-soft)]">Open a manuscript-first workspace for papers, reports, books and publication-ready scientific documents.</p><Link href="/documents" className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--ax-radius-control)] bg-[var(--ax-accent-strong)] px-6 text-sm font-semibold text-white hover:bg-[var(--ax-accent)]">Open Writer <ArrowRight className="h-4 w-4" /></Link></div></div></section>
            </main>

            <footer className="border-t border-[var(--ax-line)] bg-[var(--ax-surface)] py-10"><div className={`${container} grid gap-8 md:grid-cols-[1fr_auto] md:items-end`}><div><div className="font-serif text-[24px] tracking-[-0.035em]">Axion Writer</div><p className="mt-2 max-w-md text-[11px] leading-5 text-[var(--ax-text-faint)]">Scientific writing and publication inside Axion Science.</p><div className="mt-6 text-[10px] text-[var(--ax-text-faint)]">Axion Science</div></div><nav className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-[var(--ax-text-soft)]"><Link href="#product">Product</Link><Link href="#workflow">Workflow</Link><Link href="#ecosystem">Ecosystem</Link><Link href="/documents" className="text-[var(--ax-accent)]">Open Writer →</Link></nav></div></footer>
        </div>
    );
}
