import type { 
  MCPTool,
  ToolResult,
  UIAction,
  ElementRepository,
  VerificationPreset,
  ContextStore
} from './types';
import { MCPClientManager } from './mcp-client';

/**
 * MCP-only background service for Chrome extension
 * 
 * This service requires MCP server connection and has no fallback modes.
 * All functionality is provided through proper MCP protocol communication.
 */

class MCPOnlyToolRegistry {
  private mcpClient: any = null;
  private isInitialized = false;

  constructor() {
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
      console.log("✅ MCP server connection established");
    } catch (error) {
      console.error("❌ MCP server connection required - extension cannot function:", error);
      this.isInitialized = false;
      throw new Error("MCP server connection required - no fallback mode available");
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
   * Get available tools from MCP server
   */
  public async listTools(): Promise<MCPTool[]> {
    this.ensureMCPConnection();
    return await this.mcpClient.listTools();
  }

  /**
   * Execute tool call via MCP server
   */
  public async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.callTool(name, args);
    
    // Convert MCP result format to ToolResult format
    if (result && typeof result === 'object') {
      if (result.ok !== undefined) {
        return {
          success: result.ok,
          data: result.data,
          error: result.ok ? undefined : result.error
        };
      }
      // Direct result format
      return {
        success: true,
        data: result
      };
    }
    
    return {
      success: true,
      data: result
    };
  }

  /**
   * Run UI action via MCP
   */
  public async runAction(actionType: string, elementName: string, context: any, parameters?: any): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.runAction(actionType, elementName, context, parameters);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Get element from repository via MCP
   */
  public async getElement(elementId: string): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.getElement(elementId);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Add element to repository via MCP
   */
  public async addElement(elementId: string, elementData: any): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.addElement(elementId, elementData);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Run verification checks via MCP
   */
  public async verifySection(preset: any): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.verifySection(preset);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Store context value via MCP
   */
  public async setContext(key: string, value: any, type?: string): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.setContext(key, value, type);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Retrieve context value via MCP
   */
  public async getContext(key: string): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.getContext(key);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Fetch test data via MCP
   */
  public async fetchTestData(dataType: string, filters?: any, limit?: number): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.fetchTestData(dataType, filters, limit);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }

  /**
   * Generate improved locators via MCP
   */
  public async generateLocators(elements: any[], strategy: string = "hybrid"): Promise<ToolResult> {
    this.ensureMCPConnection();
    
    const result = await this.mcpClient.generateLocators(elements, strategy);
    return {
      success: result.ok,
      data: result.data,
      error: result.ok ? undefined : result.error
    };
  }
}

// Global tool registry instance
const toolRegistry = new MCPOnlyToolRegistry();

// ===== Chrome Extension Message Handlers =====

/**
 * Handle messages from content script and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    const { type, data } = message;

    switch (type) {
      case 'CALL_TOOL':
        try {
          const result = await toolRegistry.callTool(data.name, data.args);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP tool call failed: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        break;

      case 'LIST_TOOLS':
        try {
          const tools = await toolRegistry.listTools();
          sendResponse({ success: true, tools });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `MCP tools list failed: ${error instanceof Error ? error.message : String(error)}` 
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

      default:
        sendResponse({ 
          success: false, 
          error: `Unknown message type: ${type}` 
        });
    }
  } catch (error) {
    console.error('Background message handler error:', error);
    sendResponse({ 
      success: false, 
      error: `MCP background error: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('MCP Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    console.log('🚀 MCP Extension installed - requires MCP server connection');
  } else if (details.reason === 'update') {
    console.log('🔄 MCP Extension updated - reconnecting to MCP server');
  }
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('🌟 MCP Extension started - initializing MCP connection');
});

console.log('🔧 MCP-only background script loaded');