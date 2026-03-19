import type { BrowserPreference, StartupMode } from "./types.js";

export function resolveBrowserOpenPolicy(options: {
  browser: BrowserPreference;
  mode: StartupMode;
}): boolean {
  return options.browser === "always";
}
