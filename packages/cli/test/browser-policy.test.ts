import { describe, expect, it } from "vitest";

import { resolveBrowserOpenPolicy } from "../src/lib/browser-policy.js";

describe("resolveBrowserOpenPolicy", () => {
  it("defaults direct startup to not opening the browser", () => {
    expect(resolveBrowserOpenPolicy({ browser: "never", mode: "direct" })).toBe(false);
  });

  it("lets --open force browser launch for direct startup", () => {
    expect(resolveBrowserOpenPolicy({ browser: "always", mode: "direct" })).toBe(true);
  });

  it("maps a wizard yes choice to opening the browser", () => {
    expect(resolveBrowserOpenPolicy({ browser: "always", mode: "wizard" })).toBe(true);
  });

  it("maps a wizard no choice to not opening the browser", () => {
    expect(resolveBrowserOpenPolicy({ browser: "never", mode: "wizard" })).toBe(false);
  });
});
