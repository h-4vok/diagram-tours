import { expect, test } from "@playwright/test";
import { expectFocusedAreaNearViewportCenter } from "./smoke-test-helpers";

test("focused areas stay reasonably centered through viewport-centering examples", async ({ page }) => {
  await page.goto("/navigation-viewport-centering");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expectFocusedAreaNearViewportCenter(page, ["build"]);

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text-container")).toContainText("Roll Out");
  await expectFocusedAreaNearViewportCenter(page, ["rollout"]);

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text-container")).toContainText("Verify in Staging");
  await expectFocusedAreaNearViewportCenter(page, ["verify", "observe"]);
});
