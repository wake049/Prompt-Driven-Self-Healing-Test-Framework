import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/execution-dashboard`,
  headers: {
    'Content-Type': 'application/json',
  },
});
// Add request interceptor to include auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
// Enhanced types for M7 dashboard features
export interface ExecutionRun {
  id: string;
  test_case_id: string;
  status: string;
  started_at: string;
  finished_at?: string;
  duration_seconds?: number;
  step_count: number;
  passed_steps: number;
  failed_steps: number;
  project_id: string;
  created_by: string;
}
export interface ExecutionSummary {
  execution_id: string;
  summary_text: string;
  generated_at: string;
  model_used: string;
  confidence_score?: number;
}
export interface BindingUsage {
  id: string;
  execution_id: string;
  binding_name: string;
  table_name: string;
  used_at: string;
  value_used?: string;
}
export interface ExecutionTrend {
  date: string;
  total_executions: number;
  completed_executions: number;
  failed_executions: number;
  success_rate: number;
  avg_duration_seconds: number;
  unique_tests_run: number;
}
export interface FailurePattern {
  error_message: string;
  action: string;
  failure_count: number;
  affected_executions: number;
  avg_step_order: number;
  first_seen?: string;
  last_seen?: string;
}
export interface ActionFailureRate {
  action: string;
  total_attempts: number;
  failures: number;
  failure_rate: number;
}
export interface PerformanceMetrics {
  execution_performance: {
    total_executions: number;
    avg_duration: number;
    fastest_execution: number;
    slowest_execution: number;
    median_duration: number;
    p95_duration: number;
  };
  action_performance: Array<{
    action: string;
    total_steps: number;
    avg_duration: number;
    min_duration: number;
    max_duration: number;
    median_duration: number;
  }>;
  performance_insights: {
    slowest_action?: string;
    fastest_action?: string;
    total_actions_analyzed: number;
  };
}
class ExecutionApiService {
  // Core execution management
  async getExecutions(page: number = 1, limit: number = 20): Promise<{
    executions: ExecutionRun[];
    total: number;
    page: number;
    total_pages: number;
  }> {
    const response = await apiClient.get('/executions', {
      params: { page, limit }
    });
    return response.data;
  }
  async getExecution(executionId: string): Promise<ExecutionRun> {
    const response = await apiClient.get(`/executions/${executionId}`);
    return response.data;
  }
  async deleteExecution(executionId: string): Promise<{success: boolean}> {
    const response = await apiClient.delete(`/execution/${executionId}`);
    return response.data;
  }
  // M7 SCRUM-17: LLM Summary APIs
  async generateExecutionSummary(executionId: string): Promise<ExecutionSummary> {
    const response = await apiClient.post(`/llm-summaries/generate`, {
      execution_id: executionId
    });
    return response.data;
  }
  async getExecutionSummary(executionId: string): Promise<ExecutionSummary | null> {
    try {
      const response = await apiClient.get(`/llm-summaries/${executionId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
  // M7 SCRUM-16: Data Binding Traceability APIs
  async getExecutionBindings(executionId: string): Promise<BindingUsage[]> {
    const response = await apiClient.get(`/data-traceability/execution/${executionId}/bindings`);
    return response.data.binding_usages || [];
  }
  async getBindingHistory(bindingName: string, days: number = 30): Promise<{
    binding_usages: BindingUsage[];
    usage_summary: {
      total_usages: number;
      unique_executions: number;
      date_range: {
        start: string;
        end: string;
      };
    };
  }> {
    const response = await apiClient.get(`/data-traceability/binding/${bindingName}/history`, {
      params: { days }
    });
    return response.data;
  }
  // M7 SCRUM-15: Enhanced Dashboard APIs
  async getExecutionTrends(days: number = 30): Promise<{
    period_days: number;
    trends: ExecutionTrend[];
    total_data_points: number;
  }> {
    const response = await apiClient.get('/trends', {
      params: { days }
    });
    return response.data;
  }
  async getFailureAnalysis(days: number = 30, limit: number = 10): Promise<{
    period_days: number;
    failure_patterns: FailurePattern[];
    action_failure_rates: ActionFailureRate[];
    analysis_summary: {
      total_failure_patterns: number;
      total_actions_analyzed: number;
      highest_failure_rate: number;
    };
  }> {
    const response = await apiClient.get('/failure-analysis', {
      params: { days, limit }
    });
    return response.data;
  }
  async getPerformanceMetrics(days: number = 7): Promise<PerformanceMetrics> {
    const response = await apiClient.get('/performance-metrics', {
      params: { days }
    });
    return response.data;
  }
  // Administrative functions
  async cleanupOldExecutions(daysToKeep: number = 90, dryRun: boolean = true): Promise<{
    success?: boolean;
    dry_run: boolean;
    days_to_keep: number;
    records_to_delete?: any;
    records_deleted?: any;
    message: string;
  }> {
    const response = await apiClient.post('/cleanup', {
      days_to_keep: daysToKeep,
      dry_run: dryRun
    });
    return response.data;
  }
  // Health check
  async healthCheck(): Promise<{status: string; service: string; timestamp: string}> {
    const response = await apiClient.get('/health');
    return response.data;
  }
}
export const executionApiService = new ExecutionApiService();