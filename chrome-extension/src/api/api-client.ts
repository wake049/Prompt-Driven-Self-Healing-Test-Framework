/**
 * API Client for MCP SQL Backend
 * Handles communication between Chrome Extension and SQL Backend
 */

const API_BASE_URL = 'https://testhelix.com/api/v1';

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

    console.log(`API Client - Making request to: ${url}`);
    console.log(`API Client - Request config:`, config);

    try {
      const response = await fetch(url, config);
      
      console.log(`API Client - Response status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorBody = await response.text();
          console.log(`API Client - Error response body:`, errorBody);
          
          // Try to parse JSON error
          try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.detail) {
              errorMessage += ` - ${errorJson.detail}`;
            }
          } catch {
            // If not JSON, include the raw text
            if (errorBody) {
              errorMessage += ` - ${errorBody}`;
            }
          }
        } catch (e) {
          console.log('Could not read error response body:', e);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`API Client - Success response:`, data);
      return data;
    } catch (error) {
      console.error(`API Client - Request failed:`, error);
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

  // Recorded Elements - Updated for unified API
  async recordElement(elementData: any, sessionId: string | null = null): Promise<ApiResponse> {
    // Generate a page ID based on the current URL for better organization
    const currentUrl = window.location.href;
    // Create a more consistent page ID based on the base URL (without query params)
    const baseUrl = currentUrl.split('?')[0].split('#')[0];
    
    // Map element data to match the API's ElementData model exactly
    const elementDataForAPI = {
      // Required fields
      tag: elementData.tag || 'div',
      page: elementData.page || document.title || window.location.pathname || 'Current Page',
      
      // Optional fields with defaults
      id: elementData.id || elementData.element_id || undefined,
      element_id: elementData.id || elementData.element_id || undefined,
      text_content: elementData.text_content || elementData.text || undefined,
      text: elementData.text || elementData.text_content || undefined,
      attributes: elementData.attributes || {},
      xpath: elementData.xpath || undefined,
      cssSelector: elementData.cssSelector || elementData.css_selector || undefined,
      css_selector: elementData.css_selector || elementData.cssSelector || undefined,
      position_x: elementData.position_x || elementData.position?.x || 0,
      position_y: elementData.position_y || elementData.position?.y || 0,
      selectors: Array.isArray(elementData.selectors) ? elementData.selectors : [],
      logical_key: elementData.logical_key || undefined,
      identity_data: elementData.identity_data || elementData.identity || {}
    };

    // FastAPI expects separate parameters, not nested structure
    const requestBody = {
      element_data: elementDataForAPI,
      session_info: sessionId ? {
        session_id: sessionId,
        name: document.title || 'Untitled Page',
        page: elementData.page || document.title || 'Current Page',
        description: `Recorded from ${baseUrl}`
      } : undefined
    };

    console.log('API Client - Sending element data:', requestBody);

    return this.request('/sql/record-element', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
  }

  async bulkRecordElements(elements: any[], sessionId: string | null = null): Promise<ApiResponse> {
    // For now, record elements individually as bulk endpoint may not be available
    const results = [];
    for (const element of elements) {
      try {
        const result = await this.recordElement(element, sessionId);
        results.push(result);
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      success: true,
      data: results,
      message: `Processed ${results.length} elements`
    };
  }

  async getElements(filters: Record<string, string> = {}): Promise<ApiResponse> {
    const params = new URLSearchParams(filters);
    return this.request(`/sql/elements?${params}`);
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
    // Map execution data to healing API format
    const healingData = {
      healing_attempts: [{
        elementId: executionData.elementId || 'unknown',
        page: executionData.page || 'unknown',
        originalLocator: executionData.originalSelector || '',
        healedLocator: executionData.healedSelector,
        result: executionData.success ? 'SUCCESS' : 'FAILED'
      }],
      session_id: sessionId
    };

    return this.request('/sql/healing/submit', {
      method: 'POST',
      body: JSON.stringify(healingData)
    });
  }

  async getExecutions(filters: Record<string, string> = {}): Promise<ApiResponse> {
    // Return empty for now as this endpoint may not be available
    return {
      success: true,
      data: [],
      message: 'Executions endpoint not implemented in unified API'
    };
  }

  // Chrome Extension Specific
  async getAllData(): Promise<ApiResponse> {
    return this.request('/sql/all-data');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sql/health`);
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