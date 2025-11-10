import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      primary: string;
      secondary: string;
      text: string;
      textSecondary: string;
      background: string;
      surface: string;
      border: string;
      hover: string;
      activeBackground: string;
      success: string;
      error: string;
      warning: string;
      info: string;
    };
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
}