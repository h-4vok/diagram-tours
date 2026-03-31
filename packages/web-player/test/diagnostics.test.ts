import { describe, expect, it } from "vitest";

import { createDiagnosticDisplayItems } from "../src/lib/diagnostics";

describe("diagnostics helpers", () => {
  it("creates display items with cleaner summaries and titles", () => {
    expect(
      createDiagnosticDisplayItems([
        {
          error:
            'Tour "examples/broken/broken.tour.yaml": step 1 focus references unknown Mermaid node id \'ghost\'',
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        code: "ghost",
        detail: "step 1 focus references unknown Mermaid node id 'ghost'",
        path: "examples/broken/broken.tour.yaml",
        summary: "step 1 focus references unknown Mermaid node id"
      }
    ]);
  });

  it("truncates long messages into summary plus detail", () => {
    const message =
      'Tour "examples/broken/broken.tour.yaml": ' +
      "This is a very long diagnostics message that keeps going well past the summary threshold so the detail block should still preserve the full explanation for authors.";

    expect(createDiagnosticDisplayItems([{ error: message, sourcePath: "examples/broken/broken.tour.yaml" }])[0]).toEqual({
      code: null,
      detail:
        "This is a very long diagnostics message that keeps going well past the summary threshold so the detail block should still preserve the full explanation for authors.",
      path: "examples/broken/broken.tour.yaml",
      summary: expect.stringMatching(/\.\.\.$/u)
    });
  });

  it("keeps quoted-only messages in the summary source and omits duplicated detail", () => {
    expect(
      createDiagnosticDisplayItems([
        {
          error: 'Tour "examples/broken/broken.tour.yaml": "ghost_node"',
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        code: "ghost_node",
        detail: null,
        path: "examples/broken/broken.tour.yaml",
        summary: '"ghost_node"'
      }
    ]);
  });

  it("drops malformed quoted code while preserving the full detail", () => {
    expect(
      createDiagnosticDisplayItems([
        {
          error:
            'Tour "examples/broken/broken.tour.yaml": step 1 focus references bad Mermaid node " "',
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        code: null,
        detail: 'step 1 focus references bad Mermaid node " "',
        path: "examples/broken/broken.tour.yaml",
        summary: "step 1 focus references bad Mermaid node"
      }
    ]);
  });
});
