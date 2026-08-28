const RAW_PLATFORM_URL = (process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "").replace(/\/$/, "");

export const PLATFORM_API_BASE = RAW_PLATFORM_URL
  ? RAW_PLATFORM_URL.endsWith("/api/platform")
    ? RAW_PLATFORM_URL
    : `${RAW_PLATFORM_URL}/api/platform`
  : "/api/platform";

export type PlatformRequestOptions = RequestInit & {
  token?: string;
};

export async function platformRequest<T>(path: string, options: PlatformRequestOptions = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(`${PLATFORM_API_BASE}${normalizedPath}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`PLATFORM_API_${response.status}:${detail || response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const platformPaths = {
  projects: "/projects/",
  objects: "/objects/",
  revisions: "/revisions/",
  references: "/references/",
  artifacts: "/artifacts/",
  activity: "/activity/",
} as const;
