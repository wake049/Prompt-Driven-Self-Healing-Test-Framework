import { http } from "../../shared/api/http";
import { config } from "../../app/config";
import { PageContext } from "./types";

const BASE_PATH = "/page-context";

function resolveApiBaseUrl(): string {
  return config.apiBaseUrl;
}

function normalizeScreenshotUrl(url?: string): string | undefined {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${resolveApiBaseUrl()}${url}`;
  return `${resolveApiBaseUrl()}/${url}`;
}

function normalizePageContext(context: PageContext): PageContext {
  return {
    ...context,
    screenshotUrl: normalizeScreenshotUrl((context as any).screenshotUrl || (context as any).screenshot_url),
  };
}

export const PageContextAPI = {
  // List all page contexts
  list: async (params?: {
    limit?: number;
    category?: string;
    search?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.category) queryParams.append("category", params.category);
    if (params?.search) queryParams.append("search", params.search);
    
    const query = queryParams.toString();
    const response = await http<{
      success: boolean;
      data: PageContext[];
      count: number;
    }>(`/api/v1${BASE_PATH}/list${query ? `?${query}` : ""}`);
    
    return response.data.map(normalizePageContext);
  },

  // Get a specific page context
  get: async (id: string) => {
    const response = await http<{
      success: boolean;
      data: PageContext;
    }>(`/api/v1${BASE_PATH}/${id}`);
    
    return normalizePageContext(response.data);
  },

  // Create a new page context
  create: async (data: FormData) => {
    const response = await fetch(`${resolveApiBaseUrl()}/api/v1${BASE_PATH}/upload`, {
      method: "POST",
      body: data,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const json = await response.json();
    if (json?.data?.screenshot_url || json?.data?.screenshotUrl) {
      json.data.screenshotUrl = normalizeScreenshotUrl(json.data.screenshotUrl || json.data.screenshot_url);
    }
    return json;
  },

  // Update a page context
  update: async (id: string, updates: Partial<PageContext>) => {
    const response = await http<{
      success: boolean;
      data: PageContext;
      message: string;
    }>(`/api/v1${BASE_PATH}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    
    return response.data;
  },

  // Update a page context with file uploads (like screenshots)
  updateWithFiles: async (id: string, data: FormData) => {
    const response = await fetch(`${resolveApiBaseUrl()}/api/v1${BASE_PATH}/${id}/upload`, {
      method: "PUT",
      body: data,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const json = await response.json();
    if (json?.data?.screenshot_url || json?.data?.screenshotUrl) {
      json.data.screenshotUrl = normalizeScreenshotUrl(json.data.screenshotUrl || json.data.screenshot_url);
    }
    return json;
  },

  // Delete a page context
  delete: async (id: string) => {
    const response = await http<{
      success: boolean;
      message: string;
    }>(`/api/v1${BASE_PATH}/${id}`, {
      method: "DELETE",
    });
    
    return response.success;
  },

  // Mark a page context as used
  use: async (id: string) => {
    const response = await http<{
      success: boolean;
      message: string;
    }>(`/api/v1${BASE_PATH}/${id}/use`, {
      method: "POST",
    });
    
    return response.success;
  },

  // Get user contexts
  getUserContexts: async (userId?: string) => {
    const queryParams = userId ? `?user_id=${userId}` : "";
    return http<PageContext[]>(`/api/v1${BASE_PATH}/user-contexts${queryParams}`);
  },

  // Get supported page types
  getSupportedTypes: async () => {
    return http<{
      page_types: Record<string, {
        description: string;
        primary_actions: string[];
        example_domains: string[];
      }>;
    }>(`/api/v1${BASE_PATH}/supported-types`);
  },

  // Get examples
  getExamples: async () => {
    return http<{
      examples: Array<{
        name: string;
        context: PageContext;
      }>;
    }>(`/api/v1${BASE_PATH}/examples`);
  },

  // AI-powered detection
  detect: async (data: {
    page_url?: string;
    page_title?: string;
    element_selectors?: string[];
    user_context?: Record<string, any>;
  }) => {
    return http<PageContext>(`/api/v1${BASE_PATH}/detect`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Create manual context
  createManual: async (data: {
    page_type: string;
    description: string;
    primary_actions: string[];
    testing_focus?: string;
    page_title?: string;
    domain_name?: string;
    user_notes?: string;
  }) => {
    return http<PageContext>(`/api/v1${BASE_PATH}/manual`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get context from URL
  fromUrl: async (url: string) => {
    return http<PageContext>(`/api/v1${BASE_PATH}/from-url?url=${encodeURIComponent(url)}`);
  },
};

// Helper function to get auth headers
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}