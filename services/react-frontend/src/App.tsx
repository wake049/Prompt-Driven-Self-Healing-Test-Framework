import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import { AppRoutes } from "./app/routes";
import GlobalSidebar from "./shared/ui/GlobalSidebar";
import ChromeExtensionNotification from './shared/ui/ChromeExtensionNotification';
import "./styles/index.css";
import "./styles/App.css";

// Import development utilities
if (process.env.NODE_ENV === 'development') {
  import('./shared/utils/extensionSimulator');
}
// Main app layout for authenticated users
const AuthenticatedApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const appStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#ffffff'
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    marginLeft: '250px', // Account for sidebar width
    padding: '0',
    width: 'calc(100% - 250px)',
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={appStyle}>
      <GlobalSidebar />
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
    <ThemeProvider>
      <AuthProvider>
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
      </AuthProvider>
    </ThemeProvider>
  );
}