import { expect, test } from "@playwright/test";
import { expectBrowseSearchMatch, openBrowse } from "./smoke-test-helpers";

test("browse search keeps long queries strict enough to avoid unrelated fuzzy matches", async ({ page }) => {
  await openBrowse(page, "/checkout-refund-flow");

  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("browse-search-input").fill("release");

  await expect(page.getByText("Release Pipeline")).toBeVisible();
  await expect(page.getByText("Parallel Onboarding")).toHaveCount(0);
  await expect(page.getByText("Huge System Stress Test")).toHaveCount(0);
  await expectBrowseSearchMatch(page, "release", "Release Pipeline");
});
