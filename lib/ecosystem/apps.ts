export type EcosystemApp = "science" | "math" | "notebook" | "writer";

export const ECOSYSTEM_NAME = process.env.NEXT_PUBLIC_ECOSYSTEM_NAME || "Axion Science";

// Production defaults assume one browser origin with path-based routing.
// Local development can override any app with NEXT_PUBLIC_*_URL, e.g. a different port.
const configuredUrls: Record<EcosystemApp, string> = {
  science: process.env.NEXT_PUBLIC_SCIENCE_URL || "/",
  math: process.env.NEXT_PUBLIC_MATH_URL || "/math",
  notebook: process.env.NEXT_PUBLIC_NOTEBOOK_URL || "/notebook",
  writer: process.env.NEXT_PUBLIC_WRITER_URL || "/writer",
};

export const ECOSYSTEM_APPS: Array<{ id: EcosystemApp; label: string }> = [
  { id: "math", label: "Math" },
  { id: "notebook", label: "Notebook" },
  { id: "writer", label: "Writer" },
  { id: "science", label: "Explore" },
];

export function getEcosystemHref(app: EcosystemApp, _currentApp: EcosystemApp, projectId?: string | null): string {
  const base = configuredUrls[app];
  if (!projectId) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}project=${encodeURIComponent(projectId)}`;
}
