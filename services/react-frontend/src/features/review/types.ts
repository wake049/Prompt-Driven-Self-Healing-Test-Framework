export type ReviewStatus = "pending" | "approved" | "rejected" | "auto_approved" | "verified_fail";
export type ActionType = "click" | "type" | "assert_visible";

export interface ReviewItem { /* same as earlier message */ 
  id: string; page: string; element_id: string; suggested_locator: string;
  old_locator?: string | null; suggested_by?: string | null; confidence_score: number;
  ai_reasoning?: string | null; intended_action: ActionType; action_payload?: Record<string, unknown> | null;
  status: ReviewStatus; reviewer_notes?: string | null; created_at: string; updated_at?: string | null; element_repo_id?: string | null;
}

export interface ReviewCreate { /* fields as shared earlier */ 
  page: string; element_id: string; suggested_locator: string; old_locator?: string;
  suggested_by?: string; confidence_score?: number; ai_reasoning?: string; intended_action?: ActionType;
  action_payload?: Record<string, unknown>; element_repo_id?: string;
}

export interface ReviewUpdateStatus { status: ReviewStatus; reviewer_notes?: string; }
export interface VerifyResponse { review_id: string; heuristic_pass: boolean; functional_pass: boolean; details: Record<string, unknown>; }

export interface SuggestRequest { page: string; old_locator?: string; dom_snippet?: string; screenshot_path?: string; max_alternatives?: number; }
export interface SuggestAlternative { selector: string; confidence: number; ai_reasoning?: string; }
export interface SuggestResponse { alternatives: SuggestAlternative[]; }
