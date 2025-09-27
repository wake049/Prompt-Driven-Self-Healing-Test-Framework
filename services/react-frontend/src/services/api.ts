import { TestPlanResponse, ActionTemplate, SystemStats, CatalogResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  private async fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
    return this.fetchJson<{ status: string; timestamp: string }>('/health');
  }

  async searchActionCatalog(query: string): Promise<CatalogResponse> {
    return this.fetchJson<CatalogResponse>(`/catalog/search?query=${encodeURIComponent(query)}`);
  }
}

export const apiService = new ApiService();