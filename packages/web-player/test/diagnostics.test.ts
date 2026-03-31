import { describe, expect, it } from "vitest";

import { createDiagnosticDisplayItems } from "../src/lib/diagnostics";

describe("diagnostics helpers", () => {
  it("creates display items with cleaner summaries and titles", () => {
    expect(
      createDiagnosticDisplayItems([
        {
          diagnostic: {
            code: "ghost",
            location: null,
            message: "step 1 focus references unknown Mermaid node id 'ghost'"
          },
          error:
            'Tour "examples/broken/broken.tour.yaml": step 1 focus references unknown Mermaid node id \'ghost\'',
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        code: "ghost",
        detail: "step 1 focus references unknown Mermaid node id 'ghost'",
        location: null,
        path: "examples/broken/broken.tour.yaml",
        summary: "step 1 focus references unknown Mermaid node id"
      }
    ]);
  });

  it("truncates long messages into summary plus detail", () => {
    const diagnosticMessage =
      "This is a very long diagnostics message that keeps going well past the summary threshold so the detail block should still preserve the full explanation for authors.";
    const message = `Tour "examples/broken/broken.tour.yaml": ${diagnosticMessage}`;

    expect(
      createDiagnosticDisplayItems([
        {
          diagnostic: {
            code: null,
            location: null,
            message: diagnosticMessage
          },
          error: message,
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])[0]
    ).toEqual({
      code: null,
      detail: diagnosticMessage,
      location: null,
      path: "examples/broken/broken.tour.yaml",
      summary: expect.stringMatching(/\.\.\.$/u)
    });
  });

  it("keeps quoted-only messages in the summary source and omits duplicated detail", () => {
    expect(
      createDiagnosticDisplayItems([
        {
          diagnostic: {
            code: "ghost_node",
            location: null,
            message: '"ghost_node"'
          },
          error: 'Tour "examples/broken/broken.tour.yaml": "ghost_node"',
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        code: "ghost_node",
        detail: null,
        location: null,
        path: "examples/broken/broken.tour.yaml",
        summary: '"ghost_node"'
      }
    ]);
  });

  it("drops malformed quoted code while preserving the full detail", () => {
    expect(
      createDiagnosticDisplayItems([
        {
          diagnostic: {
            code: null,
            location: null,
            message: 'step 1 focus references bad Mermaid node " "'
          },
          error:
            'Tour "examples/broken/broken.tour.yaml": step 1 focus references bad Mermaid node " "',
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        code: null,
        detail: 'step 1 focus references bad Mermaid node " "',
        location: null,
        path: "examples/broken/broken.tour.yaml",
        summary: "step 1 focus references bad Mermaid node"
      }
    ]);
  });
});
