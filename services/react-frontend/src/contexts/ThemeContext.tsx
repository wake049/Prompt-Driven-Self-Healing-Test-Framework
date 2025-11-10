import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  hover: string;
  activeBackground: string;
}
interface Theme {
  colors: ThemeColors;
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
  };
  mode: 'light' | 'dark';
}
const lightTheme: Theme = {
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    surface: '#ffffff',
    text: '#1a202c',
    textSecondary: '#718096',
    border: '#e2e8f0',
    success: '#38a169',
    warning: '#ed8936',
    error: '#e53e3e',
    info: '#3182ce',
    hover: '#f7fafc',
    activeBackground: '#edf2f7',
  },
  shadows: {
    small: '0 2px 8px rgba(0, 0, 0, 0.1)',
    medium: '0 8px 32px rgba(0, 0, 0, 0.1)',
    large: '0 12px 40px rgba(0, 0, 0, 0.15)',
  },
  borderRadius: {
    small: '8px',
    medium: '12px',
    large: '16px',
  },
  mode: 'light',
};
const darkTheme: Theme = {
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
    surface: '#2d3748',
    text: '#f7fafc',
    textSecondary: '#a0aec0',
    border: '#4a5568',
    success: '#68d391',
    warning: '#fbd38d',
    error: '#fc8181',
    info: '#63b3ed',
    hover: '#4a5568',
    activeBackground: '#1a202c',
  },
  shadows: {
    small: '0 2px 8px rgba(0, 0, 0, 0.3)',
    medium: '0 8px 32px rgba(0, 0, 0, 0.3)',
    large: '0 12px 40px rgba(0, 0, 0, 0.4)',
  },
  borderRadius: {
    small: '8px',
    medium: '12px',
    large: '16px',
  },
  mode: 'dark',
};
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
interface ThemeProviderProps {
  children: ReactNode;
}
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  const theme = isDark ? darkTheme : lightTheme;
  const toggleTheme = () => {
    setIsDark(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };
  useEffect(() => {
    // Apply theme to document body
    document.body.style.background = theme.colors.background;
    document.body.style.color = theme.colors.text;
    document.body.style.transition = 'background 0.3s ease, color 0.3s ease';
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};