import { Routes, Route, Navigate } from "react-router-dom";
import ElementReviewPage from "../features/review/components/ElementReviewPage";
import MCPElementsViewer from "../features/elements/components/MCPElementsViewer";
import { PolicyDashboard } from "../features/policy";
import PolicyEngine from "../features/policy/components/PolicyEngine";
import { PromptsTable } from "../features/prompts";
import { PromptDetailView } from "../features/prompts/components/PromptDetailView";
import { PageContextManager } from "../features/page-context";
import { ExecutionDashboard } from "../features/execution";
import { DashboardAnalytics } from "../components/DashboardAnalytics";
import RunDetails from "../features/execution/components/RunDetails";
import SyncBidirectionalTest from "../features/sync/components/SyncBidirectionalTest";
import SyncDebugger from "../shared/components/SyncDebugger";
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ExecutionDashboard />} />
      <Route path="/elements" element={<MCPElementsViewer />} />
      <Route path="/review/:id" element={<ElementReviewPage />} />
      <Route path="/policy" element={<PolicyDashboard />} />
      <Route path="/policy-engine" element={<PolicyEngine />} />
      <Route path="/prompts" element={<PromptsTable />} />
      <Route path="/prompts/:id" element={<PromptDetailView />} />
      <Route path="/page-context" element={<PageContextManager />} />
      <Route path="/execution" element={<ExecutionDashboard />} />
      <Route path="/execution-dashboard" element={<ExecutionDashboard />} />
      <Route path="/analytics" element={<DashboardAnalytics />} />
      <Route path="/dashboard-analytics" element={<DashboardAnalytics />} />
      <Route path="/execution/:executionId" element={<RunDetails />} />
      <Route path="/sync-test" element={<SyncBidirectionalTest />} />
      <Route path="/sync-debug" element={<SyncDebugger />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}