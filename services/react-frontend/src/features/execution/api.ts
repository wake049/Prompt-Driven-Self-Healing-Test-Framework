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
export interface ExecutionSummaryRequest {
  execution_id: string;
  include_steps?: boolean;
  include_failures?: boolean;
  include_performance?: boolean;
  summary_style?: "brief" | "detailed" | "technical";
}
export interface ExecutionSummaryResponse {
  execution_id: string;
  summary: string;
  key_insights: string[];
  execution_overview: {
    execution_id: string;
    prompt_text: string;
    prompt_title: string;
    status: string;
    duration_seconds: number;
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
    success_rate: number;
  };
  generated_at: string;
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
    let url = '/api/execution-dashboard/stats';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.test_case_id) params.append('test_case_id', filters.test_case_id);
      if (filters.prompt_id) params.append('prompt_id', filters.prompt_id);
      if (params.toString()) url += `?${params.toString()}`;
    }
    return this.fetchWithAuth<ExecutionStats>(url);
  }
  async getRecentExecutions(options?: { limit?: number; test_case_id?: string; prompt_id?: string }): Promise<ExecutionRecord[]> {
    let url = '/api/execution-dashboard/recent';
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.test_case_id) params.append('test_case_id', options.test_case_id);
    if (options?.prompt_id) params.append('prompt_id', options.prompt_id);
    if (params.toString()) url += `?${params.toString()}`;
    return this.fetchWithAuth<ExecutionRecord[]>(url);
  }
  async getExecutionSteps(executionId: string): Promise<ExecutionStepsData> {
    return this.fetchWithAuth<ExecutionStepsData>(`/api/execution-dashboard/execution/${executionId}/steps`);
  }
  async getExecutionDetails(executionId: string): Promise<any> {
    return this.fetchWithAuth<any>(`/api/execution-dashboard/execution/${executionId}/details`);
  }
  // M7: LLM v3 Natural Language Summaries (SCRUM-17)
  async generateExecutionSummary(
    executionId: string, 
    request: ExecutionSummaryRequest
  ): Promise<ExecutionSummaryResponse> {
    return this.fetchWithAuth<ExecutionSummaryResponse>(
      `/api/execution-dashboard/llm-summaries/execution/${executionId}/summary`,
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );
  }
  async getCachedExecutionSummary(executionId: string): Promise<ExecutionSummaryResponse> {
    return this.fetchWithAuth<ExecutionSummaryResponse>(`/api/execution-dashboard/llm-summaries/execution/${executionId}/summary`);
  }
  async generateBatchSummaries(
    executionIds: string[], 
    summaryStyle: string = "brief"
  ): Promise<{
    summaries: Array<{
      execution_id: string;
      summary: string;
      key_insights: string[];
      status: string;
    }>;
    generated_count: number;
    requested_count: number;
    generated_at: string;
  }> {
    return this.fetchWithAuth(`/api/execution-dashboard/llm-summaries/batch-summaries`, {
      method: 'POST',
      body: JSON.stringify({ execution_ids: executionIds, summary_style: summaryStyle })
    });
  }
  // M7: Data Resolver Traceability (SCRUM-16)
  async getExecutionBindingUsage(executionId: string): Promise<{
    execution_id: string;
    execution_status: string;
    bindings_count: number;
    bindings_used: Array<{
      binding_name: string;
      binding_scope: string;
      binding_value: any;
      usage_context: any;
      step_order?: number;
      action_type?: string;
      recorded_at: string;
      recorded_by: string;
    }>;
    execution_period: {
      started_at: string;
      finished_at: string;
    };
  }> {
    return this.fetchWithAuth(`/api/execution-dashboard/data-traceability/execution/${executionId}/binding-usage`);
  }
  async getBindingExecutionHistory(
    bindingName: string, 
    limit: number = 50
  ): Promise<{
    binding_name: string;
    executions_count: number;
    executions: Array<{
      execution_id: string;
      execution_status: string;
      prompt_id: string;
      prompt_text: string;
      binding_value: any;
      usage_context: any;
      step_order?: number;
      action_type?: string;
      used_at: string;
      execution_period: {
        started_at: string;
        finished_at: string;
      };
    }>;
  }> {
    return this.fetchWithAuth(`/api/execution-dashboard/data-traceability/binding/${bindingName}/executions?limit=${limit}`);
  }
  async getTraceabilitySummary(days: number = 30): Promise<{
    summary_period_days: number;
    execution_stats: {
      total_executions: number;
      executions_with_bindings: number;
      unique_bindings_used: number;
      binding_adoption_rate: number;
    };
    binding_usage: Array<{
      binding_name: string;
      executions_count: number;
      total_usages: number;
      action_types_count: number;
      first_used: string;
      last_used: string;
      usage_frequency: number;
    }>;
    top_bindings: Array<any>;
    generated_at: string;
  }> {
    return this.fetchWithAuth(`/api/execution-dashboard/data-traceability/traceability/summary?days=${days}`);
  }
}
export const executionApiService = new AuthenticatedApiService();