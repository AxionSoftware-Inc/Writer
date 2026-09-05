export type EcosystemApp = "science" | "math" | "notebook" | "writer";

export const ECOSYSTEM_NAME = process.env.NEXT_PUBLIC_ECOSYSTEM_NAME || "Axion Science";

const configuredUrls: Record<EcosystemApp, string> = {
  science: process.env.NEXT_PUBLIC_SCIENCE_URL || "/",
  math: process.env.NEXT_PUBLIC_MATH_URL || "/math/laboratory",
  notebook: process.env.NEXT_PUBLIC_NOTEBOOK_URL || "/notebook/workspace",
  writer: process.env.NEXT_PUBLIC_WRITER_URL || "/writer/documents",
};

const primaryWorkRoutes: Record<EcosystemApp, string> = {
  science: "/",
  math: "/laboratory",
  notebook: "/workspace",
  writer: "/documents",
};

export const ECOSYSTEM_APPS: Array<{ id: EcosystemApp; label: string }> = [
  { id: "math", label: "Mathematics" },
  { id: "notebook", label: "Notebook" },
  { id: "writer", label: "Writer" },
  { id: "science", label: "Science" },
];

function withProjectAndParams(base: string, projectId?: string | null, params?: Record<string, string | null | undefined>) {
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(base);
  const url = new URL(base, "https://axion.local");
  if (projectId) url.searchParams.set("project", projectId);
  for (const [key, value] of Object.entries(params || {})) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

export function getEcosystemHref(app: EcosystemApp, _currentApp: EcosystemApp, projectId?: string | null): string {
  return withProjectAndParams(configuredUrls[app], projectId);
}

export function getEcosystemRouteHref(
  app: EcosystemApp,
  route: string,
  _currentApp: EcosystemApp,
  projectId?: string | null,
  params?: Record<string, string | null | undefined>,
): string {
  const base = configuredUrls[app];
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(base);
  const url = new URL(base, "https://axion.local");
  const primaryRoute = primaryWorkRoutes[app];
  let prefix = url.pathname;

  if (primaryRoute === "/") {
    prefix = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  } else if (url.pathname.endsWith(primaryRoute)) {
    prefix = url.pathname.slice(0, -primaryRoute.length);
  } else {
    prefix = url.pathname.replace(/\/$/, "");
  }

  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  url.pathname = `${prefix}${normalizedRoute}` || "/";
  url.search = "";
  if (projectId) url.searchParams.set("project", projectId);
  for (const [key, value] of Object.entries(params || {})) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }

  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}
