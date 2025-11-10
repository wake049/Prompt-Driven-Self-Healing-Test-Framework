import { Routes, Route, Navigate } from "react-router-dom";
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
<<<<<<< Updated upstream

=======
import { DashboardAnalytics } from "../components/DashboardAnalytics";
import RunDetails from "../features/execution/components/RunDetails";
import SyncBidirectionalTest from "../features/sync/components/SyncBidirectionalTest";
import SyncDebugger from "../shared/components/SyncDebugger";
import ChromeExtensionPage from "../features/extension/components/ChromeExtensionPage";
>>>>>>> Stashed changes
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ExecutionDashboard />} />
      <Route path="/elements" element={<MCPElementsViewer />} />
      <Route path="/review" element={<ReviewQueue />} />
      <Route path="/review/:id" element={<ElementReviewPage />} />
      <Route path="/policy" element={<PolicyDashboard />} />
      <Route path="/policy-engine" element={<PolicyEngine />} />
      <Route path="/prompts" element={<PromptsTable />} />
      <Route path="/prompts/:id" element={<PromptDetailView />} />
      <Route path="/page-context" element={<PageContextManager />} />
      <Route path="/execution" element={<ExecutionDashboard />} />
<<<<<<< Updated upstream
=======
      <Route path="/execution-dashboard" element={<ExecutionDashboard />} />
      <Route path="/analytics" element={<DashboardAnalytics />} />
      <Route path="/analytics/trends" element={<AnalyticsTrendWidgets />} />
      <Route path="/analytics/ai-insights" element={<EnhancedAIInsightsDashboard />} />
      <Route path="/analytics/ai-insights-basic" element={<AIInsightsDashboard />} />
      <Route path="/analytics/healing-success" element={<HealingSuccessVisualization />} />
      <Route path="/dashboard-analytics" element={<DashboardAnalytics />} />
      <Route path="/execution/:executionId" element={<RunDetails />} />
      <Route path="/sync-test" element={<SyncBidirectionalTest />} />
      <Route path="/sync-debug" element={<SyncDebugger />} />
      <Route path="/chrome-extension" element={<ChromeExtensionPage />} />
>>>>>>> Stashed changes
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}