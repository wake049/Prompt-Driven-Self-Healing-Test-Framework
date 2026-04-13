import React from 'react';
import {
  BookOpen,
  PlayCircle,
  Settings,
  Activity,
  Shield,
  HelpCircle,
  Code2,
  AlertTriangle,
  Globe,
  ClipboardList,
  TrendingUp,
  Package,
  Building2,
  Chrome,
} from 'lucide-react';

export type SectionId =
  | 'quick-start'
  | 'access'
  | 'page-context-elements'
  | 'review-queue'
  | 'executions'
  | 'analytics-insights'
  | 'runner'
  | 'self-healing'
  | 'policies'
  | 'prompts'
  | 'test-suites-data'
  | 'organization'
  | 'chrome-extension'
  | 'api'
  | 'faqs'
  | 'troubleshooting';

export interface SectionConfigItem {
  id: SectionId;
  title: string;
  icon: React.ReactNode;
  keywords: string[];
}

export const SECTION_CONFIG: SectionConfigItem[] = [
  { id: 'quick-start',     title: 'Quick Start',                   icon: <BookOpen size={16} />,      keywords: ['start', 'onboarding', 'setup'] },
  { id: 'access',          title: 'Getting Access',                 icon: <Activity size={16} />,      keywords: ['login', 'auth', 'account', 'access'] },
  { id: 'page-context-elements', title: 'Page Context & Elements',  icon: <Globe size={16} />,         keywords: ['page context', 'elements', 'selectors', 'inventory'] },
  { id: 'review-queue',    title: 'Review Queue Workflow',          icon: <ClipboardList size={16} />, keywords: ['review', 'queue', 'approve', 'reject'] },
  { id: 'executions',      title: 'Executions & Dashboards',        icon: <Activity size={16} />,      keywords: ['dashboard', 'runs', 'metrics', 'execution'] },
  { id: 'analytics-insights', title: 'Analytics & AI Insights',     icon: <TrendingUp size={16} />,    keywords: ['analytics', 'insights', 'trends', 'healing success'] },
  { id: 'runner',          title: 'Runner Setup & Usage',           icon: <PlayCircle size={16} />,    keywords: ['runner', 'browser', 'capacity', 'queue'] },
  { id: 'self-healing',    title: 'Element Review & Self-Healing',  icon: <Settings size={16} />,      keywords: ['healing', 'review', 'selectors', 'elements'] },
  { id: 'policies',        title: 'Policies & Safety Controls',     icon: <Shield size={16} />,        keywords: ['policy', 'safety', 'approval', 'thresholds'] },
  { id: 'prompts',         title: 'Prompt Generation',              icon: <BookOpen size={16} />,      keywords: ['prompt', 'generation', 'nl', 'plan'] },
  { id: 'test-suites-data', title: 'Test Suites & Data Sources',    icon: <Package size={16} />,       keywords: ['suites', 'document to tests', 'api test data', 'datasets'] },
  { id: 'organization',    title: 'Organization & Workspace',        icon: <Building2 size={16} />,     keywords: ['organization', 'workspace', 'roles', 'governance'] },
  { id: 'chrome-extension', title: 'Chrome Extension Integration',   icon: <Chrome size={16} />,        keywords: ['chrome', 'extension', 'capture', 'integration'] },
  { id: 'api',             title: 'API Reference',                  icon: <Code2 size={16} />,         keywords: ['api', 'endpoint', 'request', 'response'] },
  { id: 'faqs',            title: 'FAQs',                           icon: <HelpCircle size={16} />,    keywords: ['faq', 'questions', 'answers'] },
  { id: 'troubleshooting', title: 'Troubleshooting',                icon: <AlertTriangle size={16} />, keywords: ['errors', 'issues', 'debug', 'troubleshoot'] },
];
