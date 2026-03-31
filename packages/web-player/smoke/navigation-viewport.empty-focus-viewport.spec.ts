import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("empty-focus steps keep viewport behavior stable", async ({ page }) => {
  await page.goto("/navigation-viewport-centering?step=3");
  await expectDiagramVisible(page);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/navigation-viewport-centering\?step=4$/);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(0);

  await expect.poll(async () =>
    page.getByTestId("diagram-container").evaluate((element) => element.scrollTop)
  ).toBeLessThanOrEqual(4);

  const neutralScrollTop = await page.getByTestId("diagram-container").evaluate((element) => element.scrollTop);

  expect(neutralScrollTop).toBeLessThanOrEqual(4);
});
