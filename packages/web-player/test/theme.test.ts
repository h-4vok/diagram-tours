import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, getThemeToggleLabel, toggleTheme } from "../src/lib/theme";

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
});
