import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MCPProvider } from './contexts/MCPContext';
import StyledThemeWrapper from './shared/ui/StyledThemeWrapper';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import { AppRoutes } from "./app/routes";
import GlobalSidebar from "./shared/ui/GlobalSidebar";
import "./styles/index.css";
import "./styles/App.css";
// Main app layout for authenticated users
const AuthenticatedApp: React.FC = () => {
  const location = useLocation();
  const appStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'transparent'
  };
  const mainStyle: React.CSSProperties = {
    flex: 1,
    marginLeft: '250px', // Account for sidebar width
    padding: '0',
    width: 'calc(100% - 250px)',
    backgroundColor: 'transparent'
  };
  // Mobile responsive styles
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    mainStyle.marginLeft = '0';
    mainStyle.width = '100%';
  }
  return (
    <StyledThemeWrapper>
      <div style={appStyle}>
        <GlobalSidebar />
        <main style={mainStyle}>
          <AppRoutes key={location.pathname} />
        </main>
      </div>
    </StyledThemeWrapper>
  );
};
// Main App component
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MCPProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Protected routes - all under one protected wrapper */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AuthenticatedApp />
              </ProtectedRoute>
            } />
          </Routes>
        </MCPProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}