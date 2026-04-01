import { describe, expect, it } from "vitest";

import {
  countDiagnosticIssues,
  createDiagnosticDisplayGroups
} from "../src/lib/diagnostics";

describe("diagnostics helpers", () => {
  it("creates grouped display items with cleaner summaries and references", () => {
    expect(
      createDiagnosticDisplayGroups([
        {
          diagnostics: [
            {
              code: "ghost",
              location: { column: 4, line: 2 },
              message: "step 1 focus references unknown Mermaid node id 'ghost'"
            }
          ],
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        issueCount: 1,
        issues: [
          {
            code: "ghost",
            detail: "step 1 focus references unknown Mermaid node id 'ghost'",
            location: { column: 4, line: 2 },
            reference: "examples/broken/broken.tour.yaml:2:4",
            summary: "step 1 focus references unknown Mermaid node id"
          }
        ],
        path: "examples/broken/broken.tour.yaml"
      }
    ]);
  });

  it("counts grouped issues across files", () => {
    const groups = createDiagnosticDisplayGroups([
      {
        diagnostics: [
          {
            code: "ghost",
            location: null,
            message: "step 1 focus references unknown Mermaid node id 'ghost'"
          },
          {
            code: "ghost",
            location: null,
            message: "step 1 text references unknown Mermaid node id 'ghost'"
          }
        ],
        sourceId: "examples/broken/broken.tour.yaml",
        sourcePath: "examples/broken/broken.tour.yaml"
      },
      {
        diagnostics: [
          {
            code: null,
            location: null,
            message: "diagram path is required"
          }
        ],
        sourceId: "examples/other/other.tour.yaml",
        sourcePath: "examples/other/other.tour.yaml"
      }
    ]);

    expect(countDiagnosticIssues(groups)).toBe(3);
  });

  it("truncates long messages into summary plus detail", () => {
    const diagnosticMessage =
      "This is a very long diagnostics message that keeps going well past the summary threshold so the detail block should still preserve the full explanation for authors.";

    expect(
      createDiagnosticDisplayGroups([
        {
          diagnostics: [
            {
              code: null,
              location: null,
              message: diagnosticMessage
            }
          ],
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])[0]?.issues[0]
    ).toEqual({
      code: null,
      detail: diagnosticMessage,
      location: null,
      reference: "examples/broken/broken.tour.yaml",
      summary: expect.stringMatching(/\.\.\.$/u)
    });
  });

  it("keeps quoted-only messages in the summary source and omits duplicated detail", () => {
    expect(
      createDiagnosticDisplayGroups([
        {
          diagnostics: [
            {
              code: "ghost_node",
              location: null,
              message: '"ghost_node"'
            }
          ],
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        issueCount: 1,
        issues: [
          {
            code: "ghost_node",
            detail: null,
            location: null,
            reference: "examples/broken/broken.tour.yaml",
            summary: '"ghost_node"'
          }
        ],
        path: "examples/broken/broken.tour.yaml"
      }
    ]);
  });

  it("drops malformed quoted code while preserving the full detail", () => {
    expect(
      createDiagnosticDisplayGroups([
        {
          diagnostics: [
            {
              code: null,
              location: null,
              message: 'step 1 focus references bad Mermaid node " "'
            }
          ],
          sourceId: "examples/broken/broken.tour.yaml",
          sourcePath: "examples/broken/broken.tour.yaml"
        }
      ])
    ).toEqual([
      {
        issueCount: 1,
        issues: [
          {
            code: null,
            detail: 'step 1 focus references bad Mermaid node " "',
            location: null,
            reference: "examples/broken/broken.tour.yaml",
            summary: "step 1 focus references bad Mermaid node"
          }
        ],
        path: "examples/broken/broken.tour.yaml"
      }
    ]);
  });
});
