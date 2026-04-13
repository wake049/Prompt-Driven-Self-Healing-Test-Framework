const resolveApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_UNIFIED_API_URL;
  if (envUrl) return envUrl;
  if (import.meta.env.PROD) {
    // In production, use the same origin (API behind reverse proxy)
    return window.location.origin;
  }
  return "http://localhost:8000";
};

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  authTokenKey: "auth_token",
};