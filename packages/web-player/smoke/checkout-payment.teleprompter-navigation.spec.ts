import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("teleprompter navigation advances between steps", async ({ page }) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);

  await page.getByTestId("next-button").click();
  await expect(page).toHaveURL(/\/checkout-payment-flow\?step=2$/);
  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/checkout-payment-flow\?step=3$/);
  await expect(page.getByTestId("step-text-container")).toContainText("merchant-side transaction state");
  await expect
    .poll(async () => {
      return page
        .locator('[data-testid="diagram-container"] [data-connector-role="flow"][data-connector-state="active"]')
        .count();
    })
    .toBeGreaterThan(0);
});
