// src/types/review.ts

export type ReviewStatus =
  | "draft"
  | "pending"
  | "verified"
  | "needs_fix"
  | "approved"
  | "rejected";

export type ReviewType =
  | "locator_proposal"
  | "locator_change"
  | "locator_failure";

export interface ReviewItem {
  id: string;
  page: string;
  element_id?: string; // backend may map this internally
  review_type: ReviewType;
  status: ReviewStatus;
  current_selector?: string;
  proposed_selector?: string;
  created_at: string;
  created_by?: string;
}
