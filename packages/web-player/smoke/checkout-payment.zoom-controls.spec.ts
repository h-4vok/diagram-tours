import { expect, test } from "@playwright/test";
import {
  expectCameraPanelToContainControls,
  expectDiagramVisible,
  readDiagramScrollPosition,
  readNodeAxisSize
} from "./smoke-test-helpers";

test("zoom controls resize the active diagram and return cleanly", async ({ page }) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);
  await expectCameraPanelToContainControls(page);
  await expect(page.getByTestId("zoom-out-button")).toBeVisible();
  await expect(page.getByTestId("zoom-fit-button")).toBeVisible();
  await expect(page.getByTestId("zoom-one-hundred-button")).toBeVisible();
  await expect(page.getByTestId("zoom-in-button")).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId("viewport-toolbar").evaluate((element) =>
        Array.from(element.children).map((child) => child.getAttribute("data-testid") ?? child.textContent?.trim())
      )
    )
    .toEqual(["zoom-primary-controls", "zoom-value", "zoom-one-hundred-button"]);

  const baselineWidth = await readNodeAxisSize(page, "api_gateway", "width");

  await page.getByTestId("zoom-fit-button").click();
  await page.waitForTimeout(250);

  const fittedWidth = await readNodeAxisSize(page, "api_gateway", "width");
  const fittedScroll = await readDiagramScrollPosition(page);

  await page.getByTestId("zoom-in-button").click();

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeGreaterThan(
    fittedWidth * 1.1
  );

  await page.getByTestId("zoom-fit-button").click();
  await page.waitForTimeout(250);

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeCloseTo(
    fittedWidth,
    0
  );
  await expect.poll(() => readDiagramScrollPosition(page)).toEqual(fittedScroll);

  await page.getByTestId("zoom-out-button").click();
  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeLessThan(
    baselineWidth * 0.95
  );

  await page.getByTestId("zoom-one-hundred-button").click();
  await page.waitForTimeout(250);

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeGreaterThan(
    baselineWidth * 0.95
  );
  await expect(page.getByTestId("zoom-value")).toContainText("100%");
});
