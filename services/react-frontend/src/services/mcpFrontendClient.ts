/**
 * MCP WebSocket Client for React Frontend
 * 
 * Replaces all REST API calls with proper MCP protocol communication.
 * Provides a unified interface for all frontend functionality via MCP server.
 */

import { config } from '../app/config';

interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export class MCPFrontendClient {
  private websocket: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverUrl: string;
  private authToken: string;
  private connectionListeners: Array<(connected: boolean) => void> = [];
  private readonly connectionTimeoutMs = 3000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatIntervalMs = 30000;

  private getApiBaseUrl(): string {
    return config.apiBaseUrl;
  }

  private async httpGet(path: string): Promise<any> {
    const token = MCPFrontendClient.resolveAuthToken() || this.authToken || '';
    const response = await fetch(`${this.getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private static resolveServerUrl(): string {
    const configuredUrl = import.meta.env.VITE_MCP_SERVER_URL;
    if (configuredUrl && configuredUrl.trim().length > 0) {
      return configuredUrl;
    }

    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/mcp/ws`;
    }

    return 'ws://localhost:8000/mcp/ws';
  }

  private static getConnectionCandidates(primaryUrl: string): string[] {
    const candidates: string[] = [];
    const primary = (primaryUrl || '').trim();
    if (primary) {
      candidates.push(primary);
    }

    // Optional explicit fallback (no implicit port probing)
    const fallbackUrl = (import.meta.env.VITE_MCP_SERVER_FALLBACK_URL || '').trim();
    if (fallbackUrl && fallbackUrl !== primary) {
      candidates.push(fallbackUrl);
    }

    return candidates;
  }

  private static resolveAuthToken(): string {
    if (typeof window !== 'undefined') {
      const runtimeToken = localStorage.getItem('auth_token');
      if (runtimeToken && runtimeToken.trim().length > 0) {
        return runtimeToken;
      }
    }

    const configuredToken = import.meta.env.VITE_MCP_AUTH_TOKEN;
    if (configuredToken && configuredToken.trim().length > 0) {
      return configuredToken;
    }

    return '';
  }

  constructor(
    serverUrl: string = MCPFrontendClient.resolveServerUrl(),
    authToken: string = MCPFrontendClient.resolveAuthToken()
  ) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    console.log('MCP Frontend Client initialized with URL:', this.serverUrl);
  }

  /**
   * Connect to MCP server via WebSocket
   */
  async connect(): Promise<void> {
    const candidates = MCPFrontendClient.getConnectionCandidates(this.serverUrl);
    let lastError: Error | null = null;

    for (const candidate of candidates) {
      try {
        const ws = await this.connectToCandidate(candidate);
        this.websocket = ws;
        this.serverUrl = candidate;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners(true);
        this.startHeartbeat();
        console.log(`MCP connected via ${candidate}`);
        return;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    this.isConnected = false;
    this.notifyConnectionListeners(false);
    throw new Error(
      `Failed to connect to MCP server. Tried: ${candidates.join(', ')}. Last error: ${lastError?.message || 'unknown error'}`
    );
  }

  private async connectToCandidate(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(url);

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          socket.close();
        } catch {
          // Ignore close errors during timeout handling
        }
        reject(new Error(`Connection timeout for ${url}`));
      }, this.connectionTimeoutMs);

      socket.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        socket.onclose = () => {
          this.isConnected = false;
          this.notifyConnectionListeners(false);
          this.handleConnectionClose();
        };

        socket.onerror = () => {
          // Runtime socket errors are handled by onclose/reconnection flow
        };

        resolve(socket);
      };

      socket.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`WebSocket error for ${url}`));
      };

      socket.onclose = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Socket closed before connect for ${url}`));
      };
    });
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
    this.notifyConnectionListeners(false);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error("MCP connection closed"));
    });
    this.pendingRequests.clear();
  }

  /**
   * Check if client is connected
   */
  isConnectedToServer(): boolean {
    return this.isConnected && this.websocket?.readyState === WebSocket.OPEN;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isConnectedToServer()) {
        this.stopHeartbeat();
        return;
      }
      try {
        await this.sendRequest('ping', {});
      } catch {
        console.warn('MCP heartbeat failed, connection may be dead');
        this.isConnected = false;
        this.notifyConnectionListeners(false);
        this.stopHeartbeat();
        this.handleConnectionClose();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Add connection listener
   */
  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.push(listener);
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify connection listeners
   */
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
        listener(connected);
    });
  }

  /**
   * Send a request to the MCP server
   */
  private async sendRequest(method: string, params?: Record<string, any>): Promise<any> {
    if (!this.isConnectedToServer()) {
      throw new Error("MCP server connection required - frontend cannot function without it");
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        auth_token: MCPFrontendClient.resolveAuthToken() || this.authToken
      }
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout for method: ${method}`));
      }, 30000); // 30 second timeout

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      this.websocket!.send(JSON.stringify(request));
    });
  }

  /**
   * Handle incoming messages from MCP server
   */
  private handleMessage(data: string): void {
    let response: MCPResponse;
    try {
      response = JSON.parse(data);
    } catch {
      console.error('MCP: received malformed JSON response');
      return;
    }

      const pending = this.pendingRequests.get(response.id);
      if (!pending) {
        return;
      }

      // Clear timeout and remove from pending
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);

      // Handle response
      if (response.error) {
        pending.reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
  }

  /**
   * Handle connection close and attempt reconnection
   */
  private handleConnectionClose(): void {
    this.isConnected = false;
    
    // Notify listeners immediately about disconnection
    this.notifyConnectionListeners(false);
    
    // Clear any pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error("Connection lost"));
    });
    this.pendingRequests.clear();
    
    // Attempt reconnection with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      console.log(`MCP connection lost. Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error(`Frontend MCP reconnection attempt ${this.reconnectAttempts} failed:`, error);
          // If this was the last attempt, log final failure
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("MCP reconnection failed after maximum attempts. Manual reconnection required.");
          }
        });
      }, delay);
    } else {
      console.error("MCP reconnection failed after maximum attempts. Manual reconnection required.");
    }
  }

  // ===== MCP Protocol Methods =====

  /**
   * Test server connectivity
   */
  async ping(): Promise<{ status: string; timestamp: number }> {
    return this.sendRequest("ping");
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    return this.sendRequest("tools/list");
  }

  /**
   * Call a specific tool
   */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    return this.sendRequest("tools/call", { name, arguments: args });
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    return this.sendRequest("resources/list");
  }

  /**
   * Read a specific resource
   */
  async readResource(uri: string): Promise<any> {
    return this.sendRequest("resources/read", { uri });
  }

  // ===== Frontend API Replacement Methods =====

  // Execution Management
  async getExecutions(page: number = 1, limit: number = 20): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "executions",
      filters: { page, limit }
    });
    return result.data || result;
  }

  async getExecution(executionId: string): Promise<any> {
    const result = await this.readResource(`executions://test/${executionId}`);
    return result;
  }

  async deleteExecution(executionId: string): Promise<{ success: boolean }> {
    const result = await this.callTool("run_action", {
      action_type: "delete_execution",
      element_name: executionId,
      context: { operation: "delete" }
    });
    return { success: result.ok };
  }

  // Element Management
  async getAllElements(options?: { limit?: number; offset?: number }): Promise<any> {
    const limit = options?.limit || 1000;
    const offset = options?.offset || 0;
    const result = await this.readResource(`elements://repository/list?limit=${limit}&offset=${offset}`);
    return result;
  }

  async getElement(elementId: string): Promise<any> {
    const result = await this.callTool("elements.get", { elementId });
    return result.data || result;
  }

  async addElement(elementData: any): Promise<any> {
    const result = await this.callTool("elements.add", { 
      elementId: elementData.logical_key || elementData.id,
      elementData 
    });
    return result.data || result;
  }

  async updateElement(elementId: string, elementData: any): Promise<any> {
    const result = await this.callTool("elements.add", { 
      elementId,
      elementData: { ...elementData, id: elementId }
    });
    return result.data || result;
  }

  async deleteElement(elementId: string): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: "delete_element",
      element_name: elementId,
      context: { operation: "delete" }
    });
    return result;
  }

  // Test Data and Analytics
  async getExecutionStats(filters?: any): Promise<any> {
    try {
      const result = await this.callTool("fetch_test_data", {
        data_type: "execution_stats",
        filters
      });
      return result.data || result;
    } catch {
      const query = new URLSearchParams(filters || {}).toString();
      const fallback = await this.httpGet(`/api/v1/sql/execution-stats${query ? `?${query}` : ''}`);
      return fallback.data || fallback;
    }
  }

  async getRecentExecutions(options?: { limit?: number; filters?: any }): Promise<any> {
    try {
      const result = await this.callTool("fetch_test_data", {
        data_type: "recent_executions",
        filters: options?.filters,
        limit: options?.limit || 20
      });
      return result.data || result;
    } catch {
      const params = new URLSearchParams({ limit: String(options?.limit || 20), ...(options?.filters || {}) }).toString();
      const fallback = await this.httpGet(`/api/v1/sql/executions${params ? `?${params}` : ''}`);
      return fallback.data || fallback;
    }
  }

  async getExecutionTrends(days: number = 30): Promise<any> {
    try {
      const result = await this.callTool("fetch_test_data", {
        data_type: "execution_trends",
        filters: { days }
      });
      return result.data || result;
    } catch {
      const fallback = await this.httpGet(`/api/v1/sql/execution-trends?days=${days}`);
      return fallback.data || fallback;
    }
  }

  async getFailureAnalysis(days: number = 30, limit: number = 10): Promise<any> {
    try {
      const result = await this.callTool("fetch_test_data", {
        data_type: "failure_analysis",
        filters: { days, limit }
      });
      return result.data || result;
    } catch {
      const fallback = await this.httpGet(`/api/v1/sql/failure-analysis?days=${days}&limit=${limit}`);
      return fallback.data || fallback;
    }
  }

  async getPerformanceMetrics(days: number = 7): Promise<any> {
    try {
      const result = await this.callTool("fetch_test_data", {
        data_type: "performance_metrics",
        filters: { days }
      });
      return result.data || result;
    } catch {
      const fallback = await this.httpGet(`/api/v1/sql/performance-metrics?days=${days}`);
      return fallback.data || fallback;
    }
  }

  // LLM Summaries
  async generateExecutionSummary(executionId: string): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: "generate_summary",
      element_name: executionId,
      context: { operation: "llm_summary" }
    });
    return result.data || result;
  }

  async getExecutionSummary(executionId: string): Promise<any> {
    const result = await this.readResource(`summaries://execution/${executionId}`);
    return result;
  }

  // Data Binding Traceability
  async getExecutionBindings(executionId: string): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "execution_bindings",
      filters: { execution_id: executionId }
    });
    return result.data || result;
  }

  async getBindingHistory(bindingName: string, days: number = 30): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "binding_history",
      filters: { binding_name: bindingName, days }
    });
    return result.data || result;
  }

  // Context Management
  async setContext(key: string, value: any, type?: string): Promise<any> {
    const result = await this.callTool("context.put", { key, value, type });
    return result.data || result;
  }

  async getContext(key: string): Promise<any> {
    const result = await this.callTool("context.get", { key });
    return result.data || result;
  }

  async expectEqual(key: string, expectedValue: any): Promise<any> {
    const result = await this.callTool("context.expectEqual", { key, expectedValue });
    return result.data || result;
  }

  // Verification
  async verifySection(preset: any): Promise<any> {
    const result = await this.callTool("verify.section", { preset });
    return result.data || result;
  }

  // AI Services
  async generateLocators(elements: any[], strategy: string = "hybrid"): Promise<any> {
    const result = await this.callTool("bulk_generate_locators", { elements, strategy });
    return result.data || result;
  }

  // Analytics Services
  async getHealingAnalytics(timeRange: string = "24h"): Promise<any> {
    try {
      const result = await this.callTool("analytics_healing_data", { timeRange });
      return result.data || result;
    } catch {
      const daysMap: Record<string, number> = { '1h': 1, '24h': 1, '7d': 7, '30d': 30 };
      const days = daysMap[timeRange] || 1;
      const fallback = await this.httpGet(`/api/analytics/healing-analytics?days=${days}`);
      return fallback.data || fallback;
    }
  }

  async getAnalyticsTrends(timeRange: string = "24h", metricType?: string): Promise<any> {
    try {
      const result = await this.callTool("analytics_trends", { timeRange, metricType });
      return result.data || result;
    } catch {
      const query = new URLSearchParams({ timeRange, ...(metricType ? { metricType } : {}) }).toString();
      const fallback = await this.httpGet(`/api/analytics/trends?${query}`);
      return fallback.data || fallback;
    }
  }

  async getFailurePatterns(timeRange: string = "24h", groupBy?: string): Promise<any> {
    try {
      const result = await this.callTool("analytics_failure_patterns", { timeRange, groupBy });
      return result.data || result;
    } catch {
      const query = new URLSearchParams({ timeRange, ...(groupBy ? { groupBy } : {}) }).toString();
      const fallback = await this.httpGet(`/api/analytics/failure-patterns?${query}`);
      return fallback.data || fallback;
    }
  }

  async getAIInsights(timeRange: string = "24h", insightType?: string): Promise<any> {
    try {
      const result = await this.callTool("analytics_ai_insights", { timeRange, insightType });
      return result.data || result;
    } catch {
      const query = new URLSearchParams({ timeRange, ...(insightType ? { insightType } : {}) }).toString();
      const fallback = await this.httpGet(`/api/analytics/ai-insights?${query}`);
      return fallback.data || fallback;
    }
  }

  // Resource Access
  async getRepositoryStats(): Promise<any> {
    return this.readResource("stats://repository/summary");
  }

  async getHealingStats(): Promise<any> {
    return this.readResource("stats://healing/summary");
  }

  async getExecutionHistory(limit: number = 50, offset: number = 0): Promise<any> {
    return this.readResource(`executions://test/list?limit=${limit}&offset=${offset}`);
  }

  // Prompts Management (via MCP resources)
  async getPrompts(limit?: number): Promise<any> {
    const result = await this.readResource(`prompts://list?limit=${limit || 1000}`);
    return result;
  }

  async getPrompt(promptId: string): Promise<any> {
    const result = await this.readResource(`prompts://item/${promptId}`);
    return result;
  }

  async createPrompt(promptData: any): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: "create_prompt",
      element_name: promptData.name,
      context: { prompt_data: promptData }
    });
    return result.data || result;
  }

  async updatePrompt(promptId: string, promptData: any): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: "update_prompt",
      element_name: promptId,
      context: { prompt_data: promptData }
    });
    return result.data || result;
  }

  async deletePrompt(promptId: string): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: "delete_prompt",
      element_name: promptId,
      context: { operation: "delete" }
    });
    return result.data || result;
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; service: string; timestamp: string }> {
    const result = await this.ping();
    return {
      status: result.status,
      service: "MCP Frontend Client",
      timestamp: new Date().toISOString()
    };
  }

  // Administrative functions
  async cleanupOldExecutions(daysToKeep: number = 90, dryRun: boolean = true): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: "cleanup_executions",
      element_name: "cleanup",
      context: { 
        days_to_keep: daysToKeep,
        dry_run: dryRun
      }
    });
    return result.data || result;
  }

  // ===== Review Queue Management =====

  /**
   * Get review queue items with filtering, sorting, and pagination
   */
  async getReviewQueue(params: {
    status?: string;
    page?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any> {
    const result = await this.callTool("get_review_queue", {
      status: params.status || "open",
      page: params.page,
      search: params.search,
      sort_by: params.sort_by || "created_at",
      sort_order: params.sort_order || "desc",
      priority: params.priority,
      limit: params.limit || 50,
      offset: params.offset || 0
    });
    return result.data || result;
  }

  /**
   * Get pending review items (compatible with ReviewQueuePage)
   */
  async getPendingReviews(): Promise<any> {
    const result = await this.callTool("get_pending_reviews", {});
    return result.data || result;
  }

  /**
   * Update review item status (approve or reject)
   */
  async updateReviewStatus(reviewId: string, status: "approved" | "rejected"): Promise<any> {
    const result = await this.callTool("update_review_status", {
      review_id: reviewId,
      status: status
    });
    return result.data || result;
  }

  /**
   * Approve a review item
   */
  async approveReview(reviewId: string): Promise<any> {
    return this.updateReviewStatus(reviewId, "approved");
  }

  /**
   * Reject a review item
   */
  async rejectReview(reviewId: string): Promise<any> {
    return this.updateReviewStatus(reviewId, "rejected");
  }

  /**
   * Add element to review queue
   */
  async addToReviewQueue(elementId: string, elementName: string, note?: string, page?: string, healthStatus?: string): Promise<any> {
    const result = await this.callTool("add_to_review_queue", {
      element_id: elementId,
      element_name: elementName,
      note: note || "",
      page: page || "Unknown",
      health_status: healthStatus || "unknown"
    });
    return result.data || result;
  }
}

/**
 * Singleton MCP client instance for React frontend
 */
export class MCPFrontendManager {
  private static instance: MCPFrontendClient | null = null;
  private static isInitializing = false;

  /**
   * Get or create MCP client instance
   */
  static async getInstance(): Promise<MCPFrontendClient> {
    if (this.instance && this.instance.isConnectedToServer()) {
      return this.instance;
    }

    if (this.isInitializing) {
      // Wait for existing initialization
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.instance) return this.instance;
    }

    this.isInitializing = true;

    try {
      this.instance = new MCPFrontendClient();
      await this.instance.connect();
      return this.instance;
    } catch (error) {
      // Keep a degraded instance so API methods can use HTTP fallbacks.
      if (!this.instance) {
        this.instance = new MCPFrontendClient();
      }
      return this.instance;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Disconnect and cleanup
   */
  static disconnect(): void {
    if (this.instance) {
      this.instance.disconnect();
      this.instance = null;
    }
  }

  /**
   * Check if MCP client is available and connected
   */
  static isConnected(): boolean {
    return this.instance?.isConnectedToServer() ?? false;
  }

  /**
   * Get instance without creating one (for checking connection status)
   */
  static getCurrentInstance(): MCPFrontendClient | null {
    return this.instance;
  }
}

// Export types for use in other files
export type { MCPTool, MCPResource, MCPRequest, MCPResponse };