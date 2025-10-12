/**
 * API Client for MCP SQL Backend
 * Handles communication between Chrome Extension and SQL Backend
 */

const API_BASE_URL = 'http://localhost:3001/api';

interface ApiRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class MCPApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      console.log(`API Request: ${config.method || 'GET'} ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`API Response:`, data);
      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Test Sessions
  async createSession(sessionData: any): Promise<ApiResponse> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  }

  async getSession(sessionId: string): Promise<ApiResponse> {
    return this.request(`/sessions/${sessionId}`);
  }

  async getAllSessions(): Promise<ApiResponse> {
    return this.request('/sessions');
  }

  async updateSession(sessionId: string, updates: any): Promise<ApiResponse> {
    return this.request(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Recorded Elements
  async recordElement(elementData: any, sessionId: string | null = null): Promise<ApiResponse> {
    return this.request('/chrome/record-element', {
      method: 'POST',
      body: JSON.stringify({
        elementData,
        sessionInfo: sessionId ? { session_id: sessionId } : null
      })
    });
  }

  async bulkRecordElements(elements: any[], sessionId: string | null = null): Promise<ApiResponse> {
    return this.request('/elements/bulk', {
      method: 'POST',
      body: JSON.stringify({
        elements,
        session_id: sessionId
      })
    });
  }

  async getElements(filters: Record<string, string> = {}): Promise<ApiResponse> {
    const params = new URLSearchParams(filters);
    return this.request(`/elements?${params}`);
  }

  async updateElement(elementId: string, updates: any): Promise<ApiResponse> {
    return this.request(`/elements/${elementId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteElement(elementId: string): Promise<ApiResponse> {
    return this.request(`/elements/${elementId}`, {
      method: 'DELETE'
    });
  }

  // Test Executions
  async recordExecution(executionData: any, sessionId: string | null = null): Promise<ApiResponse> {
    return this.request('/chrome/record-execution', {
      method: 'POST',
      body: JSON.stringify({
        executionData,
        sessionId
      })
    });
  }

  async getExecutions(filters: Record<string, string> = {}): Promise<ApiResponse> {
    const params = new URLSearchParams(filters);
    return this.request(`/executions?${params}`);
  }

  // Chrome Extension Specific
  async getAllData(): Promise<ApiResponse> {
    return this.request('/chrome/all-data');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
const apiClient = new MCPApiClient();

export default apiClient;
export { MCPApiClient };