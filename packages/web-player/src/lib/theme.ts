export type ThemeName = "light" | "dark";
type ThemeDocumentLike = {
  documentElement: {
    dataset: {
      theme?: string;
    };
  };
};

export const DEFAULT_THEME: ThemeName = "dark";
export const THEME_STORAGE_KEY = "diagram-tour-theme";

export function toggleTheme(theme: ThemeName): ThemeName {
  return theme === "light" ? "dark" : "light";
}

export function getThemeToggleLabel(theme: ThemeName): string {
  return theme === "light" ? "Dark mode" : "Light mode";
}

export function getStoredTheme(storage: Pick<Storage, "getItem">): ThemeName | null {
  const value = storage.getItem(THEME_STORAGE_KEY);

  return isThemeName(value) ? value : null;
}

export function setStoredTheme(
  storage: Pick<Storage, "setItem">,
  theme: ThemeName
): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}

export function getDocumentTheme(
  documentLike: ThemeDocumentLike
): ThemeName | null {
  const value = documentLike.documentElement.dataset.theme ?? null;

  return isThemeName(value) ? value : null;
}

export function setDocumentTheme(
  documentLike: ThemeDocumentLike,
  theme: ThemeName
): void {
  documentLike.documentElement.dataset.theme = theme;
}

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
}
