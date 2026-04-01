import { expect, test } from "@playwright/test";
import { expectCameraPanelToContainControls, expectDiagramVisible, readNodeAxisSize } from "./smoke-test-helpers";

test("zoom controls resize the active diagram and return cleanly", async ({ page }) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);
  await expectCameraPanelToContainControls(page);

  const baselineWidth = await readNodeAxisSize(page, "api_gateway", "width");

  await page.getByTestId("zoom-in-button").click();

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeGreaterThan(
    baselineWidth * 1.15
  );
  await expect(page.getByTestId("zoom-value")).toContainText("125%");

  await page.getByTestId("zoom-out-button").click();

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeLessThan(
    baselineWidth * 1.05
  );
  await expect(page.getByTestId("zoom-value")).toContainText("100%");
});
