import { Routes, Route, Navigate } from "react-router-dom";
import ElementReviewPage from "../features/review/components/ElementReviewPage";
import MCPElementsViewer from "../features/elements/components/MCPElementsViewer";
import { PolicyDashboard } from "../features/policy";
import PolicyEngine from "../features/policy/components/PolicyEngine";
import { PromptsTable } from "../features/prompts";
import { PromptDetailView } from "../features/prompts/components/PromptDetailView";
import { PageContextManager } from "../features/page-context";
import { ExecutionDashboard } from "../features/execution";

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}