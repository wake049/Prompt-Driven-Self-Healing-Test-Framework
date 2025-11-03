/**
 * MCP WebSocket Client for React Frontend
 * 
 * Replaces all REST API calls with proper MCP protocol communication.
 * Provides a unified interface for all frontend functionality via MCP server.
 */

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

  constructor(
    serverUrl: string = "ws://localhost:8765",
    authToken: string = "devtoken"
  ) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
  }

  /**
   * Connect to MCP server via WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.serverUrl);

        this.websocket.onopen = () => {
          console.log("🚀 Frontend connected to MCP server");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyConnectionListeners(true);
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.websocket.onclose = (event) => {
          console.log("🔚 Frontend MCP connection closed", event.code, event.reason);
          this.isConnected = false;
          this.notifyConnectionListeners(false);
          this.handleConnectionClose();
        };

        this.websocket.onerror = (error) => {
          console.error("💥 Frontend MCP WebSocket error:", error);
          reject(new Error("Failed to connect to MCP server"));
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("MCP connection timeout"));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
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
      try {
        listener(connected);
      } catch (error) {
        console.error("Connection listener error:", error);
      }
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
        auth_token: this.authToken
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
      console.log(`📤 Frontend MCP Request: ${method}`, params);
    });
  }

  /**
   * Handle incoming messages from MCP server
   */
  private handleMessage(data: string): void {
    try {
      const response: MCPResponse = JSON.parse(data);
      console.log(`📥 Frontend MCP Response:`, response);

      const pending = this.pendingRequests.get(response.id);
      if (!pending) {
        console.warn("Received response for unknown request ID:", response.id);
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

    } catch (error) {
      console.error("Failed to parse MCP response:", error);
    }
  }

  /**
   * Handle connection close and attempt reconnection
   */
  private handleConnectionClose(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      console.log(`🔄 Frontend attempting MCP reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error("Frontend MCP reconnection failed:", error);
        });
      }, delay);
    } else {
      console.error("❌ Frontend MCP max reconnection attempts reached");
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
    const result = await this.callTool("fetch_test_data", {
      data_type: "execution_stats",
      filters
    });
    return result.data || result;
  }

  async getRecentExecutions(options?: { limit?: number; filters?: any }): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "recent_executions",
      filters: options?.filters,
      limit: options?.limit || 20
    });
    return result.data || result;
  }

  async getExecutionTrends(days: number = 30): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "execution_trends",
      filters: { days }
    });
    return result.data || result;
  }

  async getFailureAnalysis(days: number = 30, limit: number = 10): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "failure_analysis",
      filters: { days, limit }
    });
    return result.data || result;
  }

  async getPerformanceMetrics(days: number = 7): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: "performance_metrics",
      filters: { days }
    });
    return result.data || result;
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
      console.log("✅ Frontend MCP client initialized");
      return this.instance;
    } catch (error) {
      console.error("❌ Frontend MCP server connection required:", error);
      this.instance = null;
      throw new Error("MCP server connection required - frontend cannot function without it");
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