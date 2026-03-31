import { expect, test } from "@playwright/test";
import { expectBrowseOpen, readBrowsePanel } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("explicit diagram startup generates a fallback tour preview", async ({ page }) => {
  const server = await startDevServer({
    args: ["./examples/checkout-payment-flow.mmd"],
    port: 4182
  });

  try {
    await expectBrowseOpen(page, server.baseUrl);

    await expect(page.getByTestId("preview-target-notice")).toContainText("checkout-payment-flow.mmd");
    await expect(readBrowsePanel(page).getByText("Checkout Payment Flow", { exact: true })).toBeVisible();
    await expect(page.getByTestId("step-text")).toContainText("Overview of Checkout Payment Flow.");
  } finally {
    await server.stop();
  }
});
