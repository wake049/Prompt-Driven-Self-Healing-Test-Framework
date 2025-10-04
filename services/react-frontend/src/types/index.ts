// API Response Types
export interface HealthResponse {
  status: string;
}

export interface PlanAction {
  name: string;
  params: Record<string, any>;
}

export interface TestPlanResponse {
  actions: PlanAction[];
  meta: {
    prompt: string;
    version: string;
    intent?: string;
    timestamp?: string;
  };
}

export interface PromptRequest {
  prompt: string;
}

export interface SystemStats {
  total_intents: number;
  total_templates: number;
  supported_intents: string[];
  template_ids: string[];
  version: string;
}

export interface IntentMappings {
  [intent: string]: string[];
}

export interface ActionTemplate {
  name: string;
  params: Record<string, any>;
}

export interface ActionTemplates {
  [templateId: string]: ActionTemplate[];
}

export interface CatalogResponse {
  templates: ActionTemplates;
  count: number;
}

// API Error Types
export interface ApiError {
  code: string;
  error: string;
}

export interface ApiErrorResponse {
  detail: ApiError | string;
}

// Component Props Types
export interface PromptInputProps {
  onSubmit: (prompt: string) => Promise<void>;
  loading: boolean;
  onClear: () => void;
}

export interface TestPlanDisplayProps {
  testPlan: TestPlanResponse | null;
  loading: boolean;
}

export interface SystemStatsProps {
  stats: SystemStats | null;
  serverHealth: ServerHealth;
  onRefresh: () => void;
}

export interface HeaderProps {
  serverHealth: ServerHealth;
  onRefreshHealth: () => void;
}

// Utility Types
export type ServerHealth = 'online' | 'offline' | 'unknown';

export interface ExamplePrompt {
  id: string;
  text: string;
  category: string;
  description: string;
}

// State Management Types
export interface AppState {
  testPlan: TestPlanResponse | null;
  systemStats: SystemStats | null;
  loading: boolean;
  error: string | null;
  serverHealth: ServerHealth;
}

// Styled Components Theme
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      light: string;
    };
    border: {
      light: string;
      primary: string;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  breakpoints: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
}

// Form Types
export interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

// Enhanced Element Repository Types
export interface Page {
  page_id: string;
  page_key: string;
  title: string;
  url_pattern: string;
  description?: string;
  created_at: string;
  created_by: string;
}

export interface CreatePageRequest {
  page_key: string;
  title: string;
  url_pattern: string;
  description?: string;
}

export interface EnhancedElement {
  element_id: string;
  page_id: string;
  role: string;
  description?: string;
  current_version: number;
  status: 'pending' | 'approved' | 'rejected' | 'deprecated';
  created_at: string;
  created_by: string;
  versions: EnhancedVersion[];
}

export interface EnhancedVersion {
  version: number;
  primary_selector: string;
  alt_selectors: string[];
  confidence_score: number;
  created_at: string;
  created_by: string;
  ai_reasoning?: string;
  status: 'pending' | 'approved' | 'rejected' | 'current';
}

export interface CreateEnhancedElementRequest {
  page_id: string;
  element_id: string;
  role: string;
  primary_selector: string;
  alt_selectors?: string[];
  confidence_score?: number;
  description?: string;
  ai_reasoning?: string;
}

export interface SuggestIDRequest {
  page_id: string;
  role: string;
  node_data: {
    text: string;
    tag: string;
    attributes: Record<string, string>;
  };
}

export interface SuggestedID {
  element_id: string;
  confidence: number;
  reasoning: string;
}

export interface TestSelectorRequest {
  selector: string;
  url: string;
  selector_type?: 'css' | 'xpath';
  timeout_ms?: number;
}

export interface TestSelectorResult {
  found: boolean;
  sample_html?: string;
  error?: string;
  execution_time_ms: number;
}

// Legacy Element Repository Types (kept for backward compatibility)
export interface ElementRecord {
  name: string;
  element_type: string;
  description?: string;
  created_at: string;
  usage_count: number;
  versions: LocatorVersion[];
}

export interface LocatorVersion {
  version: number;
  selector: string;
  confidence: number;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approved_at?: string;
  alternatives: string[];
}

export interface CreateElementRequest {
  name: string;
  element_type: string;
  selector: string;
  description?: string;
  confidence?: number;
  alternatives?: string[];
}

export interface AddVersionRequest {
  element_name: string;
  selector: string;
  confidence?: number;
  alternatives?: string[];
}

export interface ApproveVersionRequest {
  element_name: string;
  version: number;
  approver?: string;
}

export interface SearchElementsRequest {
  query?: string;
  element_type?: string;
  status?: 'pending' | 'approved' | 'rejected';
  limit?: number;
}

export interface RepositoryStats {
  total_elements: number;
  total_versions: number;
  pending_approvals: number;
  cache_hit_rate: number;
  avg_lookup_time_ms: number;
  most_used_elements: Array<{
    name: string;
    usage_count: number;
  }>;
}

// Configuration Types
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
}

export interface AppConfig {
  api: ApiConfig;
  features: {
    syntaxHighlighting: boolean;
    realTimeUpdates: boolean;
    advancedExamples: boolean;
  };
}