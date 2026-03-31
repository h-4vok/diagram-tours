import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("docs shell browse navigation changes tours without breaking the player", async ({ page }) => {
  await page.goto("/checkout-decision-flow?step=3");

  await expect(page.getByRole("link", { name: "diagram-tours" })).toBeVisible();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("topbar-breadcrumbs")).toContainText("Decision Flow");
  await expect(page.getByTestId("search-hint-trigger")).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible();
  await expect(page).toHaveURL(/\/checkout-decision-flow\?step=3$/);
  await page.getByTestId("search-hint-trigger").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await expect(page.getByTestId("browse-search-input")).toBeVisible();
  await expect(page.getByTestId("browse-tour-row").first()).toBeVisible();
  await expect(page.getByTestId("step-text-container")).toContainText("human or audited service");
  await expectDiagramVisible(page);
  await expect(page).toHaveURL(/\/checkout-decision-flow\?step=3$/);
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="review"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(2);
  await expect(
    page.locator('[data-testid="diagram-container"][data-focus-group-mode="group"][data-focus-group-size="2"]')
  ).toHaveCount(1);

  await page.getByTestId("browse-search-input").fill("refund");
  await expect(page.getByText("Refund Flow")).toBeVisible();
  await page.getByText("Refund Flow").click();

  await expect(page).toHaveURL(/\/checkout-refund-flow$/);
  await expect(page.getByTestId("step-text-container")).toContainText("reverse a payment");

  await page.getByTestId("search-hint-trigger").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await page.getByTestId("browse-search-input").fill("decision");
  await expect(page.getByText("Decision Flow")).toBeVisible();
  await page.getByText("Decision Flow").click();

  await expect(page).toHaveURL(/\/checkout-decision-flow$/);
  await expect(page.getByTestId("step-text")).toBeVisible();
});
