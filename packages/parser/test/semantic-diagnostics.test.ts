import { afterEach, describe, expect, it } from "vitest";

import { validateResolvedTourTargets } from "../src/index.js";
import { createTempTour, normalizePath, restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser semantic diagnostics", () => {
  it("accumulates multiple semantic issues from one authored file with locations", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Broken Tour",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - ghost",
        "    text: >",
        "      The {{ghost}} node is missing."
      ].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report).toMatchObject({
      total: 1,
      valid: 0
    });
    expect(report.issues).toEqual([
      {
        diagnostic: {
          code: null,
          location: { column: 10, line: 6 },
          message: 'step 1 focus references unknown Mermaid node id "ghost"'
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      },
      {
        diagnostic: {
          code: null,
          location: { column: 12, line: 7 },
          message: 'step 1 text references unknown Mermaid node id "ghost"'
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      }
    ]);
  });

  it("reports a non-object authored document with a root location", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: ["- version: 1", "- title: Broken Tour"].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report.issues).toEqual([
      {
        diagnostic: {
          code: null,
          location: { column: 0, line: 0 },
          message: "document must be an object"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      }
    ]);
  });

  it("reports authored root field issues with precise locations", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: ["version:", "  major: 1", "title:", "diagram:", "steps: wrong"].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report.issues).toEqual([
      {
        diagnostic: {
          code: null,
          location: { column: 4, line: 1 },
          message: 'unsupported tour version "undefined"'
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      },
      {
        diagnostic: {
          code: null,
          location: { column: 1, line: 3 },
          message: "title is required"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      },
      {
        diagnostic: {
          code: null,
          location: { column: 1, line: 4 },
          message: "diagram path is required"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      },
      {
        diagnostic: {
          code: null,
          location: { column: 9, line: 4 },
          message: "steps must be a non-empty array"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      }
    ]);
  });

  it("reports authored step structure issues with precise locations", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Broken Steps",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - nope",
        "  - focus: ghost",
        "    text:"
      ].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report.issues).toEqual([
      {
        diagnostic: {
          code: null,
          location: { column: 6, line: 5 },
          message: "step 1 must be an object"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      },
      {
        diagnostic: {
          code: null,
          location: { column: 13, line: 6 },
          message: "step 2 focus must be an array"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      },
      {
        diagnostic: {
          code: null,
          location: { column: 11, line: 7 },
          message: "step 2 text is required"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      }
    ]);
  });

  it("reports invalid focus values with precise locations", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Broken Focus",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - api_gateway",
        "      - ''",
        "    text: >",
        "      {{ghost}} still repeats {{ghost}}."
      ].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report.issues).toEqual([
      {
        diagnostic: {
          code: null,
          location: { column: 10, line: 7 },
          message: "step 1 focus must contain only non-empty diagram element ids"
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      }
    ]);
  });

  it("dedupes repeated unknown text references from one authored step", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Broken Text",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - api_gateway",
        "    text: >",
        "      {{ghost}} still repeats {{ghost}}."
      ].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report.issues).toEqual([
      {
        diagnostic: {
          code: null,
          location: { column: 12, line: 7 },
          message: 'step 1 text references unknown Mermaid node id "ghost"'
        },
        sourceId: normalizePath(invalidFilePath),
        sourcePath: "tour.tour.yaml"
      }
    ]);
  });

  it("reports yaml syntax errors with line and column and stops semantic accumulation", async () => {
    const invalidFilePath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Broken Tour",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus: [ghost",
        "    text: >",
        "      The {{ghost}} node is missing."
      ].join("\n")
    });

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      diagnostic: {
        code: expect.any(String),
        location: {
          column: expect.any(Number),
          line: expect.any(Number)
        }
      },
      sourceId: normalizePath(invalidFilePath),
      sourcePath: "tour.tour.yaml"
    });
  });
});
