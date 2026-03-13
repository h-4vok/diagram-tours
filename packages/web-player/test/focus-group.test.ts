import { describe, expect, it } from "vitest";

import { createFocusGroup } from "../src/lib/focus-group";

describe("createFocusGroup", () => {
  it("returns an empty group when no nodes are focused", () => {
    expect(createFocusGroup([])).toEqual({
      mode: "empty",
      nodeIds: [],
      size: 0
    });
  });

  it("returns a single-node group for one focused node", () => {
    expect(createFocusGroup(["response"])).toEqual({
      mode: "single",
      nodeIds: ["response"],
      size: 1
    });
  });

  it("deduplicates and sorts multiple focused nodes into a stable group", () => {
    expect(createFocusGroup(["payment_provider", "payment_service", "payment_provider"])).toEqual({
      mode: "group",
      nodeIds: ["payment_provider", "payment_service"],
      size: 2
    });
  });
});
