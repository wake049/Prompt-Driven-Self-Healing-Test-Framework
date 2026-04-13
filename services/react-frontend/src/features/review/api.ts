import { MCPFrontendManager } from "../../services/mcpFrontendClient";
import {
  ReviewItem,
  ReviewCreate,
  ReviewUpdateStatus,
  VerifyResponse,
  SuggestRequest,
  SuggestResponse,
} from "./types";

/**
 * Review API using MCP Protocol
 * 
 * All review operations now go through the MCP server instead of REST APIs.
 */
export const ReviewAPI = {
  add: async (payload: ReviewCreate): Promise<ReviewItem> => {
    const response = await fetch('/api/v1/healing/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to create review: ${response.statusText}`);
    return response.json();
  },

  listPending: async (page = 1, limit = 50): Promise<ReviewItem[]> => {
    const client = await MCPFrontendManager.getInstance();
    const result = await client.getPendingReviews();
    return result.data || result;
  },

  get: async (id: string): Promise<ReviewItem> => {
    const response = await fetch(`/api/v1/healing/review-queue?search=${encodeURIComponent(id)}&limit=1`);
    if (!response.ok) throw new Error(`Failed to fetch review: ${response.statusText}`);
    const data = await response.json();
    const items = data.items || data;
    if (!items || items.length === 0) throw new Error('Review not found');
    return items[0];
  },

  updateStatus: async (id: string, update: ReviewUpdateStatus): Promise<ReviewItem> => {
    const client = await MCPFrontendManager.getInstance();
    const result = await client.updateReviewStatus(id, update.status as "approved" | "rejected");
    return result;
  },

  verify: async (id: string, _context: Record<string, unknown> = {}): Promise<VerifyResponse> => {
    const response = await fetch(`/api/v1/healing/review-queue?search=${encodeURIComponent(id)}&limit=1`);
    if (!response.ok) throw new Error(`Failed to verify review: ${response.statusText}`);
    const data = await response.json();
    const items = data.items || data;
    return {
      valid: items.length > 0,
      confidence: items.length > 0 ? 1.0 : 0,
    } as VerifyResponse;
  },

  suggest: async (_req: SuggestRequest, _max?: number): Promise<SuggestResponse> => {
    return { suggestions: [] } as SuggestResponse;
  },

  // Healing API endpoints via MCP
  getHealingStats: async () => {
    const client = await MCPFrontendManager.getInstance();
    const result = await client.callTool("analytics_healing_data", { timeRange: "30d" });
    return result.data || result;
  },

  batchApproveHealing: async (elementIds: string[]) => {
    const results = await Promise.all(
      elementIds.map(async (id) => {
        const response = await fetch(`/api/v1/healing/review/${id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved' }),
        });
        return { id, success: response.ok };
      })
    );
    return results;
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
};
