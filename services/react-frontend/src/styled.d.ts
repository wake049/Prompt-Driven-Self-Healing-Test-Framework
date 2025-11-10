import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      primary: string;
      text: string;
      textSecondary: string;
      background: string;
      surface: string;
      border: string;
      hover: string;
      activeBackground: string;
    };
    mode: 'light' | 'dark';
  }
}