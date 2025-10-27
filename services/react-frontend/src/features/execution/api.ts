import { useAuth } from '../../contexts/AuthContext';

export interface ExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  recent_executions_24h: number;
  avg_execution_time: number;
}

export interface ExecutionRecord {
  id: string;
  test_name: string;
  status: string;
  success_rate: number;
  started_at: string;
  duration_seconds: number;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
}

export interface ExecutionStepsData {
  execution: {
    id: string;
    test_case_id: string;
    status: string;
    started_at: string;
    finished_at: string;
    duration_seconds: number;
  };
  steps: {
    step_order: number;
    action: string;
    target: string;
    status: string;
    error_message?: string;
    created_at: string;
  }[];
  summary: {
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
    pending_steps: number;
    success_rate: number;
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
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      headers: this.getAuthHeaders(),
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Redirect to login on auth failure
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
  }

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
}

export const executionApiService = new AuthenticatedApiService();