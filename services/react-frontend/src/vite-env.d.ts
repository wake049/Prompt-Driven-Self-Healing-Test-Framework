interface ImportMetaEnv {
  readonly VITE_UNIFIED_API_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SQL_API_URL?: string;
  readonly VITE_AI_API_URL?: string;
  readonly VITE_HEALING_API_URL?: string;
  readonly VITE_POLICY_API_URL?: string;
  readonly VITE_MCP_SERVER_URL?: string;
  readonly VITE_MCP_AUTH_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}