/**
 * Chrome Extension Background Script for MCP Integration
 * 
 * This service worker manages MCP connections and provides tool execution
 * capabilities for the self-healing test framework.
 */

import type { 
  MCPTool,
  ToolResult,
  UIAction,
  ElementRepository,
  VerificationPreset,
  ContextStore
} from './types';
import { suggestSelector } from './background/suggester';
import apiClient from './api/api-client';

// Import MCP client functionality
class MCPClient {
  private websocket: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private serverUrl: string;
  private authToken: string;

  constructor(serverUrl: string = "wss://mcp.fluxtest.io/mcp/ws", authToken: string = "") {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(this.serverUrl);

      this.websocket.onopen = () => resolve();
      this.websocket.onmessage = (event) => this.handleMessage(event.data);
      this.websocket.onerror = () => reject(new Error("Failed to connect to MCP server"));
      
      setTimeout(() => reject(new Error("MCP connection timeout")), 10000);
    });
  }

  private handleMessage(data: string): void {
    try {
      const response = JSON.parse(data);
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (error) {
      console.error("Failed to handle MCP message:", error);
    }
  }

  async sendRequest(method: string, params?: Record<string, any>): Promise<any> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error("MCP connection not available");
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params: { ...params, auth_token: this.authToken }
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.websocket!.send(JSON.stringify(request));
      
      // Cleanup after timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("MCP request timeout"));
        }
      }, 30000);
    });
  }

  async ping(): Promise<any> {
    return this.sendRequest("ping");
  }

  async listTools(): Promise<MCPTool[]> {
    return this.sendRequest("tools/list");
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    return this.sendRequest("tools/call", { name, arguments: args });
  }
}

class MCPClientManager {
  private static instance: MCPClient | null = null;

  static async getInstance(): Promise<MCPClient> {
    if (!this.instance) {
      this.instance = new MCPClient();
      await this.instance.connect();
    }
    return this.instance;
  }
}

class MCPToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private elementRepo: ElementRepository = {};
  private contextStore: ContextStore = {};
  private verificationPresets: VerificationPreset[] = [];
  private recordingDataStore: any[] = [];
  private currentPageInfo: { page: string; url: string; timestamp: number } | null = null;
  private mcpClient: MCPClient | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeTools();
    this.loadStoredData();
    this.initializeMCPConnection();
  }

  /**
   * Initialize connection to MCP server (required)
   */
  private async initializeMCPConnection() {
    try {
      this.mcpClient = await MCPClientManager.getInstance();
      await this.mcpClient.ping();
      this.isInitialized = true;
      console.log("MCP connection established");
    } catch (error) {
      this.isInitialized = false;
      console.error("MCP server connection failed:", error);
    }
  }

  /**
   * Ensure MCP connection is available
   */
  private ensureMCPConnection() {
    if (!this.isInitialized || !this.mcpClient) {
      throw new Error("MCP server connection required - extension disabled");
    }
  }

  /**
   * Initialize available tools
   */
  private initializeTools() {
    // Core MCP tools will be loaded dynamically from server
    this.tools.clear();
  }

  /**
   * Load stored data from chrome storage
   */
  private async loadStoredData() {
    try {
      const data = await chrome.storage.local.get([
        'elementRepository', 
        'contextStore', 
        'verificationPresets',
        'recordingDataStore'
      ]);
      
      this.elementRepo = data.elementRepository || {};
      this.contextStore = data.contextStore || {};
      this.verificationPresets = data.verificationPresets || [];
      this.recordingDataStore = data.recordingDataStore || [];
    } catch (error) {
      console.error('Failed to load stored data:', error);
    }
  }

  /**
   * Save data to chrome storage
   */
  private async saveToStorage() {
    try {
      await chrome.storage.local.set({
        elementRepository: this.elementRepo,
        contextStore: this.contextStore,
        verificationPresets: this.verificationPresets,
        recordingDataStore: this.recordingDataStore
      });
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  /**
   * Get available tools from MCP server
   */
  public async listTools(): Promise<MCPTool[]> {
    this.ensureMCPConnection();
    return await this.mcpClient!.listTools();
  }

  /**
   * Execute tool call via MCP server
   */
  public async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    try {
      const result = await this.mcpClient!.callTool(name, args);
      
      return {
        success: true,
        data: result,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Add element to repository
   */
  public async addElement(elementId: string, elementData: any): Promise<ToolResult> {
    try {
      const result = await this.callTool("elements.add", { elementId, elementData });
      
      // Also store locally for offline access
      this.elementRepo[elementId] = {
        ...elementData,
        id: elementId,
        timestamp: Date.now(),
        page: this.currentPageInfo?.page || 'unknown'
      };
      
      await this.saveToStorage();
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get element from repository
   */
  public async getElement(elementId: string): Promise<ToolResult> {
    try {
      const result = await this.callTool("elements.get", { elementId });
      return result;
    } catch (error) {
      // Fallback to local storage
      const localElement = this.elementRepo[elementId];
      if (localElement) {
        return {
          success: true,
          data: localElement,
          error: undefined
        };
      }
      
      return {
        success: false,
        data: null,
        error: `Element not found: ${elementId}`
      };
    }
  }

  /**
   * Set context value
   */
  public async setContext(key: string, value: any, type?: string): Promise<ToolResult> {
    try {
      const result = await this.callTool("context.put", { key, value, type });
      
      // Also store locally
      this.contextStore[key] = { value, type, timestamp: Date.now() };
      await this.saveToStorage();
      
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get context value
   */
  public async getContext(key: string): Promise<ToolResult> {
    try {
      const result = await this.callTool("context.get", { key });
      return result;
    } catch (error) {
      // Fallback to local storage
      const localValue = this.contextStore[key];
      if (localValue) {
        return {
          success: true,
          data: localValue.value,
          error: undefined
        };
      }
      
      return {
        success: false,
        data: null,
        error: `Context key not found: ${key}`
      };
    }
  }

  /**
   * Run action via MCP server
   */
  public async runAction(actionType: string, elementName: string, context: any, parameters?: any): Promise<ToolResult> {
    try {
      const result = await this.callTool("run_action", {
        action_type: actionType,
        element_name: elementName,
        context,
        parameters
      });
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Verify section
   */
  public async verifySection(preset: VerificationPreset): Promise<ToolResult> {
    try {
      const result = await this.callTool("verify.section", { preset });
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Fetch test data
   */
  public async fetchTestData(dataType: string, filters?: any, limit?: number): Promise<ToolResult> {
    try {
      const result = await this.callTool("fetch_test_data", {
        data_type: dataType,
        filters,
        limit
      });
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate locators
   */
  public async generateLocators(elements: any[], strategy: string = "hybrid"): Promise<ToolResult> {
    try {
      const result = await this.callTool("bulk_generate_locators", {
        elements,
        strategy
      });
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Set current page info
   */
  public setCurrentPage(page: string, url: string) {
    this.currentPageInfo = {
      page,
      url,
      timestamp: Date.now()
    };
  }
}

// Initialize the tool registry
const toolRegistry = new MCPToolRegistry();

// Chrome extension message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep the message channel open for async responses
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    const { type, data } = message;

    switch (type) {
      case 'PING':
        sendResponse({ success: true, result: 'pong' });
        break;

      case 'LIST_TOOLS':
        try {
          const result = await toolRegistry.listTools();
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP tools list failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'CALL_TOOL':
        try {
          const { toolName, args } = data;
          const result = await toolRegistry.callTool(toolName, args);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP tool call failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'RUN_ACTION':
        try {
          const { actionType, elementName, context, parameters } = data;
          const result = await toolRegistry.runAction(actionType, elementName, context, parameters);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP action failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'GET_ELEMENT':
        try {
          const result = await toolRegistry.getElement(data.elementId);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP element get failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'ADD_ELEMENT':
        try {
          const result = await toolRegistry.addElement(data.elementId, data.elementData);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP element add failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'VERIFY_SECTION':
        try {
          const result = await toolRegistry.verifySection(data.preset);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP verification failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'SET_CONTEXT':
        try {
          const result = await toolRegistry.setContext(data.key, data.value, data.type);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP context set failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'GET_CONTEXT':
        try {
          const result = await toolRegistry.getContext(data.key);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP context get failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'FETCH_TEST_DATA':
        try {
          const result = await toolRegistry.fetchTestData(data.dataType, data.filters, data.limit);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP test data fetch failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'GENERATE_LOCATORS':
        try {
          const result = await toolRegistry.generateLocators(data.elements, data.strategy);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP locator generation failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'SET_CURRENT_PAGE':
        try {
          toolRegistry.setCurrentPage(data.page, data.url);
          sendResponse({ success: true, result: 'Page info updated' });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `Failed to set page info: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      default:
        sendResponse({ 
          success: false, 
          error: `Unknown message type: ${type}` 
        });
    }
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: `MCP background error: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

// Initialize background script
console.log("MCP Chrome Extension Background Script Initialized");
