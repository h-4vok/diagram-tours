import { describe, expect, it, vi } from "vitest";

const resolveMock = vi.fn(() => "/runtime/server.js");

vi.mock("node:module", () => {
  return {
    createRequire() {
      return {
        resolve: resolveMock
      };
    }
  };
});

describe("resolveWebPlayerEntry", () => {
  it("resolves the packaged web-player dependency entry", async () => {
    const { resolveWebPlayerEntry } = await import("../src/lib/runtime-package.js");

    expect(resolveWebPlayerEntry()).toBe("/runtime/server.js");
    expect(resolveMock).toHaveBeenCalledWith("@diagram-tour/web-player");
  });
});
