import { describe, expect, it } from "vitest";

import {
  pageDescription,
  pageTitle,
  workspacePackages
} from "../src/lib/workspace-content";

describe("@diagram-tour/web-player", () => {
  it("exports the scaffold page metadata", () => {
    expect(pageTitle).toBe("Diagram Tour");
    expect(pageDescription).toBe("Initial SvelteKit scaffold for the Diagram Tour web player.");
  });

  it("describes each workspace package shown in the player shell", () => {
    expect(workspacePackages).toEqual([
      {
        name: "core",
        description: "Shared domain model and future tour engine."
      },
      {
        name: "parser",
        description: "Mermaid and YAML parsing plus validation."
      },
      {
        name: "web-player",
        description: "Minimal SvelteKit app shell for future playback UI."
      }
    ]);
  });
});
