import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { config } from '../app/config';

// Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  project: Project | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, password: string, full_name: string, terms_accepted: boolean, invitation_token?: string) => Promise<{ success: boolean; token?: string }>;
  registerOrganization: (email: string, password: string, full_name: string, organization_name: string, terms_accepted: boolean, organization_slug?: string) => Promise<boolean>;
  error: string | null;
  clearError: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatApiError = (errorPayload: any, fallback: string): string => {
    if (!errorPayload) return fallback;

    if (typeof errorPayload === 'string') {
      return errorPayload;
    }

    if (Array.isArray(errorPayload)) {
      const messages = errorPayload
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && typeof item.msg === 'string') return item.msg;
          return null;
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join('; ');
      }
      return fallback;
    }

    if (typeof errorPayload === 'object') {
      if (typeof errorPayload.detail === 'string') return errorPayload.detail;
      if (Array.isArray(errorPayload.detail)) return formatApiError(errorPayload.detail, fallback);
      if (typeof errorPayload.msg === 'string') return errorPayload.msg;
      return fallback;
    }

    return fallback;
  };

  // Check for existing token on app load
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
          // Check JWT expiration before using stored token
          try {
            const payload = JSON.parse(atob(storedToken.split('.')[1]));
            if (payload.exp && Date.now() / 1000 > payload.exp) {
              // Token expired — clear and require re-login
              localStorage.removeItem('auth_token');
              setIsLoading(false);
              return;
            }
          } catch {
            // Malformed token — clear it
            localStorage.removeItem('auth_token');
            setIsLoading(false);
            return;
          }

          setToken(storedToken);
          try {
            await fetchUserProfile(storedToken);
          } catch (profileError) {
            // Profile fetch failed — clear auth state instead of creating fake user
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthState();
  }, []);

  // Fetch user profile with token
  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        // API returns CurrentUser with { user, tenant, project, permissions }
        setUser(userData.user || userData);
        setTenant(userData.tenant || null);
        setProject(userData.project || null);
      } else if (response.status === 401 || response.status === 403) {
        // Only clear auth state for actual authentication failures
        throw new Error('Authentication failed');
      } else {
        // For other errors (500, network issues, etc.), keep the token but log the error
        // We could set a minimal user object or leave it null but keep the token
        // This allows the app to continue working even if the profile endpoint is down
      }
    } catch (error) {
      
      // Only clear auth state if it's an actual authentication error
      if (error instanceof Error && error.message === 'Authentication failed') {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      }
    }
  };

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const authToken = data.access_token;
        
        // Store token
        localStorage.setItem('auth_token', authToken);
        setToken(authToken);
        
        // Fetch user profile
        await fetchUserProfile(authToken);
        
        return true;
      } else {
        const errorData = await response.json();
        setError(formatApiError(errorData?.detail ?? errorData, 'Login failed'));
        return false;
      }
    } catch (error) {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, full_name: string, terms_accepted: boolean, invitation_token?: string): Promise<{ success: boolean; token?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const body: any = { 
        email, 
        password, 
        confirm_password: password,
        full_name,
        terms_accepted,
      };
      
      if (invitation_token) {
        body.invitation_token = invitation_token;
      }
      
      const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Auto-login after successful registration
        const loginSuccess = await login(email, password);
        if (loginSuccess) {
          // Return the token from localStorage since state may not be updated yet
          const authToken = localStorage.getItem('auth_token');
          return { success: true, token: authToken || undefined };
        }
        // Registration succeeded but auto-login failed — still report success
        // so the UI can redirect to login page
        return { success: true };
      } else {
        const errorData = await response.json();
        setError(formatApiError(errorData?.detail ?? errorData, 'Registration failed'));
        return { success: false };
      }
    } catch (error) {
      setError('Network error. Please try again.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // Register organization function
  const registerOrganization = async (
    email: string, 
    password: string, 
    full_name: string, 
    organization_name: string,
    terms_accepted: boolean,
    organization_slug?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const body: any = { 
        email, 
        password, 
        confirm_password: password,
        full_name,
        organization_name,
        terms_accepted,
      };
      
      if (organization_slug) {
        body.organization_slug = organization_slug;
      }
      
      const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/register/organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Auto-login after successful registration
        return await login(email, password);
      } else {
        const errorData = await response.json();
        setError(formatApiError(errorData?.detail ?? errorData, 'Organization registration failed'));
        return false;
      }
    } catch (error) {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setTenant(null);
    setProject(null);
    setError(null);
  };

  // Clear error function
  const clearError = () => {
    setError(null);
  };

  // Refresh auth function - retry fetching user profile
  const refreshAuth = async () => {
    const currentToken = token || localStorage.getItem('auth_token');
    if (currentToken) {
      try {
        await fetchUserProfile(currentToken);
        setError(null);
      } catch (error) {
        setError('Unable to verify authentication. You may need to log in again.');
      }
    }
  };

  const value: AuthContextType = {
    user,
    tenant,
    project,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    register,
    registerOrganization,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};