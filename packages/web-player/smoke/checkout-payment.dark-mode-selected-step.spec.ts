import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("selected steps keep a focused-node contract while the default dark mode remains usable", async ({ page }) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="api_gateway"]')).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(1);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="validation_service"]')
  ).toHaveAttribute("data-step-target", "true");
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="validation_service"]')
  ).toHaveAttribute("data-focus-state", "dimmed");
});
