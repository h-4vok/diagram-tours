import { expect, test } from "@playwright/test";
import { expectCameraPanelToContainControls, expectDiagramVisible } from "./smoke-test-helpers";

test("collapsed minimap keeps zoom controls inside the same camera panel", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour:minimap-collapsed", "true");
  });
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);

  await expect(page.getByTestId("camera-control-panel")).toBeVisible();
  await expect(page.getByTestId("minimap-shell")).toBeVisible();
  await expect(page.getByTestId("minimap-surface")).toHaveCount(0);
  await expect(page.getByTestId("viewport-toolbar")).toBeVisible();
  await expectCameraPanelToContainControls(page);
});
