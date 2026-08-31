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

const promises = [
  ["Write", "A quiet manuscript-first environment for papers, reports and long-form scientific work."],
  ["Evidence", "Bring equations, figures and saved results from the Project without rebuilding them."],
  ["Publish", "Keep structure, provenance and export quality ready for review and final publication."],
];

const workflow = [
  ["01", "Evidence", "Start from the scientific objects, figures and equations that belong in the document."],
  ["02", "Structure", "Shape the manuscript with sections that stay readable and publication-oriented."],
  ["03", "Write", "Keep prose primary while equations, figures and citations sit exactly where they are needed."],
  ["04", "Review", "Inspect linked sources, revisions and document status without cluttering the manuscript."],
  ["05", "Publish", "Export a document that is clean for readers and traceable for researchers."],
];

function ManuscriptPreview() {
  return (
    <div className="ax-product-frame">
      <div className="flex h-11 items-center justify-between border-b border-[var(--ax-line)] px-5"><span className="ax-figure-label">Fig 01 · Scientific manuscript</span><span className="text-[10px] font-semibold text-[var(--ax-accent)]">Evidence linked</span></div>
      <div className="grid min-h-[570px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-5 lg:border-b-0 lg:border-r lg:p-6">
          <div className="ax-figure-label">Document</div>
          <div className="mt-6 space-y-1.5 text-[11px] font-semibold text-[var(--ax-text-soft)]">{['Abstract','Introduction','Methods','Results','Discussion','References'].map((item,index)=><div key={item} className={`rounded-[7px] px-3 py-2.5 ${index===3?'bg-white text-[var(--ax-text)] shadow-[var(--ax-shadow-subtle)]':''}`}>{item}</div>)}</div>
          <div className="mt-9 border-t border-[var(--ax-line)] pt-5 text-[10px] leading-5 text-[var(--ax-text-faint)]">Paper · r4<br />3 linked objects<br />Draft</div>
        </aside>
        <div className="bg-[var(--ax-canvas)] p-5 sm:p-8 lg:p-10">
          <article className="mx-auto min-h-[470px] max-w-[820px] border border-[var(--ax-line)] bg-white px-7 py-10 shadow-[var(--ax-shadow-subtle)] sm:px-12 lg:px-14">
            <p className="text-center text-[9px] uppercase tracking-[.16em] text-[var(--ax-text-faint)]">Research article</p>
            <h3 className="mx-auto mt-4 max-w-[620px] text-center font-serif text-[clamp(30px,4vw,48px)] leading-[1.02] tracking-[-.045em]">Diffusion in bounded media</h3>
            <p className="mt-3 text-center text-[10px] text-[var(--ax-text-faint)]">A. Researcher · Axion Science Project</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
              <div>
                <p className="ax-figure-label">Results</p>
                <p className="mt-3 text-[13px] leading-7 text-[var(--ax-text-soft)]">The dominant spatial mode decays exponentially while preserving the expected symmetry of the boundary-constrained solution.</p>
                <div className="mt-6 rounded-[12px] border border-[var(--ax-line)] bg-[var(--ax-surface-soft)] px-5 py-4 text-center font-serif text-[25px]">u(x,t) = e<sup>−αt</sup> sin(x)</div>
                <p className="mt-5 text-[12px] leading-6 text-[var(--ax-text-soft)]">This behavior agrees with the analytical form and the linked numerical result.</p>
              </div>
              <div className="rounded-[12px] border border-[var(--ax-line)] p-5">
                <div className="flex items-center justify-between"><span className="ax-figure-label">Figure 4</span><span className="text-[9px] font-semibold text-[var(--ax-accent)]">linked</span></div>
                <svg viewBox="0 0 320 190" className="mt-4 h-[190px] w-full" aria-hidden="true"><path d="M18 95H302M160 18V174" stroke="#d9e1eb" strokeWidth="1"/><path d="M18 95 C48 48 77 48 105 95 C134 142 161 142 190 95 C219 48 248 48 302 95" fill="none" stroke="#2f6fbe" strokeWidth="2.2"/><path d="M18 95 C60 70 88 70 126 95 C163 120 190 120 227 95 C264 70 286 76 302 95" fill="none" stroke="#93b3dd" strokeWidth="1.2" opacity=".72"/></svg>
                <div className="mt-4 border-t border-[var(--ax-line)] pt-4 text-[10px] leading-5 text-[var(--ax-text-faint)]">Source · Math<br/>Revision · pinned r4<br/>Project · Thermal transport</div>
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
    <div className="ax-landing min-h-[calc(100vh-32px)]">
      <header className="ax-premium-nav">
        <div className="ax-landing-container ax-premium-nav-inner">
          <Link href="/" className="flex min-w-0 items-center gap-3.5"><WriterMark/><span className="min-w-0 leading-none"><span className="block truncate font-serif text-[22px] font-medium tracking-[-0.035em]">Axion Writer</span><span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.25em] text-[var(--ax-text-faint)]">Scientific publishing</span></span></Link>
          <nav className="hidden items-center gap-1 xl:flex"><Link href="#product" className="ax-premium-nav-link">Product</Link><Link href="#workflow" className="ax-premium-nav-link">Workflow</Link><Link href="#capabilities" className="ax-premium-nav-link">Capabilities</Link><Link href="#ecosystem" className="ax-premium-nav-link">Ecosystem</Link></nav>
          <div className="flex items-center gap-1.5"><Link href="/documents" className="ax-premium-secondary hidden sm:inline-flex">Documents</Link><Link href="/documents" className="ax-premium-primary">Open Writer <span aria-hidden="true">→</span></Link></div>
        </div>
      </header>

      <main>
        <div className="ax-landing-container"><section className="ax-landing-hero"><div className="ax-hero-copy"><p className="ax-landing-kicker">Axion Writer · scientific publishing</p><h1 className="ax-landing-display">Research,<br/>ready to <span className="italic">publish.</span></h1><div className="ax-signature-rule" aria-hidden="true"/><p className="ax-landing-lead">Write papers, reports and books while keeping equations, figures and scientific results connected to the Project they came from.</p><div className="mt-8 flex flex-wrap gap-2"><Link href="/documents" className="ax-premium-primary">Open Writer <ArrowRight className="h-4 w-4"/></Link><Link href="#product" className="ax-premium-secondary">Explore the product <ArrowRight className="h-3.5 w-3.5 text-[var(--ax-text-faint)]"/></Link></div></div><div className="ax-hero-visual"><WriterHeroScene/></div></section></div>

        <section className="ax-promise-strip"><div className="ax-landing-container ax-promise-grid">{promises.map(([title,copy])=><div key={title} className="ax-promise-item"><div className="ax-promise-title">{title}</div><p className="ax-promise-copy">{copy}</p></div>)}</div></section>

        <section id="product" className="ax-landing-section"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">The product</p><h2 className="ax-section-title">A publication workspace built around the manuscript.</h2></div><p className="ax-section-copy">Writer keeps the page quiet while scientific evidence remains one click away. The document reads like a manuscript, not an admin dashboard.</p></div><ManuscriptPreview/></div></section>

        <section id="workflow" className="ax-landing-section ax-landing-section-alt"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">Publication workflow</p><h2 className="ax-section-title">From evidence to a document people can trust.</h2></div><p className="ax-section-copy">The scientific chain stays intact while the writing becomes cleaner. Evidence informs the manuscript without dominating it.</p></div><div className="ax-editorial-list">{workflow.map(([index,title,copy])=><div key={index} className="ax-editorial-row"><div className="ax-editorial-index">{index}</div><div className="ax-editorial-title">{title}</div><p className="ax-editorial-copy">{copy}</p></div>)}</div></div></section>

        <section id="capabilities" className="ax-landing-section"><div className="ax-landing-container"><div className="max-w-[820px]"><p className="ax-landing-kicker">Publication without broken handoffs</p><h2 className="ax-section-title">The manuscript stays clean. The science stays traceable.</h2></div><div className="ax-deep-grid">
          <article className="ax-deep-row"><div><p className="ax-figure-label">01 · Manuscript first</p><h3 className="ax-deep-title">Writing feels like writing.</h3><p className="ax-deep-copy">The page, hierarchy and typography remain primary. Scientific metadata stays secondary until the author asks for it.</p></div><div className="mx-auto w-full max-w-[620px] border border-[var(--ax-line)] bg-white p-8 shadow-[var(--ax-shadow-subtle)]"><div className="text-center font-serif text-[30px]">A quiet scientific page</div><p className="mx-auto mt-5 max-w-lg text-[13px] leading-7 text-[var(--ax-text-soft)]">Results, equations and prose can share one readable hierarchy without turning the manuscript into a collection of cards.</p></div></article>
          <article className="ax-deep-row"><div><p className="ax-figure-label">02 · Connected evidence</p><h3 className="ax-deep-title">Figures and equations keep their source.</h3><p className="ax-deep-copy">A result can be used in writing without losing which Project, revision or instrument produced it.</p></div><div className="divide-y divide-[var(--ax-line)] border-y border-[var(--ax-line)]">{[['Figure','Math · PDE result'],['Equation','Pinned · r4'],['Project','Thermal transport'],['Status','Evidence linked']].map(([label,value])=><div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-4 text-[12px]"><span className="text-[var(--ax-text-faint)]">{label}</span><span className="font-semibold">{value}</span></div>)}</div></article>
          <article className="ax-deep-row"><div><p className="ax-figure-label">03 · Publication quality</p><h3 className="ax-deep-title">The final document should survive the editor.</h3><p className="ax-deep-copy">Structure, figures and references are prepared for export and review rather than trapped inside the app.</p></div><div className="grid gap-3 sm:grid-cols-3">{[['PDF','Print-ready'],['DOCX','Editable'],['LaTeX','Open format']].map(([title,copy])=><div key={title} className="border-t border-[var(--ax-line)] py-5"><div className="font-serif text-[26px]">{title}</div><div className="mt-2 text-[11px] text-[var(--ax-text-soft)]">{copy}</div></div>)}</div></article>
        </div></div></section>

        <section id="ecosystem" className="ax-landing-section ax-landing-section-alt"><div className="ax-landing-container"><div className="ax-section-head"><div><p className="ax-landing-kicker">One research trail</p><h2 className="ax-section-title">Publication is the last handoff, not a restart.</h2></div><p className="ax-section-copy">Math creates the result. Notebook preserves the reasoning. Writer turns both into a document without breaking the scientific context.</p></div><div className="mt-14 grid gap-3 lg:grid-cols-3">{[{icon:Sigma,title:'Math',copy:'Create the calculation, plot and reusable scientific result.'},{icon:BookOpen,title:'Notebook',copy:'Capture interpretation, observations and findings.'},{icon:FileText,title:'Writer',copy:'Use the same evidence in the final manuscript.'}].map(({icon:Icon,title,copy},index)=><div key={title} className="relative border-t border-[var(--ax-line)] py-7 lg:px-7 lg:first:pl-0"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[var(--ax-accent)]"/><span className="font-serif text-[25px]">{title}</span></div><p className="mt-3 max-w-sm text-[13px] leading-6 text-[var(--ax-text-soft)]">{copy}</p>{index<2?<ArrowRight className="absolute right-2 top-9 hidden h-4 w-4 text-[var(--ax-text-faint)] lg:block"/>:null}</div>)}</div></div></section>

        <section className="ax-final-cta"><div className="ax-landing-container"><h2 className="ax-final-title">The paper should feel finished before you <span className="italic">export it.</span></h2><p className="ax-final-copy">Write in a publication-first environment where scientific evidence stays connected and the page stays quiet.</p><Link href="/documents" className="ax-premium-primary mt-8">Open Writer <ArrowRight className="h-4 w-4"/></Link></div></section>
      </main>

      <footer className="border-t border-[var(--ax-line)] bg-white"><div className="ax-landing-container flex flex-col justify-between gap-5 py-9 text-[11px] text-[var(--ax-text-faint)] sm:flex-row sm:items-center"><span>Axion Writer · part of Axion Science</span><div className="flex gap-6"><Link href="/documents">Documents</Link><Link href="#product">Product</Link><Link href="#ecosystem">Ecosystem</Link></div></div></footer>
    </div>
  );
}
