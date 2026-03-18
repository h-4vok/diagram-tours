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
        detail: null,
        path: "examples/broken/broken.tour.yaml",
        summary: "step 1 focus references unknown Mermaid node id 'ghost'",
        title: "broken.tour.yaml"
      }
    ]);
  });

  it("truncates long messages into summary plus detail", () => {
    const message =
      'Tour "examples/broken/broken.tour.yaml": ' +
      "This is a very long diagnostics message that keeps going well past the summary threshold so the detail block should still preserve the full explanation for authors.";

    expect(createDiagnosticDisplayItems([{ error: message, sourcePath: "examples/broken/broken.tour.yaml" }])[0]).toEqual({
      detail:
        "This is a very long diagnostics message that keeps going well past the summary threshold so the detail block should still preserve the full explanation for authors.",
      path: "examples/broken/broken.tour.yaml",
      summary: expect.stringMatching(/\.\.\.$/u),
      title: "broken.tour.yaml"
    });
  });
});
