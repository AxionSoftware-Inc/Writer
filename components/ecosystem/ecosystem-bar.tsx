"use client";

import { useEffect, useState } from "react";
import { ECOSYSTEM_APPS, ECOSYSTEM_NAME, getEcosystemHref, type EcosystemApp } from "@/lib/ecosystem/apps";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";

export function EcosystemBar({ currentApp, projectId, projectTitle }: { currentApp: EcosystemApp; projectId?: string | null; projectTitle?: string | null; }) {
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const [activeProjectTitle, setActiveProjectTitle] = useState(projectTitle || null);

  useEffect(() => {
    const resolvedId = resolveActiveProjectId(projectId);
    setActiveProjectId(resolvedId);
    setActiveProjectTitle(projectTitle || getLocalProjectTitle(resolvedId));
  }, [projectId, projectTitle]);

  return (
    <div className="border-b border-[#e7e9ee] bg-[#f7f8fa] text-[#606875]">
      <div className="mx-auto flex h-9 w-full max-w-[1720px] items-center justify-between gap-3 px-4 sm:px-6">
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="shrink-0 text-[11px] font-semibold tracking-[0.08em] text-[#111827]">{ECOSYSTEM_NAME}</a>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Science ecosystem">
          {ECOSYSTEM_APPS.map((app) => { const href = getEcosystemHref(app.id, currentApp, activeProjectId); const active = app.id === currentApp; const className = `whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] transition ${active ? "bg-white font-semibold text-[#111827] ring-1 ring-[#dde1e7]" : "text-[#69717d] hover:text-[#111827]"}`; return href === "#" ? <span key={app.id} className={`${className} cursor-default opacity-45`}>{app.label}</span> : <a key={app.id} href={href} className={className} aria-current={active ? "page" : undefined}>{app.label}</a>; })}
        </nav>
        <div className="hidden min-w-0 max-w-[280px] items-center gap-2 text-[11px] sm:flex">
          <span className="text-[#9aa1ab]">Project</span>
          {activeProjectId ? (
            <a href={`/project?project=${encodeURIComponent(activeProjectId)}`} className="truncate font-medium text-[#303640] hover:text-[#111827] hover:underline">
              {activeProjectTitle || "Active project"}
            </a>
          ) : (
            <span className="truncate font-medium text-[#303640]">Local workspace</span>
          )}
        </div>
      </div>
    </div>
  );
}
