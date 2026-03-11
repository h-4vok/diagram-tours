import { describe, expect, it } from "vitest";

import { parseMermaid, parseTourYaml, validateTourShape } from "../src/index";

describe("@diagram-tour/parser", () => {
  it("parses mermaid source into a diagram asset", () => {
    const result = parseMermaid("flowchart LR", "fixtures/diagram.mmd");

    expect(result).toEqual({
      asset: {
        path: "fixtures/diagram.mmd",
        source: "flowchart LR"
      }
    });
  });

  it("parses tour yaml into a tour asset", () => {
    const result = parseTourYaml("version: 1", "fixtures/tour.yaml");

    expect(result).toEqual({
      asset: {
        path: "fixtures/tour.yaml",
        source: "version: 1"
      }
    });
  });

  it("returns the provided tour unchanged during validation", () => {
    const tour = {
      version: 1,
      title: "Payment Flow",
      diagram: "./payment-flow.mmd",
      steps: [
        {
          focus: ["api_gateway"],
          text: "Gateway step"
        }
      ]
    };

    expect(validateTourShape(tour)).toBe(tour);
  });
});

