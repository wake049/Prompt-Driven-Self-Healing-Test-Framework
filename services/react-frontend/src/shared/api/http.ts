import { config } from "../../app/config";
function authHeader(): Record<string, string> {
  const token = localStorage.getItem(config.authTokenKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function buildHeaders(initHeaders?: HeadersInit, extra?: Record<string, string>): Headers {
  const h = new Headers(initHeaders ?? {});
  // default content-type unless caller overrides
  if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) h.set(k, String(v));
    }
  }
  return h;
}
export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`;
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...init, headers });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  if (!ct.includes("application/json")) throw new Error(`Non-JSON: ${await res.text()}`);
  return res.json() as Promise<T>;
}
