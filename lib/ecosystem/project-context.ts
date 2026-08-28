export const ACTIVE_PROJECT_KEY = "axion.science.active-project.v1";
export const LOCAL_PROJECTS_KEY = "axion.science.projects.v1";

export function rememberActiveProjectId(projectId: string | null | undefined) {
  if (typeof window === "undefined" || !projectId) return;
  window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
}

export function resolveActiveProjectId(preferred?: string | null) {
  if (typeof window === "undefined") return preferred || null;
  const fromUrl = new URLSearchParams(window.location.search).get("project");
  const resolved = preferred || fromUrl || window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (resolved) rememberActiveProjectId(resolved);
  return resolved;
}

export function getLocalProjectTitle(projectId: string | null | undefined) {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return null;
    const projects = JSON.parse(raw) as Array<{ id?: string; title?: string }>;
    return projects.find((project) => project.id === projectId)?.title || null;
  } catch {
    return null;
  }
}
