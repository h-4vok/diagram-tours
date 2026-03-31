import { expect, test } from "@playwright/test";
import { expectCameraPanelToContainControls, expectDiagramVisible } from "./smoke-test-helpers";

test("desktop minimap stays visible and tracks the focused step", async ({ page }) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("camera-control-cluster")).toBeVisible();
  await expect(page.getByTestId("camera-control-panel")).toBeVisible();
  await expect(page.getByTestId("minimap-shell")).toBeVisible();
  await expect(page.getByTestId("minimap-surface")).toBeVisible();
  await expectCameraPanelToContainControls(page);
  expect(await page.getByTestId("minimap-edge-marker").count()).toBeGreaterThan(0);
  expect(await page.getByTestId("minimap-node-marker").count()).toBeGreaterThan(3);
  await expect(page.getByTestId("minimap-focus-marker")).toHaveCount(1);

  await page.getByTestId("next-button").click();
  await expect(page).toHaveURL(/\/checkout-payment-flow\?step=2$/);
  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text-container")).toContainText("merchant-side transaction state");
  await expect(page.getByTestId("minimap-focus-marker")).toHaveCount(2);
});
