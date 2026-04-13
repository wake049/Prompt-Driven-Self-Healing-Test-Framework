import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { MCPProvider } from './contexts/MCPContext';
import { ToastProvider } from './shared/ui/Toast';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import { OnboardingPage } from './features/onboarding';
import { AppRoutes } from "./app/routes";
import GlobalSidebar from "./shared/ui/GlobalSidebar";
import ChromeExtensionNotification from './shared/ui/ChromeExtensionNotification';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { LandingPage } from './features/landing/components';
import { AboutPage } from './features/landing/pages/AboutPage';
import { ContactPage } from './features/landing/pages/ContactPage';
import { PrivacyPage } from './features/landing/pages/PrivacyPage';
import { TermsPage } from './features/landing/pages/TermsPage';
import { LicensingPage } from './features/landing/pages/LicensingPage';
import { CookiePolicyPage } from './features/landing/pages/CookiePolicyPage';
import { SecurityPage } from './features/landing/pages/SecurityPage';
import { RoadmapPage } from './features/landing/pages/RoadmapPage';
import { ChangelogPage } from './features/landing/pages/ChangelogPage';
import { DemoVideosPage } from './features/landing/pages/DemoVideosPage';
import DocsLayout from './features/docs/DocsLayout';
import QuickStartSection from './features/docs/sections/QuickStartSection';
import AccessSection from './features/docs/sections/AccessSection';
import PageContextElementsSection from './features/docs/sections/PageContextElementsSection';
import ReviewQueueSection from './features/docs/sections/ReviewQueueSection';
import ExecutionsSection from './features/docs/sections/ExecutionsSection';
import AnalyticsInsightsSection from './features/docs/sections/AnalyticsInsightsSection';
import RunnerSection from './features/docs/sections/RunnerSection';
import SelfHealingSection from './features/docs/sections/SelfHealingSection';
import PoliciesSection from './features/docs/sections/PoliciesSection';
import PromptsSection from './features/docs/sections/PromptsSection';
import TestSuitesDataSection from './features/docs/sections/TestSuitesDataSection';
import OrganizationSection from './features/docs/sections/OrganizationSection';
import ChromeExtensionSection from './features/docs/sections/ChromeExtensionSection';
import ApiSection from './features/docs/sections/ApiSection';
import FaqsSection from './features/docs/sections/FaqsSection';
import TroubleshootingSection from './features/docs/sections/TroubleshootingSection';
import "./styles/index.css";
import "./styles/App.css";
import ErrorBoundary from './components/ErrorBoundary';

// Import development utilities
if (process.env.NODE_ENV === 'development') {
  import('./shared/utils/extensionSimulator');
}

// Wrapper component to bridge custom theme context with styled-components
const StyledThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  return (
    <StyledThemeProvider theme={theme}>
      {children}
    </StyledThemeProvider>
  );
};

// Main app layout for authenticated users
const AuthenticatedApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();
  
  const hideSidebar = location.pathname.startsWith('/app/docs');
  const sidebarWidth = hideSidebar ? 0 : sidebarCollapsed ? 60 : 250;
  
  const appStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#ffffff'
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    marginLeft: hideSidebar ? 0 : `${sidebarWidth}px`,
    padding: '0',
    width: hideSidebar ? '100%' : `calc(100% - ${sidebarWidth}px)`,
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.3s ease, width 0.3s ease'
  };

  return (
    <div style={appStyle}>
      {!hideSidebar && (
        <GlobalSidebar onCollapseChange={setSidebarCollapsed} />
      )}
      <main style={mainStyle}>
        <ChromeExtensionNotification onNavigate={navigate} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <AppRoutes key={location.pathname} />
        </div>
      </main>
    </div>
  );
};

// Main App component
export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <StyledThemeWrapper>
        <ToastProvider>
          <MCPProvider autoConnect={false}>
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/licensing" element={<LicensingPage />} />
                <Route path="/cookies" element={<CookiePolicyPage />} />
                <Route path="/security" element={<SecurityPage />} />
                <Route path="/roadmap" element={<RoadmapPage />} />
                <Route path="/changelog" element={<ChangelogPage />} />
                <Route path="/demo-videos" element={<DemoVideosPage />} />
                <Route path="/docs" element={<DocsLayout />}>
                  <Route index element={<Navigate to="quick-start" replace />} />
                  <Route path="quick-start" element={<QuickStartSection />} />
                  <Route path="access" element={<AccessSection />} />
                  <Route path="page-context-elements" element={<PageContextElementsSection />} />
                  <Route path="review-queue" element={<ReviewQueueSection />} />
                  <Route path="executions" element={<ExecutionsSection />} />
                  <Route path="analytics-insights" element={<AnalyticsInsightsSection />} />
                  <Route path="runner" element={<RunnerSection />} />
                  <Route path="self-healing" element={<SelfHealingSection />} />
                  <Route path="policies" element={<PoliciesSection />} />
                  <Route path="prompts" element={<PromptsSection />} />
                  <Route path="test-suites-data" element={<TestSuitesDataSection />} />
                  <Route path="organization" element={<OrganizationSection />} />
                  <Route path="chrome-extension" element={<ChromeExtensionSection />} />
                  <Route path="api" element={<ApiSection />} />
                  <Route path="faqs" element={<FaqsSection />} />
                  <Route path="troubleshooting" element={<TroubleshootingSection />} />
                </Route>
                <Route path="/app/docs" element={<Navigate to="/docs" replace />} />
                
                {/* Protected routes - all under one protected wrapper */}
                <Route path="/app/*" element={
                  <ProtectedRoute>
                    <AuthenticatedApp />
                  </ProtectedRoute>
                } />
              </Routes>
            </AuthProvider>
          </MCPProvider>
        </ToastProvider>
      </StyledThemeWrapper>
    </ThemeProvider>
    </ErrorBoundary>
  );
}