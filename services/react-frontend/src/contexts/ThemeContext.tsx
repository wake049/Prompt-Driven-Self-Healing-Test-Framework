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
    primary: '#185FA5',
    secondary: '#1D9E75',
    background: '#F1EFE8',
    surface: '#ffffff',
    text: '#1A1A1A',
    textSecondary: '#444441',
    border: '#D3D1C7',
    success: '#1D9E75',
    warning: '#854F0B',
    error: '#A32D2D',
    info: '#185FA5',
    hover: '#E6F1FB',
    activeBackground: '#E6F1FB',
  },
  shadows: {
    small: '0 2px 8px rgba(0, 0, 0, 0.08)',
    medium: '0 8px 32px rgba(0, 0, 0, 0.08)',
    large: '0 12px 40px rgba(0, 0, 0, 0.12)',
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
    primary: '#378ADD',
    secondary: '#5DCAA5',
    background: '#042C53',
    surface: '#0a3a66',
    text: '#f7fafc',
    textSecondary: '#a0aec0',
    border: '#1a5a8a',
    success: '#5DCAA5',
    warning: '#fbd38d',
    error: '#d47070',
    info: '#85B7EB',
    hover: '#1a5a8a',
    activeBackground: '#042C53',
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