import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("collapsed minimap hides the full panel and exposes a restore action", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour:minimap-collapsed", "true");
  });
  await page.goto("/flowchart/checkout-payment-flow");
  await expectDiagramVisible(page);

  await expect(page.getByTestId("camera-control-panel")).toHaveCount(0);
  await expect(page.getByTestId("floating-panel-dock")).toBeVisible();
  await expect(page.getByTestId("restore-minimap-button")).toBeVisible();
  await expect(page.getByTestId("restore-teleprompter-button")).toHaveCount(0);
});
