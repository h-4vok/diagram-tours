import { describe, expect, it } from "vitest";

import {
  ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE,
  readActiveInteractionContext,
  readActiveInteractionContextFromDocument
} from "../src/lib/interaction-context";

describe("interaction-context", () => {
  it("returns diagram when no overlays are open", () => {
    expect(readActiveInteractionContext({ isBrowseOpen: false, isDiagnosticsOpen: false })).toBe(
      "diagram"
    );
  });

  it("returns browse when browse is open", () => {
    expect(readActiveInteractionContext({ isBrowseOpen: true, isDiagnosticsOpen: false })).toBe(
      "browse"
    );
  });

  it("returns diagnostics when issues are open", () => {
    expect(readActiveInteractionContext({ isBrowseOpen: false, isDiagnosticsOpen: true })).toBe(
      "diagnostics"
    );
  });

  it("prioritizes browse when both overlays are open", () => {
    expect(readActiveInteractionContext({ isBrowseOpen: true, isDiagnosticsOpen: true })).toBe(
      "browse"
    );
  });

  it("reads context from the root marker", () => {
    document.body.innerHTML = `<div ${ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE}="diagnostics"></div>`;

    expect(readActiveInteractionContextFromDocument(document)).toBe("diagnostics");
  });

  it("falls back to diagram when the root marker is missing", () => {
    document.body.innerHTML = "<div></div>";

    expect(readActiveInteractionContextFromDocument(document)).toBe("diagram");
  });
});
