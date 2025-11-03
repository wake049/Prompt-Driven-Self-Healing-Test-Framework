export interface PageContext {
  id?: string;
  pageUrl?: string;
  pageTitle?: string;
  pageType?: string;
  pageDescription?: string;
  primaryActions?: string[];
  screenshotUrl?: string;
  screenshotFilename?: string;
  testingFocus?: string;
  userNotes?: string;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  userUploaded?: boolean;
}
export interface PageContextFormData {
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  testingFocus?: string;
  userNotes?: string;
  primaryActions: string[];
  screenshot: File | null;
}
export interface PageContextUploadResponse {
  success: boolean;
  data: PageContext;
  message: string;
}
export interface PageContextListResponse {
  success: boolean;
  data: PageContext[];
  count: number;
}
export interface SupportedPageType {
  description: string;
  primary_actions: string[];
  example_domains: string[];
}
export interface SupportedPageTypesResponse {
  page_types: Record<string, SupportedPageType>;
}
export interface PageContextExample {
  name: string;
  context: PageContext;
}
export interface PageContextExamplesResponse {
  examples: PageContextExample[];
}