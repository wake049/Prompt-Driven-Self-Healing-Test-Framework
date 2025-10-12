import { Routes, Route, Navigate } from "react-router-dom";
import ReviewQueuePage from "../features/review/components/ReviewQueuePage";
import MCPElementsViewer from "../features/elements/components/MCPElementsViewer";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MCPElementsViewer />} />
      <Route path="/review" element={<ReviewQueuePage />} />
      <Route path="*" element={<Navigate to="/review" replace />} />
    </Routes>
  );
}