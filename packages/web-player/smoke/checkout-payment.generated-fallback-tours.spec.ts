import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("generated fallback tours render a minimal overview and node-by-node walkthrough", async ({ page }) => {
  const server = await startDevServer({
    args: ["./examples/checkout-payment-flow.mmd"],
    port: 4183
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text-container")).toContainText("Overview of Checkout Payment Flow.");

    await page.getByTestId("next-button").click();

    await expect(page.getByTestId("step-text-container")).toContainText("Focus on Client.");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="client"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
  } finally {
    await server.stop();
  }
});
