import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("clicking a repeated node opens a chooser with matching steps", async ({ page }) => {
  await page.goto("/navigation-viewport-stability");
  await expectDiagramVisible(page);

  await page.locator('[data-testid="diagram-container"] [data-node-id="review"]').click({
    force: true,
    position: {
      x: 16,
      y: 16
    }
  });

  await expect(page.getByTestId("node-step-chooser")).toBeVisible();
  await expect(page.getByTestId("node-step-choice")).toHaveCount(2);
  await page.getByTestId("node-step-choice").nth(1).click();

  await expect(page).toHaveURL(/\/navigation-viewport-stability\?step=3$/);
});
