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