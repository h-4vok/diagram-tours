import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("clicking a node jumps directly to its matching step", async ({ page }) => {
  await page.goto("/checkout-refund-flow");
  await expectDiagramVisible(page);

  await page.locator('[data-testid="diagram-container"] [data-node-id="payment_gateway"]').first().evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  await expect(page).toHaveURL(/\/checkout-refund-flow\?step=2$/);
  await expect(page.getByTestId("step-text-container")).toContainText("Payment Gateway");
});
