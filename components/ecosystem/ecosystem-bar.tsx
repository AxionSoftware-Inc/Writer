"use client";

import { useEffect, useState } from "react";

import { ECOSYSTEM_APPS, ECOSYSTEM_NAME, getEcosystemHref, type EcosystemApp } from "@/lib/ecosystem/apps";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";

export function EcosystemBar({ currentApp, projectId, projectTitle }: { currentApp: EcosystemApp; projectId?: string | null; projectTitle?: string | null }) {
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const [activeProjectTitle, setActiveProjectTitle] = useState(projectTitle || null);

  useEffect(() => {
    const resolvedId = resolveActiveProjectId(projectId);
    setActiveProjectId(resolvedId);
    setActiveProjectTitle(projectTitle || getLocalProjectTitle(resolvedId));
  }, [projectId, projectTitle]);

  return (
    <div className="border-b border-[var(--ax-line)] bg-[var(--ax-surface-soft)] text-[var(--ax-text-soft)]">
      <div className="mx-auto flex h-9 w-full max-w-[var(--ax-content-max)] items-center justify-between gap-3 px-4 sm:px-6">
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="shrink-0 text-[11px] font-semibold tracking-[0.08em] text-[var(--ax-text)]">{ECOSYSTEM_NAME}</a>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Science ecosystem">
          {ECOSYSTEM_APPS.map((app) => {
            const href = getEcosystemHref(app.id, currentApp, activeProjectId);
            const active = app.id === currentApp;
            const className = `whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[11px] transition-colors duration-[var(--ax-motion-fast)] ${active ? "bg-[var(--ax-surface)] font-semibold text-[var(--ax-text)] shadow-[0_1px_2px_rgb(23_36_54_/_0.06)]" : "text-[var(--ax-text-soft)] hover:text-[var(--ax-text)]"}`;
            return href === "#" ? <span key={app.id} className={`${className} cursor-default opacity-45`}>{app.label}</span> : <a key={app.id} href={href} className={className} aria-current={active ? "page" : undefined}>{app.label}</a>;
          })}
        </nav>
        <div className="hidden min-w-0 max-w-[280px] items-center gap-2 text-[11px] sm:flex">
          <span className="text-[var(--ax-text-faint)]">Project</span>
          {activeProjectId ? (
            <a href={`/project?project=${encodeURIComponent(activeProjectId)}`} className="truncate font-medium text-[var(--ax-text)] hover:text-[var(--ax-accent-strong)]">
              {activeProjectTitle || "Active project"}
            </a>
          ) : (
            <span className="truncate font-medium text-[var(--ax-text)]">Local workspace</span>
          )}
        </div>
      </div>
    </div>
  );
}
