import type { ResolvedDiagramTour } from "@diagram-tour/core";
import { describe, expect, it } from "vitest";

import { load } from "../src/routes/[...tourSlug]/+page";
import { resolvedTourCollection } from "./fixtures/tour-collection";

describe("tour +page", () => {
  it("loads the selected tour from the collection", async () => {
    const result = (await load({
      params: {
        tourSlug: "refund-flow"
      },
      url: new URL("http://localhost/refund-flow"),
      parent: async () => ({
        collection: resolvedTourCollection
      })
    } as never)) as {
      initialStepIndex: number;
      selectedSlug: string;
      tour: ResolvedDiagramTour;
    };

    expect(result.selectedSlug).toBe("refund-flow");
    expect(result.tour.title).toBe("Refund Flow");
    expect(result.tour.steps).toHaveLength(2);
    expect(result.initialStepIndex).toBe(0);
  });

  it("opens the requested deep-linked step and clamps invalid step values", async () => {
    const validResult = (await load({
      params: {
        tourSlug: "payment-flow"
      },
      url: new URL("http://localhost/payment-flow?step=3"),
      parent: async () => ({
        collection: resolvedTourCollection
      })
    } as never)) as {
      initialStepIndex: number;
      selectedSlug: string;
      tour: ResolvedDiagramTour;
    };

    const invalidResult = (await load({
      params: {
        tourSlug: "payment-flow"
      },
      url: new URL("http://localhost/payment-flow?step=999"),
      parent: async () => ({
        collection: resolvedTourCollection
      })
    } as never)) as {
      initialStepIndex: number;
      selectedSlug: string;
      tour: ResolvedDiagramTour;
    };

    const malformedResult = (await load({
      params: {
        tourSlug: "payment-flow"
      },
      url: new URL("http://localhost/payment-flow?step=banana"),
      parent: async () => ({
        collection: resolvedTourCollection
      })
    } as never)) as {
      initialStepIndex: number;
      selectedSlug: string;
      tour: ResolvedDiagramTour;
    };

    expect(validResult.initialStepIndex).toBe(2);
    expect(invalidResult.initialStepIndex).toBe(validResult.tour.steps.length - 1);
    expect(malformedResult.initialStepIndex).toBe(0);
  });

  it("fails clearly when the selected slug does not exist", async () => {
    await expect(
      load({
        params: {
          tourSlug: "missing-tour"
        },
        url: new URL("http://localhost/missing-tour"),
        parent: async () => ({
          collection: resolvedTourCollection
        })
      } as never)
    ).rejects.toMatchObject({
      body: {
        message: 'Unknown tour slug "missing-tour".'
      },
      status: 404
    });
  });
});
