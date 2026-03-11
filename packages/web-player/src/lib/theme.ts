export type ThemeName = "light" | "dark";

export const DEFAULT_THEME: ThemeName = "light";

export function toggleTheme(theme: ThemeName): ThemeName {
  return theme === "light" ? "dark" : "light";
}

export function getThemeToggleLabel(theme: ThemeName): string {
  return theme === "light" ? "Dark mode" : "Light mode";
}
