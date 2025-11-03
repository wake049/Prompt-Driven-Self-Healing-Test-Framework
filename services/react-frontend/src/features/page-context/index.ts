export { PageContextManager } from './PageContextManager';
export { PageContextUpload } from './PageContextUpload';
export { PageContextList } from './PageContextList';
export { PageContextView } from './PageContextView';
// Types
export interface PageContextItem {
  id: string;
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  screenshotUrl?: string;
  primaryActions: string[];
  testingFocus?: string;
  userNotes?: string;
  createdAt: string;
  createdBy?: string;
  usageCount: number;
}
export interface PageContextFormData {
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  testingFocus: string;
  userNotes: string;
  primaryActions: string[];
  screenshot: File | null;
}