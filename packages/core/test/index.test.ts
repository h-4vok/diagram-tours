import { describe, expect, it } from "vitest";

describe("@diagram-tour/core", () => {
  it("exports the supported tour version", async () => {
    const mod = await import("../src/index");

    expect(mod.SUPPORTED_TOUR_VERSION).toBe(1);
  });
});
