import { MCPFrontendManager } from "../../services/mcpFrontendClient";
import {
  ReviewItem,
  ReviewCreate,
  ReviewUpdateStatus,
  VerifyResponse,
  SuggestRequest,
  SuggestResponse,
} from "./types";

<<<<<<< Updated upstream
// Custom http function for review API that points to the unified API
async function reviewHttp<T>(path: string, init: RequestInit = {}): Promise<T> {
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

// Always use /api/v1/review/... and point directly to SQL backend
const P = "/api/v1/review";

export const ReviewAPI = {
  add: (payload: ReviewCreate) =>
    reviewHttp<ReviewItem>(`${P}/add`, { method: "POST", body: JSON.stringify(payload) }),

  listPending: (page = 1, limit = 50) =>
    reviewHttp<ReviewItem[]>(`/api/v1/review/pending?page=${page}&limit=${limit}`),

  get: (id: string) => reviewHttp<ReviewItem>(`${P}/${id}`),

  updateStatus: (id: string, update: ReviewUpdateStatus) =>
    reviewHttp<ReviewItem>(`/api/review-queue/${id}/resolve`, { 
      method: "POST", 
      body: JSON.stringify({ 
        action: update.status === 'approved' ? 'approve' : 'reject',
        notes: `Status updated to ${update.status}`
      }) 
    }),

  verify: (id: string, context: Record<string, unknown> = {}) =>
    reviewHttp<VerifyResponse>(`${P}/${id}/verify`, { method: "POST", body: JSON.stringify(context) }),

  suggest: (req: SuggestRequest, max?: number) =>
    reviewHttp<SuggestResponse>(
      `${P}/suggest${max ? `?max_alternatives=${max}` : ""}`,
      { method: "POST", body: JSON.stringify(req) }
    ),

  // Healing API endpoints
  getHealingStats: () =>
    reviewHttp<{
      total_attempts: number;
      successful_healings: number;
      failed_healings: number;
      unique_elements: number;
      healing_success_rate: number;
      most_common_healings: Array<{ pattern: string; count: number }>;
    }>("/api/v1/healing/stats"),

  batchApproveHealing: (elementIds: string[]) =>
    reviewHttp<{
      success: boolean;
      message: string;
      updated_count: number;
    }>("/api/v1/healing/batch-approve", {
      method: "POST",
      body: JSON.stringify(elementIds)
    }),
=======
/**
 * Review API using MCP Protocol
 * 
 * All review operations now go through the MCP server instead of REST APIs.
 */
export const ReviewAPI = {
  add: async (payload: ReviewCreate): Promise<ReviewItem> => {
    const client = await MCPFrontendManager.getInstance();
    // This would need a corresponding MCP tool for adding reviews
    throw new Error("Review creation via MCP not yet implemented");
  },

  listPending: async (page = 1, limit = 50): Promise<ReviewItem[]> => {
    const client = await MCPFrontendManager.getInstance();
    const result = await client.getPendingReviews();
    return result.data || result;
  },

  get: async (id: string): Promise<ReviewItem> => {
    const client = await MCPFrontendManager.getInstance();
    // This would need a corresponding MCP tool for getting individual reviews
    throw new Error("Individual review fetch via MCP not yet implemented");
  },

  updateStatus: async (id: string, update: ReviewUpdateStatus): Promise<ReviewItem> => {
    const client = await MCPFrontendManager.getInstance();
    const result = await client.updateReviewStatus(id, update.status as "approved" | "rejected");
    return result;
  },

  verify: async (id: string, context: Record<string, unknown> = {}): Promise<VerifyResponse> => {
    const client = await MCPFrontendManager.getInstance();
    // This would need a corresponding MCP tool for verification
    throw new Error("Review verification via MCP not yet implemented");
  },

  suggest: async (req: SuggestRequest, max?: number): Promise<SuggestResponse> => {
    const client = await MCPFrontendManager.getInstance();
    // This would need a corresponding MCP tool for suggestions
    throw new Error("Review suggestions via MCP not yet implemented");
  },

  // Healing API endpoints via MCP
  getHealingStats: async () => {
    const client = await MCPFrontendManager.getInstance();
    const result = await client.callTool("analytics_healing_data", { timeRange: "30d" });
    return result.data || result;
  },

  batchApproveHealing: async (elementIds: string[]) => {
    const client = await MCPFrontendManager.getInstance();
    // This would need a corresponding MCP tool for batch healing approval
    throw new Error("Batch healing approval via MCP not yet implemented");
  },

  // New MCP-specific methods for review queue
  getReviewQueue: async (params: {
    status?: string;
    page?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const client = await MCPFrontendManager.getInstance();
    return await client.getReviewQueue(params);
  },

  approveReview: async (reviewId: string) => {
    const client = await MCPFrontendManager.getInstance();
    return await client.approveReview(reviewId);
  },

  rejectReview: async (reviewId: string) => {
    const client = await MCPFrontendManager.getInstance();
    return await client.rejectReview(reviewId);
  }
>>>>>>> Stashed changes
};
