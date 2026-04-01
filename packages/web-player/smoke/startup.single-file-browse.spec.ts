import { expect, test } from "@playwright/test";
import { expectSingleTourBrowse } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("explicit single-file startup limits browse to one tour", async ({ page }) => {
  const server = await startDevServer({
    args: ["./examples/checkout-payment-flow.tour.yaml"],
    port: 4176
  });

  try {
    await page.goto(server.baseUrl);
    await page.getByTestId("search-hint-trigger").click();
    await expect(page.getByTestId("browse-panel")).toBeVisible();

    await expectSingleTourBrowse(page, {
      expectedTitle: "Payment Flow",
      filename: "checkout-payment-flow.tour.yaml",
      unexpectedTitle: "Refund Flow"
    });
  } finally {
    await server.stop();
  }
});
