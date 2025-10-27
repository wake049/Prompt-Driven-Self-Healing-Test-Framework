export interface PageContext {
  id: string;
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  screenshotUrl?: string;
  screenshotFilename?: string;
  primaryActions: string[];
  testingFocus?: string;
  userNotes?: string;
  createdAt: string;
  createdBy?: string;
  usageCount: number;
  userUploaded: boolean;
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