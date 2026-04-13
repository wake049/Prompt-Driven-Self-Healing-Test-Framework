/**
 * Collaborative Review API Service
 * Handles prompt versioning, reviews, comments, and activity tracking
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  title?: string;
  description?: string;
  change_summary?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';
  is_active: boolean;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  step_count?: number;
  pending_reviews?: number;
  plan_snapshot?: any;
}

export interface ReviewRequest {
  id: string;
  version_id: string;
  requested_by: string;
  requested_by_name?: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_email?: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'dismissed';
  review_comment?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface PromptComment {
  id: string;
  prompt_id: string;
  version_id?: string;
  parent_comment_id?: string;
  content: string;
  step_index?: number;
  author_id: string;
  author_name?: string;
  author_email?: string;
  status: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  replies?: PromptComment[];
}

export interface PromptActivity {
  id: string;
  prompt_id: string;
  version_id?: string;
  activity_type: string;
  actor_id: string;
  actor_name?: string;
  actor_email?: string;
  details?: Record<string, any>;
  summary?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

export interface CreateVersionRequest {
  title?: string;
  description?: string;
  change_summary?: string;
  plan_snapshot: any;
}

export interface CreateReviewRequest {
  reviewer_ids: string[];
  message?: string;
}

export interface SubmitReviewRequest {
  status: 'approved' | 'changes_requested';
  comment?: string;
}

export interface CreateCommentRequest {
  content: string;
  version_id?: string;
  parent_comment_id?: string;
  step_index?: number;
}

// =============================================================================
// API SERVICE CLASS
// =============================================================================

import { config } from '../../app/config';

class CollaborativeReviewApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeaders(),
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // =============================================================================
  // VERSION ENDPOINTS
  // =============================================================================

  async getVersions(promptId: string): Promise<PromptVersion[]> {
    return this.fetchWithAuth<PromptVersion[]>(`/api/v1/reviews/prompts/${promptId}/versions`);
  }

  async getVersion(promptId: string, versionId: string): Promise<PromptVersion> {
    return this.fetchWithAuth<PromptVersion>(`/api/v1/reviews/prompts/${promptId}/versions/${versionId}`);
  }

  async createVersion(promptId: string, data: CreateVersionRequest): Promise<PromptVersion> {
    return this.fetchWithAuth<PromptVersion>(`/api/v1/reviews/prompts/${promptId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async activateVersion(promptId: string, versionId: string): Promise<{ message: string; version_id: string }> {
    return this.fetchWithAuth(`/api/v1/reviews/prompts/${promptId}/versions/${versionId}/activate`, {
      method: 'POST',
    });
  }

  // =============================================================================
  // REVIEW ENDPOINTS
  // =============================================================================

  async requestReview(promptId: string, versionId: string, data: CreateReviewRequest): Promise<any> {
    return this.fetchWithAuth(`/api/v1/reviews/prompts/${promptId}/versions/${versionId}/request-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVersionReviews(promptId: string, versionId: string): Promise<ReviewRequest[]> {
    return this.fetchWithAuth<ReviewRequest[]>(`/api/v1/reviews/prompts/${promptId}/versions/${versionId}/reviews`);
  }

  async submitReview(reviewId: string, data: SubmitReviewRequest): Promise<any> {
    return this.fetchWithAuth(`/api/v1/reviews/reviews/${reviewId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyPendingReviews(): Promise<any[]> {
    return this.fetchWithAuth('/api/v1/reviews/pending-reviews');
  }

  // =============================================================================
  // COMMENT ENDPOINTS
  // =============================================================================

  async getComments(promptId: string, versionId?: string): Promise<PromptComment[]> {
    const url = versionId 
      ? `/api/v1/reviews/prompts/${promptId}/comments?version_id=${versionId}`
      : `/api/v1/reviews/prompts/${promptId}/comments`;
    return this.fetchWithAuth<PromptComment[]>(url);
  }

  async createComment(promptId: string, data: CreateCommentRequest): Promise<PromptComment> {
    return this.fetchWithAuth<PromptComment>(`/api/v1/reviews/prompts/${promptId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateComment(commentId: string, content: string): Promise<any> {
    return this.fetchWithAuth(`/api/v1/reviews/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.fetchWithAuth(`/api/v1/reviews/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // =============================================================================
  // ACTIVITY ENDPOINTS
  // =============================================================================

  async getActivity(promptId: string, limit: number = 50): Promise<PromptActivity[]> {
    return this.fetchWithAuth<PromptActivity[]>(`/api/v1/reviews/prompts/${promptId}/activity?limit=${limit}`);
  }

  // =============================================================================
  // TEAM ENDPOINTS
  // =============================================================================

  async getAvailableReviewers(promptId: string): Promise<TeamMember[]> {
    return this.fetchWithAuth<TeamMember[]>(`/api/v1/reviews/prompts/${promptId}/available-reviewers`);
  }
}

export const collaborativeReviewApi = new CollaborativeReviewApiService();
