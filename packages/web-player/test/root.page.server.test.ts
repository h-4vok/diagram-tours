import { describe, expect, it } from "vitest";

import { load } from "../src/routes/+page.server";
import { resolvedTourCollection } from "./fixtures/tour-collection";

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
});
