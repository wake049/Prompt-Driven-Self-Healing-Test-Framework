/**
 * API Client for React Frontend to communicate with Unified MCP API Server
 * Updated to use the new unified API endpoint
 */
const API_BASE_URL = import.meta.env.VITE_POLICY_API_URL || 'http://localhost:8000/api/v1/policy';
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
// Policy Types based on MCP server models
interface Policy {
  id: string;
  name: string;
  description?: string;
  policy_type: {
    value: string;
  };
  status: {
    value: string;
  };
  priority_order: number;
  rules: PolicyRule[];
  created_at: string;
  updated_at: string;
}
interface PolicyRule {
  condition_expression: string;
  action_mapping: Record<string, any>;
  confidence_threshold: number;
}
interface PolicyExecutionLog {
  id: string;
  run_id: string;
  step_index: number;
  policy_id: string;
  executed_at: string;
  success: boolean;
  confidence_score: number;
  execution_time_ms: number;
  context: ExecutionContext;
  evaluation_result: PolicyEvaluationResult;
  outcome_classification?: OutcomeClassification;
  applied_actions?: Array<Record<string, any>>;
}
interface ExecutionContext {
  element_id?: string;
  page: string;
  action_type: string;
  test_environment: string;
  user_context: Record<string, any>;
}
interface PolicyEvaluationResult {
  policy_id: string;
  matched: boolean;
  confidence_score: number;
  action_recommendation: string;
  reasoning: string;
  evaluation_time_ms: number;
}
interface OutcomeClassification {
  classification: string;
  confidence: number;
  detected_outcomes: Array<Record<string, any>>;
  reasoning: string;
}
interface PolicyStats {
  total_policies: number;
  active_policies: number;
  total_executions: number;
  recent_executions_24h: number;
  avg_evaluation_time_ms: number;
  success_rate: number;
  cache_size: number;
  uptime_seconds: number;
}
interface OutcomeStatistics {
  verification_engine: {
    total_verifications: number;
    verifications_with_multiple_outcomes: number;
    policy_utilization_percentage: number;
  };
  outcome_classifier: {
    avg_classification_time_ms: number;
    total_classifications: number;
    confidence_distribution: Record<string, number>;
  };
  combined_metrics: {
    total_processed: number;
    avg_processing_time_ms: number;
    multi_outcome_coverage: number;
    policy_integration_rate: number;
  };
}
class McpPolicyApiClient {
  private baseUrl: string;
  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error($1);
      throw error;
    }
  }
  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/health');
      return response.status === 'healthy';
    } catch {
      return false;
    }
  }
  // Dashboard endpoints (no auth required)
  async getDashboardStats(): Promise<PolicyStats> {
    return this.request('/dashboard/stats');
  }
  async getDashboardOutcomeStatistics(): Promise<OutcomeStatistics> {
    return this.request('/dashboard/outcome-statistics');
  }
  async getDashboardExecutionLogs(limit: number = 50): Promise<PolicyExecutionLog[]> {
    return this.request(`/dashboard/execution-logs?limit=${limit}`);
  }
  async getDashboardPolicies(): Promise<Policy[]> {
    return this.request('/dashboard/policies');
  }
  // Policy management endpoints (requires auth for full functionality)
  async getAllPolicies(filters: {
    policy_type?: string;
    status?: string;
  } = {}): Promise<Policy[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value);
      }
    });
    const endpoint = params.toString() ? `/policies?${params}` : '/policies';
    return this.request(endpoint);
  }
  async getPolicy(policyId: string): Promise<Policy> {
    return this.request(`/policies/${policyId}`);
  }
  async createPolicy(policy: Partial<Policy>): Promise<{ success: boolean; policy_id: string; message: string }> {
    return this.request('/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }
  async updatePolicy(policyId: string, policy: Partial<Policy>): Promise<{ success: boolean; policy_id: string; message: string }> {
    return this.request(`/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
  }
  async deletePolicy(policyId: string): Promise<{ success: boolean; policy_id: string; message: string }> {
    return this.request(`/policies/${policyId}`, {
      method: 'DELETE',
    });
  }
  // Policy evaluation
  async evaluatePolicies(
    context: ExecutionContext,
    actionType?: string,
    errorInfo?: Record<string, any>
  ): Promise<PolicyEvaluationResult[]> {
    return this.request('/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        context,
        action_type: actionType,
        error_info: errorInfo,
      }),
    });
  }
  // Execution logs
  async getExecutionLogs(filters: {
    run_id?: string;
    policy_id?: string;
    limit?: number;
  } = {}): Promise<PolicyExecutionLog[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    const endpoint = params.toString() ? `/execution-logs?${params}` : '/execution-logs';
    return this.request(endpoint);
  }
  async logExecution(
    runId: string,
    stepIndex: number,
    policyId: string,
    context: ExecutionContext,
    evaluationResult: PolicyEvaluationResult,
    outcomeClassification?: OutcomeClassification,
    appliedActions?: Array<Record<string, any>>
  ): Promise<string> {
    return this.request('/execution-logs', {
      method: 'POST',
      body: JSON.stringify({
        run_id: runId,
        step_index: stepIndex,
        policy_id: policyId,
        context,
        evaluation_result: evaluationResult,
        outcome_classification: outcomeClassification,
        applied_actions: appliedActions,
      }),
    });
  }
  // Policy validation
  async validatePolicy(policy: Policy): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    rules_count: number;
    estimated_performance_impact: string;
  }> {
    return this.request('/validate-policy', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }
  // Outcome classification
  async classifyOutcome(
    context: ExecutionContext,
    actionResult: Record<string, any>,
    detectionTimeoutMs: number = 5000
  ): Promise<OutcomeClassification> {
    return this.request('/classify-outcome', {
      method: 'POST',
      body: JSON.stringify({
        context,
        action_result: actionResult,
        detection_timeout_ms: detectionTimeoutMs,
      }),
    });
  }
  // Multi-outcome verification
  async verifyWithMultiOutcomes(
    item: Record<string, any>,
    executionContext: ExecutionContext,
    expectedOutcomes?: Array<Record<string, any>>,
    recordOutcomes: boolean = true
  ): Promise<Record<string, any>> {
    return this.request('/verify-multi-outcome', {
      method: 'POST',
      body: JSON.stringify({
        item,
        execution_context: executionContext,
        expected_outcomes: expectedOutcomes,
        record_outcomes: recordOutcomes,
      }),
    });
  }
  async getMultiOutcomeHistory(
    verificationId?: string,
    limit: number = 100
  ): Promise<Array<Record<string, any>>> {
    const params = new URLSearchParams();
    if (verificationId) params.append('verification_id', verificationId);
    params.append('limit', limit.toString());
    return this.request(`/multi-outcome-history?${params}`);
  }
  // LLM classification
  async llmClassifyOutcome(
    executionContext: ExecutionContext,
    actionResult: Record<string, any>,
    ruleBasedClassification?: Record<string, any>,
    expectedOutcomes?: Array<Record<string, any>>
  ): Promise<Record<string, any>> {
    return this.request('/llm-classify-outcome', {
      method: 'POST',
      body: JSON.stringify({
        execution_context: executionContext,
        action_result: actionResult,
        rule_based_classification: ruleBasedClassification,
        expected_outcomes: expectedOutcomes,
      }),
    });
  }
  async getLlmPerformanceStats(): Promise<Record<string, any>> {
    return this.request('/llm-performance-stats');
  }
  // Utility methods for converting data
  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  }
  convertPolicyToFrontendFormat(policy: Policy): {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    executions_count: number;
    last_executed: string;
  } {
    return {
      id: policy.id,
      name: policy.name,
      status: policy.status.value === 'active' ? 'active' : 'inactive',
      executions_count: 0, // This would need to be calculated from execution logs
      last_executed: policy.updated_at,
    };
  }
  convertExecutionToFrontendFormat(execution: PolicyExecutionLog): {
    id: string;
    policy_name: string;
    element_id: string;
    executed_at: string;
    success: boolean;
    confidence_score: number;
    execution_time_ms: number;
    action_taken: string;
  } {
    return {
      id: execution.id,
      policy_name: execution.policy_id, // Would need policy lookup for actual name
      element_id: execution.context.element_id || 'unknown',
      executed_at: execution.executed_at,
      success: execution.success,
      confidence_score: execution.confidence_score,
      execution_time_ms: execution.execution_time_ms,
      action_taken: execution.evaluation_result.action_recommendation,
    };
  }
}
// Create singleton instance
const mcpPolicyApiClient = new McpPolicyApiClient();
export default mcpPolicyApiClient;
export { McpPolicyApiClient };
export type {
  Policy,
  PolicyRule,
  PolicyExecutionLog,
  ExecutionContext,
  PolicyEvaluationResult,
  OutcomeClassification,
  PolicyStats,
  OutcomeStatistics,
};