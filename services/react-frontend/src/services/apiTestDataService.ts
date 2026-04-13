/**
 * API Test Data Service
 * Frontend service for managing API-based test data creation.
 * Allows testers to configure API endpoints, create templates, and
 * set up precondition data that runs before UI tests.
 */

import { config } from '../app/config';

const API_BASE = config.apiBaseUrl;

// ============ Types ============

export type AuthType = 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  base_url: string;
  auth_type: AuthType;
  auth_config?: Record<string, any>;
  default_headers?: Record<string, string>;
  timeout_seconds: number;
  retry_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiEndpointCreate {
  name: string;
  description?: string;
  base_url: string;
  auth_type: AuthType;
  auth_config?: Record<string, any>;
  default_headers?: Record<string, string>;
  timeout_seconds?: number;
  retry_count?: number;
  is_active?: boolean;
  project_id?: string;
}

export interface ResponseExtractor {
  name: string;
  json_path: string;
  default_value?: any;
  required: boolean;
}

export interface DataTemplate {
  id: string;
  endpoint_id: string;
  endpoint_name?: string;
  name: string;
  description?: string;
  category?: string;
  http_method: HttpMethod;
  path: string;
  request_headers?: Record<string, string>;
  request_body_template?: Record<string, any>;
  expected_status_codes: number[];
  response_extractors: ResponseExtractor[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DataTemplateCreate {
  endpoint_id: string;
  name: string;
  description?: string;
  category?: string;
  http_method: HttpMethod;
  path: string;
  request_headers?: Record<string, string>;
  request_body_template?: Record<string, any>;
  expected_status_codes?: number[];
  response_extractors?: ResponseExtractor[];
  is_active?: boolean;
}

export interface DataSet {
  id: string;
  template_id: string;
  template_name?: string;
  name: string;
  description?: string;
  variables: Record<string, any>;
  is_default: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DataSetCreate {
  template_id: string;
  name: string;
  description?: string;
  variables: Record<string, any>;
  is_default?: boolean;
  tags?: string[];
}

export interface TestDataSetup {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  execution_order: number;
  template_id: string;
  data_set_id?: string;
  custom_variables: Record<string, any>;
  output_variables: OutputVariable[];
  is_active: boolean;
  template_name?: string;
  template_category?: string;
  data_set_name?: string;
  created_at: string;
  updated_at: string;
}

export interface OutputVariable {
  name: string;
  source: string;
  transform?: string;
}

export interface TestDataSetupCreate {
  name: string;
  description?: string;
  execution_order?: number;
  template_id: string;
  data_set_id?: string;
  custom_variables?: Record<string, any>;
  output_variables?: OutputVariable[];
  is_active?: boolean;
  project_id?: string;
}

export interface PromptSetupLink {
  id: string;
  prompt_id: string;
  setup_id: string;
  setup_name: string;
  execution_order: number;
  is_active: boolean;
  template_name?: string;
  category?: string;
  created_at: string;
}

export interface SetupExecutionResult {
  setup_id: string;
  setup_name: string;
  success: boolean;
  request_url: string;
  request_method: string;
  response_status?: number;
  duration_ms: number;
  extracted_variables: Record<string, string>;
  error_message?: string;
}

export interface ExecuteSetupsResponse {
  success: boolean;
  total_setups: number;
  successful_setups: number;
  failed_setups: number;
  results: SetupExecutionResult[];
  combined_variables: Record<string, string>;
  execution_time_ms: number;
}

export interface ExecutionHistoryItem {
  id: string;
  setup_id?: string;
  setup_name?: string;
  template_name?: string;
  request_url: string;
  request_method: string;
  response_status?: number;
  extracted_variables: Record<string, string>;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  executed_at: string;
}

// ============ Helper ============

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const json = await response.json();
  
  if (!response.ok) {
    throw new Error(json.detail || json.message || 'API request failed');
  }
  
  return json.data !== undefined ? json.data : json;
}

// ============ API Endpoints Service ============

export const apiEndpointsService = {
  async list(projectId?: string, isActive?: boolean): Promise<ApiEndpoint[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
    if (isActive !== undefined) params.append('is_active', String(isActive));
    return apiRequest<ApiEndpoint[]>(`/api/v1/test-data/endpoints?${params}`);
  },

  async get(endpointId: string): Promise<ApiEndpoint> {
    return apiRequest<ApiEndpoint>(`/api/v1/test-data/endpoints/${endpointId}`);
  },

  async create(endpoint: ApiEndpointCreate): Promise<ApiEndpoint> {
    return apiRequest<ApiEndpoint>('/api/v1/test-data/endpoints', {
      method: 'POST',
      body: JSON.stringify(endpoint),
    });
  },

  async update(endpointId: string, updates: Partial<ApiEndpointCreate>): Promise<ApiEndpoint> {
    return apiRequest<ApiEndpoint>(`/api/v1/test-data/endpoints/${endpointId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(endpointId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/test-data/endpoints/${endpointId}`, {
      method: 'DELETE',
    });
  },
};

// ============ Data Templates Service ============

export const dataTemplatesService = {
  async list(filters?: { endpoint_id?: string; category?: string; is_active?: boolean; search?: string }): Promise<DataTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.endpoint_id) params.append('endpoint_id', filters.endpoint_id);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.search) params.append('search', filters.search);
    return apiRequest<DataTemplate[]>(`/api/v1/test-data/templates?${params}`);
  },

  async get(templateId: string): Promise<DataTemplate> {
    return apiRequest<DataTemplate>(`/api/v1/test-data/templates/${templateId}`);
  },

  async create(template: DataTemplateCreate): Promise<DataTemplate> {
    return apiRequest<DataTemplate>('/api/v1/test-data/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  },

  async update(templateId: string, updates: Partial<DataTemplateCreate>): Promise<DataTemplate> {
    return apiRequest<DataTemplate>(`/api/v1/test-data/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(templateId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/test-data/templates/${templateId}`, {
      method: 'DELETE',
    });
  },

  async getLibrary(): Promise<Record<string, any>> {
    return apiRequest<Record<string, any>>('/api/v1/test-data/templates/library/list');
  },

  async getCategories(): Promise<string[]> {
    return apiRequest<string[]>('/api/v1/test-data/categories');
  },
};

// ============ Data Sets Service ============

export const dataSetsService = {
  async list(templateId?: string, tags?: string): Promise<DataSet[]> {
    const params = new URLSearchParams();
    if (templateId) params.append('template_id', templateId);
    if (tags) params.append('tags', tags);
    return apiRequest<DataSet[]>(`/api/v1/test-data/data-sets?${params}`);
  },

  async get(dataSetId: string): Promise<DataSet> {
    return apiRequest<DataSet>(`/api/v1/test-data/data-sets/${dataSetId}`);
  },

  async create(dataSet: DataSetCreate): Promise<DataSet> {
    return apiRequest<DataSet>('/api/v1/test-data/data-sets', {
      method: 'POST',
      body: JSON.stringify(dataSet),
    });
  },

  async update(dataSetId: string, updates: Partial<DataSetCreate>): Promise<DataSet> {
    return apiRequest<DataSet>(`/api/v1/test-data/data-sets/${dataSetId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(dataSetId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/test-data/data-sets/${dataSetId}`, {
      method: 'DELETE',
    });
  },
};

// ============ Test Data Setups Service ============

export const testDataSetupsService = {
  async list(filters?: { project_id?: string; template_id?: string; is_active?: boolean }): Promise<TestDataSetup[]> {
    const params = new URLSearchParams();
    if (filters?.project_id) params.append('project_id', filters.project_id);
    if (filters?.template_id) params.append('template_id', filters.template_id);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    return apiRequest<TestDataSetup[]>(`/api/v1/test-data/setups?${params}`);
  },

  async get(setupId: string): Promise<TestDataSetup> {
    return apiRequest<TestDataSetup>(`/api/v1/test-data/setups/${setupId}`);
  },

  async create(setup: TestDataSetupCreate): Promise<TestDataSetup> {
    return apiRequest<TestDataSetup>('/api/v1/test-data/setups', {
      method: 'POST',
      body: JSON.stringify(setup),
    });
  },

  async update(setupId: string, updates: Partial<TestDataSetupCreate>): Promise<TestDataSetup> {
    return apiRequest<TestDataSetup>(`/api/v1/test-data/setups/${setupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(setupId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/test-data/setups/${setupId}`, {
      method: 'DELETE',
    });
  },
};

// ============ Prompt Links Service ============

export const promptSetupsService = {
  async getForPrompt(promptId: string): Promise<PromptSetupLink[]> {
    return apiRequest<PromptSetupLink[]>(`/api/v1/test-data/prompts/${promptId}/setups`);
  },

  async link(promptId: string, setupId: string, executionOrder: number = 0): Promise<PromptSetupLink> {
    return apiRequest<PromptSetupLink>(`/api/v1/test-data/prompts/${promptId}/setups`, {
      method: 'POST',
      body: JSON.stringify({
        prompt_id: promptId,
        setup_id: setupId,
        execution_order: executionOrder,
        is_active: true,
      }),
    });
  },

  async unlink(promptId: string, setupId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/test-data/prompts/${promptId}/setups/${setupId}`, {
      method: 'DELETE',
    });
  },
};

// ============ Execution Service ============

export const testDataExecutionService = {
  async execute(request: {
    prompt_id?: string;
    setup_id?: string;
    setup_ids?: string[];
    variable_overrides?: Record<string, any>;
    dry_run?: boolean;
  }): Promise<ExecuteSetupsResponse> {
    return apiRequest<ExecuteSetupsResponse>('/api/v1/test-data/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async dryRun(request: {
    prompt_id?: string;
    setup_id?: string;
    setup_ids?: string[];
    variable_overrides?: Record<string, any>;
  }): Promise<ExecuteSetupsResponse> {
    return apiRequest<ExecuteSetupsResponse>('/api/v1/test-data/execute/dry-run', {
      method: 'POST',
      body: JSON.stringify({ ...request, dry_run: true }),
    });
  },

  async getHistory(filters?: {
    setup_id?: string;
    template_id?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ExecutionHistoryItem[]> {
    const params = new URLSearchParams();
    if (filters?.setup_id) params.append('setup_id', filters.setup_id);
    if (filters?.template_id) params.append('template_id', filters.template_id);
    if (filters?.success !== undefined) params.append('success', String(filters.success));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));
    return apiRequest<ExecutionHistoryItem[]>(`/api/v1/test-data/history?${params}`);
  },

  async getHistoryDetail(historyId: string): Promise<ExecutionHistoryItem> {
    return apiRequest<ExecutionHistoryItem>(`/api/v1/test-data/history/${historyId}`);
  },
};

// ============ Combined Export ============

const apiTestDataService = {
  endpoints: apiEndpointsService,
  templates: dataTemplatesService,
  dataSets: dataSetsService,
  setups: testDataSetupsService,
  promptSetups: promptSetupsService,
  execution: testDataExecutionService,
};

export default apiTestDataService;
