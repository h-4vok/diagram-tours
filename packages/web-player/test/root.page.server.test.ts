import { afterEach, describe, expect, it } from "vitest";

import { load } from "../src/routes/+page.server";
import { resolvedTourCollection } from "./fixtures/tour-collection";

const ORIGINAL_STATIC_OUT = process.env.DIAGRAM_TOUR_STATIC_OUT;

afterEach(() => {
  if (ORIGINAL_STATIC_OUT === undefined) {
    delete process.env.DIAGRAM_TOUR_STATIC_OUT;
    return;
  }

  process.env.DIAGRAM_TOUR_STATIC_OUT = ORIGINAL_STATIC_OUT;
});

describe("root +page.server", () => {
  it("redirects to the first discovered tour", async () => {
    await expect(
      load({
        parent: async () => ({
          collection: resolvedTourCollection
        })
      } as never)
    ).rejects.toMatchObject({
      location: "/payment-flow",
      status: 307
    });
  });

  it("does not redirect the static root page", async () => {
    process.env.DIAGRAM_TOUR_STATIC_OUT = "C:/tmp/diagram-tours";

    await expect(
      load({
        parent: async () => ({ collection: resolvedTourCollection })
      } as never)
    ).resolves.toEqual({});
  });
});
