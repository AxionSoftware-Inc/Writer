"use client";

import React from "react";

import { getEcosystemHref, type EcosystemApp } from "@/lib/ecosystem/apps";
import { resolveActiveProjectId } from "@/lib/ecosystem/project-context";

const shortcuts: Record<string, EcosystemApp> = { m: "math", n: "notebook", w: "writer", s: "science" };

function isTypingTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)));
}

export function EcosystemKeyboardNav({ currentApp }: { currentApp: EcosystemApp }) {
  const waitingForDestination = React.useRef(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => {
    const reset = () => {
      waitingForDestination.current = false;
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (waitingForDestination.current) {
        const destination = shortcuts[key];
        reset();
        if (!destination) return;
        event.preventDefault();
        window.location.assign(getEcosystemHref(destination, currentApp, resolveActiveProjectId()));
        return;
      }
      if (key === "g") {
        waitingForDestination.current = true;
        timer.current = window.setTimeout(reset, 900);
      } else if (key === "escape") reset();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); reset(); };
  }, [currentApp]);

  return null;
}
