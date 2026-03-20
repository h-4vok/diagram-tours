import { describe, expect, it } from "vitest";

import {
  createNodeStepChoices,
  createNodeStepIndex,
  hasNodeStepMatches,
  readNodeStepMatches
} from "../src/lib/tour-step-links";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

describe("tour-step-links", () => {
  it("indexes step matches by node id", () => {
    const index = createNodeStepIndex({
      ...resolvedPaymentFlowTour,
      steps: [
        resolvedPaymentFlowTour.steps[0],
        {
          ...resolvedPaymentFlowTour.steps[1],
          focus: [
            ...resolvedPaymentFlowTour.steps[1].focus,
            { id: "api_gateway", kind: "node", label: "API Gateway" }
          ]
        }
      ]
    });

    expect(readNodeStepMatches(index, "api_gateway")).toEqual([0, 1]);
    expect(readNodeStepMatches(index, "missing")).toEqual([]);
    expect(hasNodeStepMatches(index, "api_gateway")).toBe(true);
    expect(hasNodeStepMatches(index, "missing")).toBe(false);
  });

  it("creates chooser options with short step previews", () => {
    expect(createNodeStepChoices(resolvedPaymentFlowTour, [0, 2])).toEqual([
      {
        preview: expect.stringContaining("The API Gateway is the public edge"),
        stepIndex: 0,
        stepNumber: 1
      },
      {
        preview: expect.stringContaining("The Payment Service owns the merchant-side"),
        stepIndex: 2,
        stepNumber: 3
      }
    ]);
  });

  it("keeps short chooser previews without adding an ellipsis", () => {
    expect(
      createNodeStepChoices(
        {
          ...resolvedPaymentFlowTour,
          steps: [
            {
              ...resolvedPaymentFlowTour.steps[0],
              text: "Short summary"
            }
          ]
        },
        [0]
      )
    ).toEqual([
      {
        preview: "Short summary",
        stepIndex: 0,
        stepNumber: 1
      }
    ]);
  });
});
