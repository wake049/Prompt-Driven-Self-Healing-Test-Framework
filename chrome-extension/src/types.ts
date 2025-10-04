// Type definitions for MCP-style tools
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCallRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface MCPToolListRequest {
  method: 'tools/list';
}

export interface MCPResponse<T = any> {
  success: boolean;
  result?: T;
  error?: {
    code: string;
    message: string;
    data?: any;
  };
}

// Tool execution types
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}

// DOM Action types
export interface UIClickAction {
  type: 'ui.click';
  elementId: string;
  options?: {
    button?: 'left' | 'right' | 'middle';
    modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  };
}

export interface UITypeAction {
  type: 'ui.type';
  elementId: string;
  text: string;
  options?: {
    clear?: boolean;
    delay?: number;
  };
}

export type UIAction = UIClickAction | UITypeAction;

// Element Repository types
export interface ElementData {
  tag: string;
  text?: string;
  attributes: Record<string, string>;
  selectors: string[];
  page?: string;
  lastUpdated: number;
}

export interface ElementRepository {
  [elementId: string]: ElementData;
}

// Verification types
export interface VerificationCheck {
  type: 'exists' | 'visible' | 'text' | 'attribute' | 'count';
  elementId?: string;
  selector?: string;
  expected?: any;
  description: string;
}

export interface VerificationPreset {
  name: string;
  description: string;
  checks: VerificationCheck[];
}

// Context types
export interface ContextValue {
  value: any;
  timestamp: number;
  type?: string;
}

export interface ContextStore {
  [key: string]: ContextValue;
}

// Recorder types
export interface RecordedElement {
  id?: string;
  tag: string;
  text?: string;
  attributes: Record<string, string>;
  xpath: string;
  cssSelector: string;
  position: { x: number; y: number };
  suggestedIds: string[];
  selectors?: string[];
  page?: string;
  aiSuggested?: boolean;
}

// Message types for communication between scripts
export interface ContentScriptMessage {
  type: 'EXECUTE_ACTION' | 'GET_ELEMENT_DATA' | 'START_RECORDING' | 'STOP_RECORDING' | 'RECORD_ELEMENT';
  payload?: any;
  requestId?: string;
}

export interface BackgroundMessage {
  type: 'TOOL_CALL' | 'TOOL_LIST' | 'ACTION_RESULT' | 'RECORDING_DATA';
  payload?: any;
  requestId?: string;
}