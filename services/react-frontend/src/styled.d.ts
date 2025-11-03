import 'styled-components';
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
}
interface ThemeShadows {
  small: string;
  medium: string;
  large: string;
}
interface ThemeBorderRadius {
  small: string;
  medium: string;
  large: string;
}
declare module 'styled-components' {
  export interface DefaultTheme {
    colors: ThemeColors;
    shadows: ThemeShadows;
    borderRadius: ThemeBorderRadius;
  }
}