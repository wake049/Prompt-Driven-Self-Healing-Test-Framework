/**
 * MCP-based Execution API Service
 * 
 * Replaces the REST-based executionApiService with MCP protocol calls.
 * Maintains the same interface for backward compatibility.
 */

import { MCPFrontendManager } from './mcpFrontendClient';

// Keep the same interface types for compatibility
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

class MCPExecutionApiService {
  private async getMCPClient() {
    const client = await MCPFrontendManager.getInstance();
    if (!client.isConnectedToServer()) {
      throw new Error("MCP server connection required for execution API operations");
    }
    return client;
  }

  // Core execution management
  async getExecutions(page: number = 1, limit: number = 20): Promise<{
    executions: ExecutionRun[];
    total: number;
    page: number;
    total_pages: number;
  }> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "executions",
      filters: { page, limit }
    });
    
    return {
      executions: result.data?.executions || result.executions || [],
      total: result.data?.total || result.total || 0,
      page: result.data?.page || result.page || page,
      total_pages: result.data?.total_pages || result.total_pages || 1
    };
  }

  async getExecution(executionId: string): Promise<ExecutionRun> {
    const client = await this.getMCPClient();
    const result = await client.readResource(`executions://test/${executionId}`);
    return result.execution || result;
  }

  async deleteExecution(executionId: string): Promise<{success: boolean}> {
    const client = await this.getMCPClient();
    const result = await client.callTool("run_action", {
      action_type: "delete_execution",
      element_name: executionId,
      context: { operation: "delete" }
    });
    return { success: result.ok || result.success || false };
  }

  // M7 SCRUM-17: LLM Summary APIs
  async generateExecutionSummary(executionId: string): Promise<ExecutionSummary> {
    const client = await this.getMCPClient();
    const result = await client.callTool("run_action", {
      action_type: "generate_summary",
      element_name: executionId,
      context: { operation: "llm_summary" }
    });
    return result.data || result;
  }

  async getExecutionSummary(executionId: string): Promise<ExecutionSummary | null> {
    try {
      const client = await this.getMCPClient();
      const result = await client.readResource(`summaries://execution/${executionId}`);
      return result.summary || result;
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  // M7 SCRUM-16: Data Binding Traceability APIs
  async getExecutionBindings(executionId: string): Promise<BindingUsage[]> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "execution_bindings",
      filters: { execution_id: executionId }
    });
    return result.data?.binding_usages || result.binding_usages || [];
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
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "binding_history",
      filters: { binding_name: bindingName, days }
    });
    return result.data || result;
  }

  // M7 SCRUM-15: Enhanced Dashboard APIs
  async getExecutionTrends(days: number = 30): Promise<{
    period_days: number;
    trends: ExecutionTrend[];
    total_data_points: number;
  }> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "execution_trends",
      filters: { days }
    });
    return result.data || result;
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
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "failure_analysis",
      filters: { days, limit }
    });
    return result.data || result;
  }

  async getPerformanceMetrics(days: number = 7): Promise<PerformanceMetrics> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "performance_metrics",
      filters: { days }
    });
    return result.data || result;
  }

  // Additional methods for dashboard compatibility
  async getExecutionStats(filters?: any): Promise<any> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "execution_stats",
      filters
    });
    return result.data || result;
  }

  async getRecentExecutions(options?: { limit?: number; filters?: any }): Promise<any> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "recent_executions",
      filters: options?.filters,
      limit: options?.limit || 20
    });
    return result.data || result;
  }

  async getCachedExecutionSummary(executionId: string): Promise<any> {
    // Use the same method as getExecutionSummary for MCP
    return this.getExecutionSummary(executionId);
  }

  async getExecutionBindingUsage(executionId: string): Promise<any> {
    // Use the same method as getExecutionBindings for MCP
    return this.getExecutionBindings(executionId);
  }

  async getRecentFailedExecutions(promptId: string, limit: number = 10): Promise<any> {
    const client = await this.getMCPClient();
    const result = await client.callTool("fetch_test_data", {
      data_type: "failed_executions",
      filters: { prompt_id: promptId, limit }
    });
    return result.data || result;
  }

  async getExecutionStatus(executionId: string): Promise<any> {
    const client = await this.getMCPClient();
    const result = await client.readResource(`executions://status/${executionId}`);
    return result;
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
    const client = await this.getMCPClient();
    const result = await client.callTool("run_action", {
      action_type: "cleanup_executions",
      element_name: "cleanup",
      context: { 
        days_to_keep: daysToKeep,
        dry_run: dryRun
      }
    });
    return result.data || result;
  }

  // Health check
  async healthCheck(): Promise<{status: string; service: string; timestamp: string}> {
    const client = await this.getMCPClient();
    const result = await client.ping();
    return {
      status: result.status || "ok",
      service: "MCP Execution Service",
      timestamp: new Date().toISOString()
    };
  }
}

export const executionApiService = new MCPExecutionApiService();