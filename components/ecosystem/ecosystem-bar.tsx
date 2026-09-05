"use client";

import { useEffect, useState } from "react";

import { ECOSYSTEM_APPS, ECOSYSTEM_NAME, getEcosystemHref, type EcosystemApp } from "@/lib/ecosystem/apps";
import { getLocalProjectTitle, resolveActiveProjectId } from "@/lib/ecosystem/project-context";

const shortcutKey: Record<EcosystemApp, string> = { math: "M", notebook: "N", writer: "W", science: "S" };

export function EcosystemBar({ currentApp, projectId, projectTitle }: { currentApp: EcosystemApp; projectId?: string | null; projectTitle?: string | null }) {
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const [activeProjectTitle, setActiveProjectTitle] = useState(projectTitle || null);

  useEffect(() => {
    const resolvedId = resolveActiveProjectId(projectId);
    setActiveProjectId(resolvedId);
    setActiveProjectTitle(projectTitle || getLocalProjectTitle(resolvedId));
  }, [projectId, projectTitle]);

  return (
    <div className="border-b border-[color-mix(in_srgb,var(--ax-line)_78%,transparent)] bg-[color-mix(in_srgb,var(--ax-surface)_94%,var(--ax-canvas))] text-[var(--ax-text-soft)]">
      <div className="mx-auto flex h-7 w-full max-w-[1520px] items-center justify-between gap-4 px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.17em] text-[var(--ax-accent)]/85" title="Axion Science · G then S">{ECOSYSTEM_NAME}</a>
        <nav className="flex min-w-0 self-stretch items-center overflow-x-auto" aria-label="Science ecosystem">
          {ECOSYSTEM_APPS.map((app) => {
            const href = getEcosystemHref(app.id, currentApp, activeProjectId);
            const active = app.id === currentApp;
            const className = `relative flex h-full items-center whitespace-nowrap px-3 text-[9.5px] font-medium transition-colors duration-[var(--ax-motion-fast)] ${active ? "text-[var(--ax-text)]" : "text-[var(--ax-text-faint)] hover:text-[var(--ax-text-soft)]"}`;
            const content = <>{app.label}{active ? <span className="absolute inset-x-3 bottom-0 h-px bg-[var(--ax-accent)]/75" /> : null}</>;
            return href === "#" ? <span key={app.id} className={`${className} cursor-default opacity-40`}>{content}</span> : <a key={app.id} href={href} className={className} aria-current={active ? "page" : undefined} title={`Go to ${app.label} · G then ${shortcutKey[app.id]}`}>{content}</a>;
          })}
        </nav>
        <a href={getEcosystemHref("science", currentApp, activeProjectId)} className="hidden min-w-0 max-w-[280px] items-center gap-2 text-[9.5px] sm:flex" title="Open Project in Axion Science"><span className="text-[var(--ax-text-faint)]">Project</span><span className="truncate font-medium text-[var(--ax-text-soft)]">{activeProjectTitle || (activeProjectId ? "Active project" : "Local workspace")}</span></a>
      </div>
    </div>
  );
}
