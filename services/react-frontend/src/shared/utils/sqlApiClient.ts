/**
 * MCP-based SQL API Client
 * 
 * Replaces the REST-based sqlApiClient with MCP protocol calls.
 * Maintains the same interface for backward compatibility.
 */

import { MCPFrontendManager } from '../../services/mcpFrontendClient';
import { config } from '../../app/config';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface TestSession {
  id: string;
  name: string;
  page: string;
  description?: string;
  elements: any[];
  executions: any[];
  created_at: string;
  updated_at: string;
  element_count?: number;
  execution_count?: number;
}

interface RecordedElementDB {
  id: string; // Database UUID primary key
  session_id: string;
  logical_key: string; // Replaces element_id - user-friendly identifier
  tag: string;
  text_content?: string;
  attributes: Record<string, any>;
  xpath?: string;
  css_selector?: string;
  primary_selector?: string; // JSON string containing tag, xpath, css_selector
  position_x: number;
  position_y: number;
  selectors: string[];
  page?: string;
  timestamp_recorded: string;
  last_updated: string;
  is_active: boolean;
  session_name?: string;
}

interface TestExecutionDB {
  id: string;
  session_id: string;
  element_id?: string;
  tool_name: string;
  parameters: Record<string, any>;
  result_success?: boolean;
  result_data?: any;
  result_error?: string;
  result_logs: string[];
  timestamp_executed: string;
  duration_ms?: number;
  session_name?: string;
  element_logical_key?: string;
}

class MCPSqlApiClient {
  private async getMCPClient() {
    const client = await MCPFrontendManager.getInstance();
    if (!client.isConnectedToServer()) {
      throw new Error("MCP server connection required for SQL API operations");
    }
    return client;
  }

  // Session Management
  async getAllSessions(): Promise<ApiResponse<TestSession[]>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("fetch_test_data", {
        data_type: "sessions",
        filters: {}
      });
      
      return {
        success: true,
        data: result.data?.sessions || result.sessions || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch sessions via MCP"
      };
    }
  }

  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.readResource(`sessions://test/${sessionId}`);
      
      return {
        success: true,
        data: result.session || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch session via MCP"
      };
    }
  }

  async createSession(sessionData: Partial<TestSession>): Promise<ApiResponse<TestSession>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("run_action", {
        action_type: "create_session",
        element_name: sessionData.name || "New Session",
        context: { session_data: sessionData }
      });
      
      return {
        success: result.ok || result.success || false,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create session via MCP"
      };
    }
  }

  async updateSession(sessionId: string, sessionData: Partial<TestSession>): Promise<ApiResponse<TestSession>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("run_action", {
        action_type: "update_session",
        element_name: sessionId,
        context: { session_data: sessionData }
      });
      
      return {
        success: result.ok || result.success || false,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update session via MCP"
      };
    }
  }

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("run_action", {
        action_type: "delete_session",
        element_name: sessionId,
        context: { operation: "delete" }
      });
      
      return {
        success: result.ok || result.success || false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete session via MCP"
      };
    }
  }

  // Element Management
  async getAllElements(options?: { limit?: number; offset?: number }): Promise<ApiResponse<RecordedElementDB[]>> {
    try {
      // Use unified API directly to get real database elements
      const { UnifiedApiClient } = await import('./unifiedApiClient');
      const unifiedApi = new UnifiedApiClient();
      const result = await unifiedApi.getAllElements(options);
      
      return {
        success: result.success || true,
        data: result.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch elements from database"
      };
    }
  }

  async getElement(elementId: string): Promise<ApiResponse<RecordedElementDB>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("elements.get", { elementId });
      
      return {
        success: result.ok || true,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch element via MCP"
      };
    }
  }

  async createElement(elementData: Partial<RecordedElementDB>): Promise<ApiResponse<RecordedElementDB>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("elements.add", {
        elementId: elementData.logical_key || elementData.id,
        elementData
      });
      
      return {
        success: result.ok || result.success || false,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create element via MCP"
      };
    }
  }

  async updateElement(elementId: string, updates: any): Promise<ApiResponse<any>> {
    try {
      // Use direct REST API call
      const apiUrl = config.apiBaseUrl;
      const response = await fetch(`${apiUrl}/api/v1/sql/elements/${elementId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Update failed' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      return {
        success: result.success || true,
        data: result.data,
        message: result.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update element"
      };
    }
  }

  async deleteElement(elementId: string): Promise<ApiResponse<void>> {
    try {
      // Use direct REST API call instead of MCP
      const apiUrl = config.apiBaseUrl;
      const response = await fetch(`${apiUrl}/api/v1/sql/elements/${elementId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Delete failed' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      return {
        success: result.success || true,
        message: result.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete element"
      };
    }
  }

  // Execution Management
  async getAllExecutions(options?: { limit?: number; offset?: number; session_id?: string }): Promise<ApiResponse<TestExecutionDB[]>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("fetch_test_data", {
        data_type: "test_executions",
        filters: options || {},
        limit: options?.limit || 100
      });
      
      return {
        success: true,
        data: result.data?.executions || result.executions || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch executions via MCP"
      };
    }
  }

  async getExecution(executionId: string): Promise<ApiResponse<TestExecutionDB>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.readResource(`executions://test/${executionId}`);
      
      return {
        success: true,
        data: result.execution || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch execution via MCP"
      };
    }
  }

  async createExecution(executionData: Partial<TestExecutionDB>): Promise<ApiResponse<TestExecutionDB>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("run_action", {
        action_type: executionData.tool_name || "execute_test",
        element_name: executionData.element_logical_key || executionData.element_id || "test",
        context: {
          session_id: executionData.session_id,
          parameters: executionData.parameters || {}
        }
      });
      
      return {
        success: result.ok || result.success || false,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create execution via MCP"
      };
    }
  }

  async deleteExecution(executionId: string): Promise<ApiResponse<void>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("run_action", {
        action_type: "delete_execution",
        element_name: executionId,
        context: { operation: "delete" }
      });
      
      return {
        success: result.ok || result.success || false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete execution via MCP"
      };
    }
  }

  // Statistics and Analytics
  async getStats(): Promise<ApiResponse<any>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.readResource("stats://repository/summary");
      
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch stats via MCP"
      };
    }
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.ping();
      
      return {
        success: true,
        data: {
          status: result.status || "ok",
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "MCP health check failed"
      };
    }
  }

  // Bulk Operations
  async bulkCreateElements(elements: Partial<RecordedElementDB>[]): Promise<ApiResponse<RecordedElementDB[]>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("bulk_generate_locators", {
        elements: elements,
        strategy: "create"
      });
      
      return {
        success: result.ok || result.success || false,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to bulk create elements via MCP"
      };
    }
  }

  async bulkUpdateElements(elements: Array<{ id: string; data: Partial<RecordedElementDB> }>): Promise<ApiResponse<RecordedElementDB[]>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("bulk_generate_locators", {
        elements: elements.map(e => ({ ...e.data, id: e.id })),
        strategy: "update"
      });
      
      return {
        success: result.ok || result.success || false,
        data: result.data || result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to bulk update elements via MCP"
      };
    }
  }

  async bulkDeleteElements(elementIds: string[]): Promise<ApiResponse<void>> {
    try {
      const client = await this.getMCPClient();
      const result = await client.callTool("run_action", {
        action_type: "bulk_delete_elements",
        element_name: "bulk_operation",
        context: { element_ids: elementIds }
      });
      
      return {
        success: result.ok || result.success || false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to bulk delete elements via MCP"
      };
    }
  }
}

export const sqlApiClient = new MCPSqlApiClient();
export type { ApiResponse, TestSession, RecordedElementDB, TestExecutionDB };