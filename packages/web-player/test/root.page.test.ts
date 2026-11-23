import { describe, expect, it } from "vitest";

import { load } from "../src/routes/+page";
import { resolvedTourCollection } from "./fixtures/tour-collection";

type RootPageResult = {
  collection: typeof resolvedTourCollection;
  selectedSlug: string;
  tour: (typeof resolvedTourCollection.entries)[number]["tour"] | null;
};

describe("root page", () => {
  it("selects the first tour and exposes the collection for static hash navigation", async () => {
    const result = await load({
      parent: async () => ({ collection: resolvedTourCollection })
    } as never);
    const page = result as RootPageResult;

    expect(page.collection).toBe(resolvedTourCollection);
    expect(page.selectedSlug).toBe("payment-flow");
    expect(page.tour).toBe(resolvedTourCollection.entries[0]?.tour);
  });

  it("keeps an empty collection renderable", async () => {
    const result = await load({
      parent: async () => ({ collection: { entries: [], skipped: [] } })
    } as never);

    const page = result as RootPageResult;

    expect(page.selectedSlug).toBe("");
    expect(page.tour).toBeNull();
  });
});
