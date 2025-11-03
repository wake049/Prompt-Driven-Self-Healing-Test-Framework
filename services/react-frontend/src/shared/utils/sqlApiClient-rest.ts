/**
 * API Client for React Frontend to communicate with SQL Backend
 */
const API_BASE_URL = import.meta.env.VITE_SQL_API_URL || 'http://localhost:8000/api/v1';
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
  executed_at: string;
  execution_time_ms?: number;
  page?: string;
  session_name?: string;
  recorded_element_id?: string;
  element_tag?: string;
}
class SqlApiClient {
  private baseUrl: string;
  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {throw error;
    }
  }
  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
  // Test Sessions
  async getAllSessions(): Promise<ApiResponse<TestSession[]>> {
    return this.request('/sessions');
  }
  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    return this.request(`/sessions/${sessionId}`);
  }
  async createSession(sessionData: {
    name: string;
    page?: string;
    description?: string;
  }): Promise<ApiResponse<TestSession>> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }
  async updateSession(sessionId: string, updates: Partial<TestSession>): Promise<ApiResponse<TestSession>> {
    return this.request(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  async deleteSession(sessionId: string): Promise<ApiResponse> {
    return this.request(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }
  // Recorded Elements
  async getAllElements(filters: {
    session_id?: string;
    page?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse<RecordedElementDB[]>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    return this.request(`/elements?${params}`);
  }
  async getElementById(elementId: string): Promise<ApiResponse<RecordedElementDB>> {
    return this.request(`/elements/${elementId}`);
  }
  async createElement(elementData: {
    session_id?: string;
    logical_key: string; // Updated to match simplified schema
    tag: string;
    text_content?: string;
    attributes?: Record<string, any>;
    xpath?: string;
    css_selector?: string;
    position_x?: number;
    position_y?: number;
    selectors?: string[];
    page?: string;
  }): Promise<ApiResponse<RecordedElementDB>> {
    return this.request('/elements', {
      method: 'POST',
      body: JSON.stringify(elementData),
    });
  }
  async updateElement(elementId: string, updates: Partial<RecordedElementDB>): Promise<ApiResponse<RecordedElementDB>> {
    return this.request(`/elements/${elementId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  async deleteElement(elementId: string): Promise<ApiResponse> {
    return this.request(`/elements/${elementId}`, {
      method: 'DELETE',
    });
  }
  // Test Executions
  async getAllExecutions(filters: {
    session_id?: string;
    element_id?: string;
    tool_name?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse<TestExecutionDB[]>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    return this.request(`/executions?${params}`);
  }
  async getExecutionStats(): Promise<ApiResponse<{
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    avg_execution_time: number;
    unique_tools: number;
    sessions_with_executions: number;
  }>> {
    return this.request('/executions/stats/summary');
  }
  async createExecution(executionData: {
    session_id?: string;
    element_id?: string;
    tool_name: string;
    parameters?: Record<string, any>;
    result_success?: boolean;
    result_data?: any;
    result_error?: string;
    result_logs?: string[];
    execution_time_ms?: number;
    page?: string;
  }): Promise<ApiResponse<TestExecutionDB>> {
    return this.request('/executions', {
      method: 'POST',
      body: JSON.stringify(executionData),
    });
  }
  // Helper method to extract tag from element data
  private extractTagFromElement(dbElement: RecordedElementDB): string {
    // First try to parse the primary_selector JSON to get tag info
    if (dbElement.primary_selector) {
      try {
        const selectorData = typeof dbElement.primary_selector === 'string' 
          ? JSON.parse(dbElement.primary_selector) 
          : dbElement.primary_selector;
        if (selectorData.tag && selectorData.tag !== 'unknown') {
          return selectorData.tag;
        }
      } catch (e) {
      }
    } 
    // Try the direct tag field (skip if it's "unknown")
    if (dbElement.tag && dbElement.tag !== 'unknown') {
      return dbElement.tag;
    }
    // Extract from XPath - look for the LAST tag in the path since that's the actual element
    if (dbElement.xpath) {
      // Fix the regex to properly match XPath patterns
      // Pattern like: //a[@id="item_5_title_link"] or //a[@id="item_5_title_link"]//div
      const xpathTagMatches = dbElement.xpath.match(/\/\/([a-zA-Z][a-zA-Z0-9]*)/g);
      if (xpathTagMatches && xpathTagMatches.length > 0) {
        // Get the last tag in the XPath (the actual target element)
        const lastMatch = xpathTagMatches[xpathTagMatches.length - 1];
        const tagMatch = lastMatch.match(/\/\/([a-zA-Z][a-zA-Z0-9]*)/);
        if (tagMatch && tagMatch[1]) {
          return tagMatch[1];
        }
      }
      // Also try single tag patterns like //div, //button, etc.
      const singleTagMatch = dbElement.xpath.match(/^\/\/([a-zA-Z][a-zA-Z0-9]*)(\[|$)/);
      if (singleTagMatch && singleTagMatch[1]) {
        return singleTagMatch[1];
      }
    }
    // Try to extract from CSS selector
    if (dbElement.css_selector) {
      const cssTagMatch = dbElement.css_selector.match(/^(\w+)/);
      if (cssTagMatch && cssTagMatch[1]) {
        return cssTagMatch[1];
      }
    }
    // Try to extract from any selector patterns
    const xpath = dbElement.xpath || '';
    const cssSelector = dbElement.css_selector || '';
    // Look for specific tag patterns in selectors
    if (xpath.includes('//button') || cssSelector.includes('button')) return 'button';
    if (xpath.includes('//input') || cssSelector.includes('input')) return 'input';
    if (xpath.includes('//span') || cssSelector.includes('span')) return 'span';
    if (xpath.includes('//div') || cssSelector.includes('div')) return 'div';
    if (xpath.includes('//a') || cssSelector.includes('a.') || cssSelector.includes('a#')) return 'a';
    if (xpath.includes('//form') || cssSelector.includes('form')) return 'form';
    if (xpath.includes('//table') || cssSelector.includes('table')) return 'table';
    if (xpath.includes('//tr') || cssSelector.includes('tr')) return 'tr';
    if (xpath.includes('//td') || cssSelector.includes('td')) return 'td';
    if (xpath.includes('//li') || cssSelector.includes('li')) return 'li';
    if (xpath.includes('//ul') || cssSelector.includes('ul')) return 'ul';
    if (xpath.includes('//p') || cssSelector.includes('p')) return 'p';
    if (xpath.includes('//h1') || cssSelector.includes('h1')) return 'h1';
    if (xpath.includes('//h2') || cssSelector.includes('h2')) return 'h2';
    if (xpath.includes('//h3') || cssSelector.includes('h3')) return 'h3';
    // Fallback to 'div' as it's the most common
    return 'div';
  }
  // Helper method to generate CSS selector from XPath when css_selector is empty
  private generateCssSelectorFromXPath(xpath: string): string {
    if (!xpath) return '';
    // Handle complex XPath with ID reference like //*[@id="item_5_title_link"]//div
    const complexIdMatch = xpath.match(/\/\/\*\[@id\s*=\s*["']([^"']+)["']\]\/\/(\w+)/);
    if (complexIdMatch) {
      const id = complexIdMatch[1];
      const tag = complexIdMatch[2];
      return `#${id} ${tag}`;
    }
    // Handle simple ID-based XPath like: //a[@id="item_2_img_link"]
    const idMatch = xpath.match(/\/\/(\w+)\[@id\s*=\s*["']([^"']+)["']\]/);
    if (idMatch) {
      const tag = idMatch[1];
      const id = idMatch[2];
      return `${tag}#${id}`;
    }
    // Handle class-based XPath like: //div[@class="some-class"]
    const classMatch = xpath.match(/\/\/(\w+)\[@class\s*=\s*["']([^"']+)["']\]/);
    if (classMatch) {
      const tag = classMatch[1];
      const className = classMatch[2].split(' ')[0]; // Take first class if multiple
      return `${tag}.${className}`;
    }
    // Handle name attribute: //input[@name="username"]
    const nameMatch = xpath.match(/\/\/(\w+)\[@name\s*=\s*["']([^"']+)["']\]/);
    if (nameMatch) {
      const tag = nameMatch[1];
      const name = nameMatch[2];
      return `${tag}[name="${name}"]`;
    }
    // Handle simple tag: //div, //button, etc.
    const tagMatch = xpath.match(/^\/\/(\w+)$/);
    if (tagMatch) {
      return tagMatch[1];
    }
    // Fallback: just return the tag if we can extract it
    const generalTagMatch = xpath.match(/\/\/(\w+)/);
    if (generalTagMatch) {
      return generalTagMatch[1];
    }
    return '';
  }
  // Convert database format to frontend format
  convertElementToFrontend(dbElement: RecordedElementDB): RecordedElement {
    // Parse attributes if it's a string
    let parsedAttributes = {};
    try {
      if (typeof dbElement.attributes === 'string') {
        parsedAttributes = JSON.parse(dbElement.attributes);
      } else if (typeof dbElement.attributes === 'object' && dbElement.attributes !== null) {
        parsedAttributes = dbElement.attributes;
      }
    } catch (e) {
      parsedAttributes = {};
    }
    // Filter out recording-related attributes and classes
    const cleanAttributes = this.filterRecordingAttributes(parsedAttributes);
    // Extract proper tag information
    const extractedTag = this.extractTagFromElement(dbElement);
    // Extract CSS selector from primary_selector JSON if available, otherwise generate from XPath
    let cssSelector = '';
    if (dbElement.primary_selector) {
      try {
        const selectorData = typeof dbElement.primary_selector === 'string' 
          ? JSON.parse(dbElement.primary_selector) 
          : dbElement.primary_selector;
        if (selectorData && selectorData.css_selector) {
          cssSelector = selectorData.css_selector;
        }
      } catch (e) {
      }
    }
    // Fallback to generating CSS selector from XPath if not found in primary_selector
    if (!cssSelector) {
      cssSelector = this.generateCssSelectorFromXPath(dbElement.xpath || '');
    }
    return {
      id: dbElement.logical_key, // User-friendly ID (now using logical_key from simplified schema)
      dbId: dbElement.id, // Database UUID for API operations
      tag: extractedTag,
      text: dbElement.text_content,
      attributes: cleanAttributes,
      xpath: dbElement.xpath || '',
      cssSelector: cssSelector,
      position: { x: dbElement.position_x, y: dbElement.position_y },
      selectors: Array.isArray(dbElement.selectors) ? dbElement.selectors : [],
      page: dbElement.page,
      timestamp: new Date(dbElement.timestamp_recorded).getTime(),
    };
  }
  // Helper method to filter out recording-related attributes
  private filterRecordingAttributes(attributes: Record<string, any>): Record<string, any> {
    const filtered = { ...attributes };
    // Remove MCP recording-related attributes
    delete filtered['mcp-hover-highlight'];
    delete filtered['mcp-recorded-highlight'];
    delete filtered['mcp-element-id'];
    delete filtered['mcp-recorded'];
    // Clean up class attribute to remove MCP-related classes
    if (filtered.class && typeof filtered.class === 'string') {
      const classes = filtered.class.split(' ').filter(cls => 
        !cls.startsWith('mcp-') && 
        cls !== 'mcp-hover-highlight' && 
        cls !== 'mcp-recorded-highlight'
      );
      if (classes.length > 0) {
        filtered.class = classes.join(' ');
      } else {
        delete filtered.class;
      }
    }
    return filtered;
  }
  convertExecutionToFrontend(dbExecution: TestExecutionDB): TestExecution {
    return {
      id: dbExecution.id,
      toolName: dbExecution.tool_name,
      parameters: dbExecution.parameters || {},
      result: {
        success: dbExecution.result_success || false,
        data: dbExecution.result_data,
        error: dbExecution.result_error,
        logs: dbExecution.result_logs || [],
      },
      timestamp: new Date(dbExecution.executed_at).getTime(),
      page: dbExecution.page,
    };
  }
  convertSessionToFrontend(dbSession: TestSession): MCPTestSession {
    return {
      id: dbSession.id,
      name: dbSession.name,
      page: dbSession.page || '',
      elements: dbSession.elements?.map(el => this.convertElementToFrontend(el)) || [],
      executions: dbSession.executions?.map(ex => this.convertExecutionToFrontend(ex)) || [],
      createdAt: new Date(dbSession.created_at).getTime(),
      updatedAt: new Date(dbSession.updated_at).getTime(),
    };
  }
}
// Frontend interfaces (from original component)
interface RecordedElement {
  id: string; // This is the logical_key (user-friendly, like "password")
  dbId?: string; // This is the database UUID for API operations
  tag: string;
  text?: string;
  attributes: Record<string, string>;
  xpath: string;
  cssSelector: string;
  position: { x: number; y: number };
  selectors?: string[];
  page?: string;
  timestamp: number;
}
interface TestExecution {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  result: {
    success: boolean;
    data?: any;
    error?: string;
    logs?: string[];
  };
  timestamp: number;
  page?: string;
}
interface MCPTestSession {
  id: string;
  name: string;
  page: string;
  elements: RecordedElement[];
  executions: TestExecution[];
  createdAt: number;
  updatedAt: number;
}
// Create singleton instance
const sqlApiClient = new SqlApiClient();
export default sqlApiClient;
export { SqlApiClient };
export type { 
  RecordedElement, 
  TestExecution, 
  MCPTestSession, 
  RecordedElementDB, 
  TestExecutionDB, 
  TestSession 
};