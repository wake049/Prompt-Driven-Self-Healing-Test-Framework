import { http } from "../../shared/api/http";
import {
  ReviewItem,
  ReviewCreate,
  ReviewUpdateStatus,
  VerifyResponse,
  SuggestRequest,
  SuggestResponse,
} from "./types";

// Custom http function for review API that points to the SQL backend on port 3001
async function reviewHttp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `http://localhost:3001${path}`;
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
};
