"use client";

import React from "react";

import { listLocalScientificObjects } from "@/lib/ecosystem/local-object-store";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";
import type { ScientificObject } from "@/lib/ecosystem/contracts";

export default function WriterProjectResultsPage() {
    const [projectId, setProjectId] = React.useState<string | null>(null);
    const [projectTitle, setProjectTitle] = React.useState<string | null>(null);
    const [objects, setObjects] = React.useState<ScientificObject[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const activeProjectId = resolveActiveProjectId();
        setProjectId(activeProjectId);
        setProjectTitle(getLocalProjectTitle(activeProjectId));
        if (!activeProjectId) {
            setLoading(false);
            return;
        }
        listLocalScientificObjects(activeProjectId)
            .then((items) => setObjects(items.filter((item) => item.sourceApp === "math")))
            .catch(() => setObjects([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="min-h-[calc(100vh-36px)] bg-[#fbfcfe] px-4 py-10 text-[#171a20] sm:px-6">
            <div className="mx-auto max-w-5xl">
                <a href={projectId ? `/?project=${encodeURIComponent(projectId)}` : "/"} className="text-xs font-semibold text-[#66707c] hover:text-[#171a20]">← Writer</a>
                <div className="mt-6 border-b border-[#e2e6ec] pb-7">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#184eb8]">Project results</div>
                    <h1 className="mt-2 font-serif text-4xl tracking-[-0.035em]">{projectTitle || "Active project"}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#66707c]">Choose a computed result and start a Writer draft from it. No server-side import step is required.</p>
                </div>

                {!projectId ? (
                    <div className="py-12 text-sm text-[#66707c]">No active Project. Open Writer from the Science Hub first.</div>
                ) : loading ? (
                    <div className="py-12 text-sm text-[#66707c]">Loading local results…</div>
                ) : objects.length ? (
                    <div className="divide-y divide-[#e6e9ee]">
                        {objects.map((object) => (
                            <article key={object.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-semibold">{object.title}</h2>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#8a929d]">{object.domain || object.kind} · revision {object.currentRevision}</div>
                                </div>
                                <a
                                    href={`/new?source=project&project=${encodeURIComponent(projectId)}&objectId=${encodeURIComponent(object.id)}`}
                                    className="inline-flex h-10 items-center justify-center rounded-[9px] bg-[#0b1f46] px-4 text-xs font-semibold text-white"
                                >
                                    New document
                                </a>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="py-12">
                        <div className="text-sm font-semibold">No saved Math results yet.</div>
                        <p className="mt-2 text-sm text-[#66707c]">Open Laboratory, solve a problem and press Save.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
