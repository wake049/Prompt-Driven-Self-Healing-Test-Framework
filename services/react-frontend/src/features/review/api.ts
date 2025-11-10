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
};
