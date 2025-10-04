import { 
  TestPlanResponse, 
  ActionTemplate, 
  SystemStats, 
  CatalogResponse,
  ElementRecord,
  CreateElementRequest,
  AddVersionRequest,
  ApproveVersionRequest,
  SearchElementsRequest,
  RepositoryStats,
  // Enhanced API types
  Page,
  CreatePageRequest,
  EnhancedElement,
  CreateEnhancedElementRequest,
  SuggestIDRequest,
  SuggestedID,
  TestSelectorRequest,
  TestSelectorResult
} from '../types';

const API_BASE_URL = 'http://localhost:8001';

class ApiService {
  private async fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        // Remove auth for now since MCP server might not expect it
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail?.message || 
        errorData.message || 
        `API Error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  async generateTestPlan(prompt: string): Promise<TestPlanResponse> {
    return this.fetchJson<TestPlanResponse>('/plan', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async getActionCatalog(): Promise<CatalogResponse> {
    return this.fetchJson<CatalogResponse>('/catalog');
  }

  async getActionTemplate(templateId: string): Promise<ActionTemplate> {
    return this.fetchJson<ActionTemplate>(`/catalog/template/${templateId}`);
  }

  async getSystemStats(): Promise<SystemStats> {
    return this.fetchJson<SystemStats>('/stats');
  }

  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.fetchJson<{ status: string; timestamp: string }>('/api/v1/health');
  }

  async searchActionCatalog(query: string): Promise<CatalogResponse> {
    return this.fetchJson<CatalogResponse>(`/catalog/search?query=${encodeURIComponent(query)}`);
  }

  // Element Repository Methods
  async createElement(request: CreateElementRequest): Promise<ElementRecord> {
    const response = await this.fetchJson<{status: string; result: {status: string; element: ElementRecord; message: string}}>('/api/v1/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: 'create_element',
        parameters: request
      }),
    });
    
    // Extract element from the nested response structure
    if (response.status !== "success" || response.result.status !== "success") {
      throw new Error(response.result?.message || 'Failed to create element');
    }
    return response.result.element;
  }

  async addElementVersion(request: AddVersionRequest): Promise<{ success: boolean; version: number }> {
    const response = await this.fetchJson<{success: boolean; version: number}>('/api/v1/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: 'add_element_version',
        parameters: request
      }),
    });
    
    return { success: response.success, version: response.version };
  }

  async approveElementVersion(request: ApproveVersionRequest): Promise<{ success: boolean }> {
    const response = await this.fetchJson<{success: boolean}>('/api/v1/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: 'approve_element_version',
        parameters: request
      }),
    });
    
    return { success: response.success };
  }

  async searchElements(request: SearchElementsRequest = {}): Promise<ElementRecord[]> {
    const response = await this.fetchJson<{status: string; result: {status: string; elements: ElementRecord[]; message: string}}>('/api/v1/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: 'search_elements',
        parameters: request
      }),
    });
    
    // Extract elements array from the nested response
    if (response.status !== "success" || response.result.status !== "success") {
      throw new Error(response.result?.message || 'Failed to search elements');
    }
    return response.result.elements || [];
  }

  async getRepositoryStats(): Promise<RepositoryStats> {
    const response = await this.fetchJson<{status: string; result: {status: string; stats: RepositoryStats; message: string}}>('/api/v1/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: 'get_repository_stats',
        parameters: {}
      }),
    });
    
    // Extract stats from the nested response
    if (response.status !== "success" || response.result.status !== "success") {
      throw new Error(response.result?.message || 'Failed to get repository stats');
    }
    return response.result.stats;
  }

  async getElement(name: string): Promise<ElementRecord> {
    return this.fetchJson<ElementRecord>(`/api/v1/tools/elements/${encodeURIComponent(name)}`);
  }

  // Enhanced API Methods for Page Management
  async createPage(request: CreatePageRequest): Promise<Page> {
    return this.fetchJson<Page>('/api/v1/pages', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getPages(): Promise<Page[]> {
    return this.fetchJson<Page[]>('/api/v1/pages');
  }

  async createEnhancedElement(request: CreateEnhancedElementRequest): Promise<EnhancedElement> {
    return this.fetchJson<EnhancedElement>('/api/v1/elements', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async suggestElementIDs(request: SuggestIDRequest): Promise<SuggestedID[]> {
    const response = await this.fetchJson<{ suggestions: SuggestedID[] }>('/api/v1/elements/suggest-id', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    return response.suggestions || [];
  }

  async testSelector(request: TestSelectorRequest): Promise<TestSelectorResult> {
    return this.fetchJson<TestSelectorResult>('/api/v1/selectors/test', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ================================
  // MCP Test Data Management
  // ================================

  async saveMCPTestSession(sessionData: any): Promise<{ success: boolean; sessionId: string }> {
    return this.fetchJson<{ success: boolean; sessionId: string }>('/api/v1/mcp/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getMCPTestSessions(): Promise<any[]> {
    return this.fetchJson<any[]>('/api/v1/mcp/sessions');
  }

  async getMCPTestSession(sessionId: string): Promise<any> {
    return this.fetchJson<any>(`/api/v1/mcp/sessions/${sessionId}`);
  }

  async deleteMCPTestSession(sessionId: string): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(`/api/v1/mcp/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async saveMCPRecordedElement(elementData: any): Promise<{ success: boolean; elementId: string }> {
    return this.fetchJson<{ success: boolean; elementId: string }>('/api/v1/mcp/elements', {
      method: 'POST',
      body: JSON.stringify(elementData),
    });
  }

  async getMCPRecordedElements(page?: string): Promise<any[]> {
    const queryParam = page ? `?page=${encodeURIComponent(page)}` : '';
    return this.fetchJson<any[]>(`/api/v1/mcp/elements${queryParam}`);
  }

  async saveMCPTestExecution(executionData: any): Promise<{ success: boolean; executionId: string }> {
    return this.fetchJson<{ success: boolean; executionId: string }>('/api/v1/mcp/executions', {
      method: 'POST',
      body: JSON.stringify(executionData),
    });
  }

  async getMCPTestExecutions(sessionId?: string): Promise<any[]> {
    const queryParam = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return this.fetchJson<any[]>(`/api/v1/mcp/executions${queryParam}`);
  }
}

export const apiService = new ApiService();