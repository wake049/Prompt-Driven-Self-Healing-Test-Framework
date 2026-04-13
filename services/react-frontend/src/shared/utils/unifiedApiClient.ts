/**
 * Unified API Client for React Frontend
 * Consolidates all MCP services into a single client
 */
import { MCPFrontendManager } from '../../services/mcpFrontendClient';
import { config } from '../../app/config';

// API Base URL from environment or default
const UNIFIED_API_BASE_URL = config.apiBaseUrl;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
// Policy Engine Types
interface Policy {
  id: string;
  name: string;
  description?: string;
  policy_type: { value: string };
  status: { value: string };
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
// AI Service Types
interface ElementSuggestion {
  elementId: string;
  name: string;
  description: string;
  xpath: string;
  locator: Record<string, string>;
  category: string;
  priority: string;
  confidence: number;
  usageExamples: string[];
}
interface DOMElement {
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, any>;
  xpath?: string;
  isVisible: boolean;
  isInteractive: boolean;
}
interface TestPlan {
  actions: Array<{
    name: string;
    params: Record<string, any>;
  }>;
  meta: Record<string, any>;
}
// Healing API Types
interface HealingAttempt {
  timestamp: string;
  elementId: string;
  page: string;
  originalLocator: string;
  attemptedAlternatives: string[];
  healedLocator?: string;
  result: string;
  error?: string;
}
// SQL Backend Types
interface RecordedElement {
  id: string;
  session_id: string;
  tag: string;
  text_content?: string;
  attributes: Record<string, any>;
  xpath?: string;
  css_selector?: string;
  page: string;
  logical_key?: string;
  timestamp_recorded: string;
}
interface ReviewQueueItem {
  id: string;
  page: string;
  element_id: string;
  suggested_locator: string;
  old_locator: string;
  confidence_score: number;
  ai_reasoning: string;
  intended_action: string;
  status: string;
  created_at: string;
  updated_at: string;
}
// Test Execution Types
interface TestExecution {
  execution_id: string;
  prompt_id: string;
  prompt_text?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'completed_with_failures';
  started_at?: string;
  completed_at?: string;
  total_steps: number;
  error_message?: string;
  results?: any;
  metadata?: any;
}
interface ExecutionResult {
  success: boolean;
  execution_id: string;
  message: string;
  steps_count: number;
  prompt_text: string;
}
class UnifiedApiClient {
  private baseUrl: string;
  constructor(baseUrl: string = UNIFIED_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
    // Debug auth headers
    return headers;
  }
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // For long work sessions, don't automatically logout
          // Instead, show a more user-friendly error message
          throw new Error('Authentication error - please refresh the page or login again if needed');
        }

        let backendDetail = '';
        try {
          const errorBody = await response.json();
          backendDetail = errorBody?.detail || errorBody?.message || errorBody?.error || '';
        } catch {
          // Ignore JSON parse issues and fall back to status text.
        }

        const suffix = backendDetail ? ` - ${backendDetail}` : '';
        throw new Error(`HTTP ${response.status}: ${response.statusText}${suffix}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {throw error;
    }
  }
  // Health Check
  async healthCheck(): Promise<{ status: string; services: Record<string, string> }> {
    return this.request('/health');
  }
  // Policy Engine Methods
  async getPolicyStats(): Promise<PolicyStats> {
    return this.request('/api/v1/policy/dashboard/stats');
  }
  async getPolicies(): Promise<Policy[]> {
    return this.request('/api/v1/policy/dashboard/policies');
  }
  async getPolicy(policyId: string): Promise<Policy> {
    return this.request(`/api/v1/policy/policies/${policyId}`);
  }
  async createPolicy(policy: Partial<Policy>): Promise<{ success: boolean; policy_id: string }> {
    return this.request('/api/v1/policy/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }
  async updatePolicy(policyId: string, policy: Partial<Policy>): Promise<{ success: boolean }> {
    return this.request(`/api/v1/policy/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
  }
  async deletePolicy(policyId: string): Promise<{ success: boolean }> {
    return this.request(`/api/v1/policy/policies/${policyId}`, {
      method: 'DELETE',
    });
  }
  // AI Service Methods
  // Note: Element suggestion functionality has been integrated into the 
  // enterprise /v1/plan endpoint via intelligent element ranking
  async generateTestSteps(prompt: string, options?: {
    baseUrl?: string;
    includeScreenshots?: boolean;
    includeAssertions?: boolean;
    maxSteps?: number;
    availableElements?: DOMElement[];
  }): Promise<{
    success: boolean;
    plan: TestPlan;
    metadata: Record<string, any>;
  }> {
    // Transform legacy options to new enterprise PromptEnvelope format
    const promptEnvelope = {
      prompt: prompt,
      tenant_id: "frontend-default", // Default tenant ID for frontend
      run_id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      catalog_refs: [], // Empty for now, can be populated later
      page_slice: options?.availableElements ? {
        slice_strategy: "heuristicFilter",
        k: Math.min(options.availableElements.length, 100),
        total_elements: options.availableElements.length,
        elements: options.availableElements.slice(0, 100).map((el, index) => ({
          element_id: el.id || `element_${index}`,
          tag: el.tag,
          text_content: el.attributes?.textContent || '',
          attributes: el.attributes,
          selector_css: el.attributes?.css_selector || '',
          selector_xpath: el.xpath || '',
          is_visible: el.isVisible,
          is_interactive: el.isInteractive,
          confidence_score: 0.8
        }))
      } : null,
      page_url: options?.baseUrl,
      max_steps: options?.maxSteps || 20,
      include_screenshots: options?.includeScreenshots || false,
      include_assertions: options?.includeAssertions !== false, // Default to true
      priority: "normal",
      timeout_ms: 30000,
      request_source: "react-frontend"
    };
    // Call the new enterprise endpoint
    const response = await this.request('/api/v1/ai/v1/plan', {
      method: 'POST',
      body: JSON.stringify(promptEnvelope),
    });
    // Transform enterprise response back to legacy format for compatibility
    return {
      success: true,
      plan: {
        actions: response.steps?.map((step: any) => ({
          name: step.action,
          params: { 
            // For open_url actions, put target in url field, not selector
            selector: step.action === 'open_url' ? '' : step.target,
            url: step.action === 'open_url' ? step.target : (step.args?.url || ''),
            ...step.args 
          }
        })) || [],
        meta: {
          prompt: prompt,
          version: "2.0.0",
          generatedAt: new Date().toISOString(),
          method: "enterprise-ai",
          processingTimeMs: response.processing_time_ms || 0,
          enterpriseFeatures: {
            costTracking: true,
            tenantSeparation: true,
            elementRanking: true
          }
        }
      },
      metadata: {
        runId: response.run_id,
        tenantId: response.tenant_id,
        costSummary: response.cost_summary,
        clarifications: response.clarifications || []
      }
    };
  }
  async validateDOMStructure(domData: any): Promise<{
    success: boolean;
    validation: Record<string, any>;
  }> {
    return this.request('/api/v1/ai/validate-structure', {
      method: 'POST',
      body: JSON.stringify({ domData }),
    });
  }
  async getAIModels(): Promise<{
    success: boolean;
    models: Record<string, any>;
  }> {
    return this.request('/api/v1/ai/models');
  }
  // Healing API Methods
  async submitHealingData(healingAttempts: HealingAttempt[], sessionId?: string): Promise<{
    success: boolean;
    message: string;
    successful_healings: number;
  }> {
    return this.request('/api/v1/healing/submit', {
      method: 'POST',
      body: JSON.stringify({
        healing_attempts: healingAttempts,
        session_id: sessionId,
      }),
    });
  }
  async getHealingStats(): Promise<{
    total_files: number;
    files: string[];
    data_directory: string;
  }> {
    return this.request('/api/v1/healing/stats');
  }
  async getHealingData(limit: number = 100, sessionId?: string): Promise<{
    healing_attempts: any[];
    total: number;
    filtered_by_session: boolean;
  }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (sessionId) params.append('session_id', sessionId);
    return this.request(`/api/v1/healing/data?${params}`);
  }
  // SQL Backend Methods
  async recordElement(elementData: any, sessionInfo?: any): Promise<{
    success: boolean;
    data: RecordedElement;
    action: string;
  }> {
    return this.request('/api/v1/sql/record-element', {
      method: 'POST',
      body: JSON.stringify({ element_data: elementData, session_info: sessionInfo }),
    });
  }

  async getAllElements(options?: { limit?: number; offset?: number; page?: string }): Promise<{
    success: boolean;
    data: any[];
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.page) params.append('page', options.page);
    
    const url = `/api/v1/sql/elements${params.toString() ? '?' + params.toString() : ''}`;
    return this.request(url);
  }

  async recordExecution(executionData: any, sessionId: string): Promise<{
    success: boolean;
    data: any;
  }> {
    return this.request('/api/v1/sql/record-execution', {
      method: 'POST',
      body: JSON.stringify({ execution_data: executionData, session_id: sessionId }),
    });
  }
  async getAllData(): Promise<{
    success: boolean;
    data: { sessions: any[] };
  }> {
    return this.request('/api/v1/sql/all-data');
  }
  async getReviewQueue(status: string = 'pending', page?: string): Promise<{
    success: boolean;
    data: ReviewQueueItem[];
    count: number;
  }> {
    const params = new URLSearchParams({ status });
    if (page) params.append('page', page);
    return this.request(`/api/v1/sql/review-queue?${params}`);
  }
  async getPendingReviews(): Promise<ReviewQueueItem[]> {
    return this.request('/api/v1/sql/review/pending');
  }
  async updateReviewStatus(reviewId: string, status: string, notes?: string): Promise<ReviewQueueItem> {
    return this.request(`/api/v1/sql/review/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewer_notes: notes }),
    });
  }
  // Utility Methods
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
  // Backward compatibility methods (delegates to new endpoints)
  async getDashboardStats(): Promise<PolicyStats> {
    return this.getPolicyStats();
  }
  async getDashboardPolicies(): Promise<Policy[]> {
    return this.getPolicies();
  }
  async getDashboardExecutionLogs(limit: number = 50): Promise<any[]> {
    return this.request(`/api/v1/policy/dashboard/execution-logs?limit=${limit}`);
  }
  async getDashboardOutcomeStatistics(): Promise<any> {
    return this.request('/api/v1/policy/dashboard/outcome-statistics');
  }
  async getDashboardConfig(): Promise<any> {
    return this.request('/api/v1/policy/dashboard/config');
  }
  // Bindings API methods
  async getBindings(): Promise<any[]> {
    return this.request('/api/v1/bindings');
  }
  async createBinding(binding: any): Promise<any> {
    return this.request('/api/v1/bindings', {
      method: 'POST',
      body: JSON.stringify(binding),
    });
  }
  async getBindingTemplates(): Promise<any> {
    return this.request('/api/v1/bindings/templates');
  }
  async applyBindingTemplate(templateName: string, context: any): Promise<any> {
    return this.request(`/api/v1/bindings/templates/${templateName}/apply`, {
      method: 'POST',
      body: JSON.stringify(context),
    });
  }
  async testBinding(binding: any): Promise<any> {
    return this.request('/api/v1/bindings/test', {
      method: 'POST',
      body: JSON.stringify(binding),
    });
  }
  // Test Execution API methods
  async executePrompt(promptId: string, options?: { browser?: string; runner_id?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.browser) params.set('browser', options.browser);
    if (options?.runner_id) params.set('runner_id', options.runner_id);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/v1/execution/execute-prompt/${promptId}${qs}`, {
      method: 'POST'
    });
  }
  async executeDebugSteps(requestData: any): Promise<any> {
    return this.request('/api/v1/execution/execute-debug-steps', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }
  async getExecutionStatus(executionId: string): Promise<any> {
    return this.request(`/api/execution-dashboard/execution/${executionId}`);
  }
  async getRecentExecutions(limit: number = 10): Promise<any> {
    return this.request(`/api/v1/execution/executions?limit=${limit}`);
  }
  // Test Failure Analysis & Minimal Reproduction API methods
  // Get recent failed executions for failure analysis  
  async getRecentFailedExecutions(promptId?: string, limit: number = 10): Promise<any> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('status', 'failed');  // Filter for failed executions only
    if (promptId) {
      params.append('prompt_id', promptId);  // Filter by prompt to get failures for this specific prompt
    }
    return this.request(`/api/execution-dashboard/recent?${params}`);
  }
  // Get recent failed executions filtered by element (legacy method)
  async getRecentFailedExecutionsByElement(elementId: string, limit: number = 5): Promise<any> {
    const params = new URLSearchParams();
    params.append('elementId', elementId);
    params.append('limit', limit.toString());
    params.append('status', 'failed');
    return this.request(`/api/execution-dashboard/recent?${params}`);
  }
  async generateMinimalReproSteps(executionId: string, failedSteps: any[]): Promise<{
    success: boolean;
    minimalSteps: any[];
    originalStepsCount: number;
    reducedStepsCount: number;
    reproductionGuarantee: number;
    analysisReport: {
      criticalPath: string[];
      removedSteps: string[];
      reasoning: string;
    };
  }> {
    return this.request('/api/v1/ai/generate-minimal-repro', {
      method: 'POST',
      body: JSON.stringify({
        execution_id: executionId,
        failed_steps: failedSteps,
        optimization_level: 'moderate', // 'aggressive' | 'moderate' | 'conservative'
        preserve_context: true
      }),
    });
  }
  async analyzeFailurePatterns(elementId: string, days: number = 30): Promise<{
    elementId: string;
    failureAnalysis: {
      totalFailures: number;
      commonErrors: Array<{
        error: string;
        count: number;
        firstSeen: string;
        lastSeen: string;
      }>;
      failureTrends: Array<{
        date: string;
        failures: number;
      }>;
      affectedActions: Array<{
        action: string;
        failureRate: number;
        avgStepPosition: number;
      }>;
    };
    recommendations: string[];
  }> {
    return this.request(`/api/v1/ai/analyze-element-failures/${elementId}?days=${days}`);
  }
  // Bindings API methods
  async getPromptBindings(promptId: string): Promise<any> {
    return this.request(`/api/v1/prompts/${promptId}/bindings`);
  }
  async updatePromptBindings(promptId: string, bindings: any): Promise<any> {
    return this.request(`/api/v1/prompts/${promptId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(bindings),
    });
  }
  async testBindings(bindings: any, domData?: any): Promise<any> {
    return this.request('/api/v1/bindings/test', {
      method: 'POST',
      body: JSON.stringify({ bindings_data: bindings, dom_data: domData }),
    });
  }
  // Generic HTTP methods for convenience
  async get(endpoint: string): Promise<any> {
    return this.request(endpoint);
  }
  async post(endpoint: string, data?: any): Promise<any> {
    return this.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}
// Create singleton instance
const unifiedApiClient = new UnifiedApiClient();
export default unifiedApiClient;
export { UnifiedApiClient };
export type {
  Policy,
  PolicyRule,
  PolicyStats,
  ElementSuggestion,
  DOMElement,
  TestPlan,
  HealingAttempt,
  RecordedElement,
  ReviewQueueItem,
  TestExecution,
  ExecutionResult,
};