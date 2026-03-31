import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("small screens hide the minimap automatically", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 640 });
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("step-overlay")).toBeVisible();
  await expect(page.getByTestId("minimap-shell")).toHaveCount(0);
});
