import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { useTheme } from '../../contexts/ThemeContext';
interface StyledThemeWrapperProps {
  children: React.ReactNode;
}
const StyledThemeWrapper: React.FC<StyledThemeWrapperProps> = ({ children }) => {
  const { theme } = useTheme();
  return (
    <StyledThemeProvider theme={theme}>
      {children}
    </StyledThemeProvider>
  );
};
export default StyledThemeWrapper;