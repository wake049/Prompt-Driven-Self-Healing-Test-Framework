/**
 * MCP WebSocket Client for Chrome Extension
 * 
 * Provides proper MCP protocol communication with the MCP server
 * using WebSocket transport for real-time interaction.
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

export class MCPWebSocketClient {
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

  constructor(
    serverUrl: string = "wss://mcp.fluxtest.io/mcp/ws",
    authToken: string = ""
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
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.websocket.onclose = (event) => {
          this.isConnected = false;
          this.handleConnectionClose();
        };

        this.websocket.onerror = (error) => {
          reject(new Error("Failed to connect to MCP server"));
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("Connection timeout"));
          }
        }, 5000);

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
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error("Connection closed"));
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
   * Send a request to the MCP server
   */
  private async sendRequest(method: string, params?: Record<string, any>): Promise<any> {
    if (!this.isConnectedToServer()) {
      throw new Error("MCP server connection required - no fallback mode available");
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
        reject(new Error(`Request timeout for method: ${method}`));
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
      const response: MCPResponse = JSON.parse(data);

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
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
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

  // ===== Chrome Extension Specific Methods =====

  /**
   * Get element from repository
   */
  async getElement(elementId: string): Promise<any> {
    const result = await this.callTool("elements.get", { elementId });
    return result;
  }

  /**
   * Add element to repository
   */
  async addElement(elementId: string, elementData: any): Promise<any> {
    const result = await this.callTool("elements.add", { elementId, elementData });
    return result;
  }

  /**
   * Execute UI action
   */
  async runAction(actionType: string, elementName: string, context: any, parameters?: any): Promise<any> {
    const result = await this.callTool("run_action", {
      action_type: actionType,
      element_name: elementName,
      context,
      parameters
    });
    return result;
  }

  /**
   * Run verification checks
   */
  async verifySection(preset: any): Promise<any> {
    const result = await this.callTool("verify.section", { preset });
    return result;
  }

  /**
   * Store context value
   */
  async setContext(key: string, value: any, type?: string): Promise<any> {
    const result = await this.callTool("context.put", { key, value, type });
    return result;
  }

  /**
   * Retrieve context value
   */
  async getContext(key: string): Promise<any> {
    const result = await this.callTool("context.get", { key });
    return result;
  }

  /**
   * Fetch test data from backend
   */
  async fetchTestData(dataType: string, filters?: any, limit?: number): Promise<any> {
    const result = await this.callTool("fetch_test_data", {
      data_type: dataType,
      filters,
      limit
    });
    return result;
  }

  /**
   * Generate improved locators using AI
   */
  async generateLocators(elements: any[], strategy: string = "hybrid"): Promise<any> {
    const result = await this.callTool("bulk_generate_locators", {
      elements,
      strategy
    });
    return result;
  }

  /**
   * Get element repository list via resources
   */
  async getElementRepository(limit: number = 100, offset: number = 0): Promise<any> {
    const uri = `elements://repository/list?limit=${limit}&offset=${offset}`;
    return this.readResource(uri);
  }

  /**
   * Get execution history via resources
   */
  async getExecutionHistory(limit: number = 50, offset: number = 0): Promise<any> {
    const uri = `executions://test/list?limit=${limit}&offset=${offset}`;
    return this.readResource(uri);
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(): Promise<any> {
    return this.readResource("stats://repository/summary");
  }

  /**
   * Get healing statistics
   */
  async getHealingStats(): Promise<any> {
    return this.readResource("stats://healing/summary");
  }
}

/**
 * Singleton MCP client instance for Chrome extension
 */
export class MCPClientManager {
  private static instance: MCPWebSocketClient | null = null;
  private static isInitializing = false;

  /**
   * Get or create MCP client instance
   */
  static async getInstance(): Promise<MCPWebSocketClient> {
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
      this.instance = new MCPWebSocketClient();
      await this.instance.connect();
      return this.instance;
    } catch (error) {
      this.instance = null;
      throw new Error("MCP server connection required - extension cannot function without it");
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
}

// Export types for use in other files
export type { MCPTool, MCPResource, MCPRequest, MCPResponse };