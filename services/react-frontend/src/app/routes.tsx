import { Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import SubscriptionGate from "../components/auth/SubscriptionGate";
import ElementReviewPage from "../features/review/components/ElementReviewPage";
import ReviewQueue from "../features/review/components/ReviewQueue";
import MCPElementsViewer from "../features/elements/components/MCPElementsViewer";
import AnalyticsTrendWidgets from "../features/analytics/components/AnalyticsTrendWidgets";
import AIInsightsDashboard from "../features/insights/components/AIInsightsDashboard";
import EnhancedAIInsightsDashboard from "../features/insights/components/EnhancedAIInsightsDashboard";
import HealingSuccessVisualization from "../features/healing/components/HealingSuccessVisualization";
import { PolicyDashboard } from "../features/policy";
import PolicyEngine from "../features/policy/components/PolicyEngine";
import { PromptsTable } from "../features/prompts";
import { PromptDetailView } from "../features/prompts/components/PromptDetailView";
import { PageContextManager } from "../features/page-context";
import { ExecutionDashboard } from "../features/execution";
import { DashboardAnalytics } from "../components/DashboardAnalytics";
import RunDetails from "../features/execution/components/RunDetails";
import SyncBidirectionalTest from "../features/sync/SyncBidirectionalTest"
import SyncDebugger from "../shared/components/SyncDebugger";
import ChromeExtensionPage from "../features/extension/components/ChromeExtensionPage";
import OrganizationSettings from "../features/organization/OrganizationSettings";
import { OnboardingPage } from "../features/onboarding";
import { TestSuitesView } from "../features/test-suites/components/TestSuitesView";
import { TestSuiteDetailView } from "../features/test-suites/components/TestSuiteDetailView";
import { DocumentToTestsPage } from "../features/document-to-tests";
import { ApiTestDataPage } from "../features/api-test-data";
import { RunnersPage } from "../features/runners";

/**
 * Route guard: redirects unauthenticated users to /onboarding.
 */
function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <SubscriptionGate>{children}</SubscriptionGate> : <Navigate to="/onboarding" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Protected routes */}
      <Route path="/" element={<PrivateRoute><ExecutionDashboard /></PrivateRoute>} />
      <Route path="/elements" element={<PrivateRoute><MCPElementsViewer /></PrivateRoute>} />
      <Route path="/review" element={<PrivateRoute><ReviewQueue /></PrivateRoute>} />
      <Route path="/review/:id" element={<PrivateRoute><ElementReviewPage /></PrivateRoute>} />
      <Route path="/policy" element={<PrivateRoute><PolicyDashboard /></PrivateRoute>} />
      <Route path="/policy-engine" element={<PrivateRoute><PolicyEngine /></PrivateRoute>} />
      <Route path="/prompts" element={<PrivateRoute><PromptsTable /></PrivateRoute>} />
      <Route path="/prompts/:id" element={<PrivateRoute><PromptDetailView /></PrivateRoute>} />
      <Route path="/page-context" element={<PrivateRoute><PageContextManager /></PrivateRoute>} />
      <Route path="/test-suites" element={<PrivateRoute><TestSuitesView /></PrivateRoute>} />
      <Route path="/test-suites/:suiteId" element={<PrivateRoute><TestSuiteDetailView /></PrivateRoute>} />
      <Route path="/organization" element={<PrivateRoute><OrganizationSettings /></PrivateRoute>} />
      <Route path="/execution" element={<PrivateRoute><ExecutionDashboard /></PrivateRoute>} />
      <Route path="/execution-dashboard" element={<PrivateRoute><ExecutionDashboard /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><DashboardAnalytics /></PrivateRoute>} />
      <Route path="/analytics/trends" element={<PrivateRoute><AnalyticsTrendWidgets /></PrivateRoute>} />
      <Route path="/analytics/ai-insights" element={<PrivateRoute><EnhancedAIInsightsDashboard /></PrivateRoute>} />
      <Route path="/analytics/ai-insights-basic" element={<PrivateRoute><AIInsightsDashboard /></PrivateRoute>} />
      <Route path="/analytics/healing-success" element={<PrivateRoute><HealingSuccessVisualization /></PrivateRoute>} />
      <Route path="/dashboard-analytics" element={<PrivateRoute><DashboardAnalytics /></PrivateRoute>} />
      <Route path="/execution/:executionId" element={<PrivateRoute><RunDetails /></PrivateRoute>} />
      <Route path="/sync-test" element={<PrivateRoute><SyncBidirectionalTest /></PrivateRoute>} />
      <Route path="/sync-debug" element={<PrivateRoute><SyncDebugger /></PrivateRoute>} />
      <Route path="/chrome-extension" element={<PrivateRoute><ChromeExtensionPage /></PrivateRoute>} />
      <Route path="/document-to-tests" element={<PrivateRoute><DocumentToTestsPage /></PrivateRoute>} />
      <Route path="/api-test-data" element={<PrivateRoute><ApiTestDataPage /></PrivateRoute>} />
      <Route path="/runners" element={<PrivateRoute><RunnersPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  );
}