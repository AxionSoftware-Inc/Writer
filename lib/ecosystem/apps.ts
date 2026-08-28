export type EcosystemApp = "science" | "math" | "notebook" | "writer";

export const ECOSYSTEM_NAME = process.env.NEXT_PUBLIC_ECOSYSTEM_NAME || "Axion Science";

const configuredUrls: Record<EcosystemApp, string> = {
  science: process.env.NEXT_PUBLIC_SCIENCE_URL || "",
  math: process.env.NEXT_PUBLIC_MATH_URL || "",
  notebook: process.env.NEXT_PUBLIC_NOTEBOOK_URL || "",
  writer: process.env.NEXT_PUBLIC_WRITER_URL || "",
};

export const ECOSYSTEM_APPS: Array<{ id: EcosystemApp; label: string }> = [
  { id: "math", label: "Math" },
  { id: "notebook", label: "Notebook" },
  { id: "writer", label: "Writer" },
  { id: "science", label: "Explore" },
];

export function getEcosystemHref(app: EcosystemApp, currentApp: EcosystemApp, projectId?: string | null): string {
  const base = configuredUrls[app] || (app === currentApp ? "/" : "#");
  if (base === "#" || !projectId) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}project=${encodeURIComponent(projectId)}`;
}
