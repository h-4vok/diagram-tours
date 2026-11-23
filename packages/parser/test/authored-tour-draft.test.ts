import { afterEach, describe, expect, it } from "vitest";

import { parseTourDocument } from "../src/authored-tour-draft.js";
import { createTourContext } from "../src/tour-context.js";
import { normalizePath, restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser authored draft", () => {
  it("parses a valid authored draft", () => {
    const context = createTourContext("/tmp/tour.tour.yaml");

    expect(
      parseTourDocument({
        context,
        source: [
          "version: 1",
          "title: Valid Tour",
          "diagram: ./diagram.mmd",
          "",
          "steps:",
          "  - focus:",
          "      - api_gateway",
          "    text: >",
          "      Focus on {{api_gateway}}."
        ].join("\n")
      })
    ).toEqual({
      diagram: "./diagram.mmd",
      diagramNode: expect.anything(),
      steps: [
        {
          focus: ["api_gateway"],
          focusNodes: [expect.anything()],
          text: "Focus on {{api_gateway}}.\n",
          textNode: expect.anything()
        }
      ],
      title: "Valid Tour",
      version: 1
    });
  });

  it("fails when the root document is not an object", () => {
    const context = createTourContext("/tmp/tour.tour.yaml");

    expect(() =>
      parseTourDocument({
        context,
        source: "- version: 1\n- title: Broken"
      })
    ).toThrow(`Tour "${normalizePath(context.sourcePath)}": document must be an object`);
  });

  it("fails when required root fields are missing", () => {
    const context = createTourContext("/tmp/tour.tour.yaml");

    expect(() =>
      parseTourDocument({
        context,
        source: ["version: 1", "steps:", "  - focus: []", "    text: Test"].join("\n")
      })
    ).toThrow(`Tour "${normalizePath(context.sourcePath)}": title is required`);
  });

  it("fails when step focus is not an array", () => {
    const context = createTourContext("/tmp/tour.tour.yaml");

    expect(() =>
      parseTourDocument({
        context,
        source: [
          "version: 1",
          "title: Broken Tour",
          "diagram: ./diagram.mmd",
          "",
          "steps:",
          "  - focus: ghost",
          "    text: Test"
        ].join("\n")
      })
    ).toThrow(`Tour "${normalizePath(context.sourcePath)}": step 1 focus must be an array`);
  });
});
