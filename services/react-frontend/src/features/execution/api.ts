import { useAuth } from '../../contexts/AuthContext';
import { config } from '../../app/config';

export interface ExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  pending_review_executions: number; // NEW: Count of executions needing review
  success_rate: number;
  recent_executions_24h: number;
  avg_execution_time: number;
  healing_rate?: number; // NEW: Percentage of executions that required healing
}

export interface ExecutionRecord {
  id: string;
  test_name: string;
  status: 'pass' | 'pending_review' | 'failed' | 'completed' | 'running'; // UPDATED: New status types
  success_rate: number;
  started_at: string;
  duration_seconds: number;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  pending_review_steps?: number; // NEW: Steps that passed but required healing
  healed_steps?: number; // NEW: Total healed steps count
}

export interface ExecutionStepsData {
  execution: {
    id: string;
    test_case_id: string;
    status: 'pass' | 'pending_review' | 'failed' | 'completed' | 'running'; // UPDATED: New status types
    started_at: string;
    finished_at: string;
    duration_seconds: number;
  };
  steps: {
    step_order: number;
    action: string;
    target: string;
    status: 'passed' | 'pending_review' | 'failed'; // UPDATED: New step status types
    error_message?: string;
    created_at: string;
    healed?: boolean; // NEW: Indicates if this step required healing
    original_locator?: string; // NEW: Original selector before healing
    healed_locator?: string; // NEW: Selector after healing
  }[];
  summary: {
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
    pending_review_steps: number; // NEW: Steps that passed but required healing
    pending_steps: number;
    success_rate: number;
    healing_rate?: number; // NEW: Percentage of steps that required healing
  };
}

class AuthenticatedApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
      headers: this.getAuthHeaders(),
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on auth failure
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      let errorDetail = '';
      try {
        const errorBody = await response.json();
        errorDetail = errorBody?.detail || errorBody?.message || errorBody?.error || '';
      } catch { /* ignore */ }
      if (response.status === 403 && errorDetail) {
        window.dispatchEvent(new CustomEvent('subscription-limit-error', { detail: errorDetail }));
      }
      throw new Error(errorDetail || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getExecutionStats(filters?: { test_case_id?: string; prompt_id?: string }): Promise<ExecutionStats> {
    let url = '/api/v1/dashboard/execution/stats';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.test_case_id) params.append('test_case_id', filters.test_case_id);
      if (filters.prompt_id) params.append('prompt_id', filters.prompt_id);
      if (params.toString()) url += `?${params.toString()}`;
    }
    return this.fetchWithAuth<ExecutionStats>(url);
  };

  async getRecentExecutions(options?: { limit?: number; test_case_id?: string; prompt_id?: string }): Promise<ExecutionRecord[]> {
    let url = '/api/v1/dashboard/execution/recent';
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.test_case_id) params.append('test_case_id', options.test_case_id);
    if (options?.prompt_id) params.append('prompt_id', options.prompt_id);
    if (params.toString()) url += `?${params.toString()}`;
    return this.fetchWithAuth<ExecutionRecord[]>(url);
  }

  async getExecutionSteps(executionId: string): Promise<ExecutionStepsData> {
    return this.fetchWithAuth<ExecutionStepsData>(`/api/v1/dashboard/execution/execution/${executionId}/steps`);
  }

  async getExecutionDetails(executionId: string): Promise<any> {
    return this.fetchWithAuth<any>(`/api/v1/dashboard/execution/execution/${executionId}/details`);
  }

  async getExecutionSummaryData(executionId: string): Promise<any> {
    return this.fetchWithAuth<any>(`/api/execution-dashboard/execution/${executionId}`);
  }
}

export const executionApiService = new AuthenticatedApiService();