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

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
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
    const pageId = sessionId || `page_${btoa(baseUrl).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
    
    // Map old element structure to new unified API format that matches database schema
    const elementDataForAPI = {
      element_key: elementData.id || elementData.element_id || `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      page_id: pageId,
      primary_selector: {
        css_selector: elementData.cssSelector || elementData.css_selector || '',
        xpath: elementData.xpath || '',
        tag: elementData.tag || 'div'
      },
      alt_selectors: elementData.alt_selectors || [],
      attributes: {
        text_content: elementData.text || elementData.textContent || '',
        url: baseUrl,  // Use clean base URL
        full_url: currentUrl,  // Keep full URL for reference
        ...elementData.attributes
      },
      ai_reasoning: elementData.reasoning || `Chrome extension recorded element on ${baseUrl}`,
      is_active: true
    };

    // FastAPI expects parameters as separate fields in the request body
    const requestBody = {
      element_data: elementDataForAPI,
      session_info: { 
        session_id: sessionId || pageId, 
        name: document.title || 'Untitled Page',
        url: baseUrl  // Use clean base URL for page identification
      }
    };

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