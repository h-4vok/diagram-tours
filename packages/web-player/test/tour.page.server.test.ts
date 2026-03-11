import type { ResolvedDiagramTour } from "@diagram-tour/core";
import { describe, expect, it } from "vitest";

import { load } from "../src/routes/[...tourSlug]/+page.server";
import { resolvedTourCollection } from "./fixtures/tour-collection";

describe("tour +page.server", () => {
  it("loads the selected tour from the collection", async () => {
    const result = (await load({
      params: {
        tourSlug: "refund-flow"
      },
      parent: async () => ({
        collection: resolvedTourCollection
      })
    } as never)) as { selectedSlug: string; tour: ResolvedDiagramTour };

    expect(result.selectedSlug).toBe("refund-flow");
    expect(result.tour.title).toBe("Refund Flow");
    expect(result.tour.steps).toHaveLength(2);
  });

  it("fails clearly when the selected slug does not exist", async () => {
    await expect(
      load({
        params: {
          tourSlug: "missing-tour"
        },
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
