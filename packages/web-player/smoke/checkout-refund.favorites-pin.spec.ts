import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("favorites pin a starred tour above the command palette results", async ({ page }) => {
  await page.goto("/checkout-refund-flow");
  await expectDiagramVisible(page);

  await page.getByTestId("search-hint-trigger").click();
  await page.locator('[data-tour-slug="checkout-refund-flow"]').getByTestId("favorite-toggle").click();

  await expect(page.getByTestId("browse-favorites")).toBeVisible();
  await expect(page.getByTestId("browse-favorite-row")).toContainText("Refund Flow");
});
