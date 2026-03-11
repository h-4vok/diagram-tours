import { describe, expect, it } from "vitest";

import { load } from "../src/routes/+page.server";

describe("+page.server", () => {
  it("loads the resolved payment-flow example", async () => {
    const result = await load({} as never);

    expect(result).toBeDefined();

    if (result === undefined) {
      throw new Error("Expected payment-flow example data");
    }

    expect(result.tour.title).toBe("Payment Flow");
    expect(result.tour.steps).toHaveLength(4);
    expect(result.tour.steps[0]).toMatchObject({
      index: 1,
      focus: [{ id: "api_gateway", label: "API Gateway" }],
      text: expect.stringContaining(
        "The API Gateway is the public entry point for incoming requests from Client."
      )
    });
  });
});
