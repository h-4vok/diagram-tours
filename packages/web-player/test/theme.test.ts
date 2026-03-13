import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME,
  getDocumentTheme,
  getStoredTheme,
  getThemeToggleLabel,
  setDocumentTheme,
  setStoredTheme,
  toggleTheme
} from "../src/lib/theme";

describe("theme helpers", () => {
  it("defaults to light mode", () => {
    expect(DEFAULT_THEME).toBe("light");
  });

  it("toggles between light and dark themes", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("light");
  });

  it("returns the next action label for the toggle button", () => {
    expect(getThemeToggleLabel("light")).toBe("Dark mode");
    expect(getThemeToggleLabel("dark")).toBe("Light mode");
  });

  it("reads a persisted theme when it is valid", () => {
    const storage = createStorageMock("dark");

    expect(getStoredTheme(storage)).toBe("dark");
  });

  it("ignores persisted values that are not valid themes", () => {
    const storage = createStorageMock("midnight");

    expect(getStoredTheme(storage)).toBeNull();
  });

  it("writes the selected theme to storage", () => {
    const setItem = vi.fn();
    const storage = {
      getItem: () => null,
      setItem
    };

    setStoredTheme(storage, "dark");

    expect(setItem).toHaveBeenCalledWith("diagram-tour-theme", "dark");
  });

  it("reads the active theme from the document root", () => {
    expect(getDocumentTheme(createDocumentLike("dark"))).toBe("dark");
  });

  it("ignores invalid values from the document root", () => {
    expect(getDocumentTheme(createDocumentLike("sepia"))).toBeNull();
  });

  it("writes the active theme to the document root", () => {
    const documentLike = createDocumentLike(undefined);

    setDocumentTheme(documentLike, "dark");

    expect(documentLike.documentElement.dataset.theme).toBe("dark");
  });
});

function createStorageMock(value: string | null): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: () => value,
    setItem: () => {}
  };
}

function createDocumentLike(theme: string | undefined): {
  documentElement: {
    dataset: {
      theme?: string;
    };
  };
} {
  return {
    documentElement: {
      dataset: theme === undefined ? {} : { theme }
    }
  };
}
