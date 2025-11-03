import { useAuth } from '../../contexts/AuthContext';
export interface PromptData {
  id: string;
  title: string;
  content: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
  created_at: string;
  updated_at?: string;
  usage_count?: number;
  priority?: number;
  estimated_duration?: number;
  starting_url?: string;
  author_id?: string;
  version?: number;
}
export interface CreatePromptRequest {
  title: string;
  content: string;
  description?: string;
  category?: string;
  tags?: string[];
  starting_url?: string;
}
export interface PromptsResponse {
  prompts: PromptData[];
  total?: number;
}
class AuthenticatedPromptsApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }
  private async fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      headers: this.getAuthHeaders(),
      ...options,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // For long work sessions, don't automatically logout
        // Let the user handle re-authentication manually if needed
        throw new Error('Authentication error - please refresh the page or login again if needed');
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  private async fetchWithoutAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`http://localhost:8000${endpoint}`, {
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
  async getPrompts(): Promise<PromptsResponse> {
    // Use real database endpoint
    return this.fetchWithAuth<PromptsResponse>('/api/v1/prompts');
  }
  async getPrompt(promptId: string): Promise<PromptData> {
    // Use real database endpoint
    return this.fetchWithAuth<PromptData>(`/api/v1/prompts/${promptId}`);
  }
  async createPrompt(promptData: CreatePromptRequest): Promise<PromptData> {
    return this.fetchWithAuth<PromptData>('/api/v1/prompts', {
      method: 'POST',
      body: JSON.stringify(promptData),
    });
  }
  async updatePrompt(promptId: string, promptData: Partial<CreatePromptRequest>): Promise<PromptData> {
    return this.fetchWithAuth<PromptData>(`/api/v1/prompts/${promptId}`, {
      method: 'PUT',
      body: JSON.stringify(promptData),
    });
  }
  async deletePrompt(promptId: string): Promise<void> {
    await this.fetchWithAuth<void>(`/api/v1/prompts/${promptId}`, {
      method: 'DELETE',
    });
  }
}
export const promptsApiService = new AuthenticatedPromptsApiService();