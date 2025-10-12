interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // add more vars here as needed
  readonly VITE_OTHER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}