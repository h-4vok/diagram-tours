import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("huge-system stress fixture remains navigable across step changes", async ({ page }) => {
  await page.goto("/ops-huge-system?step=5");

  await expectDiagramVisible(page);
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="event_bus"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(4);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/ops-huge-system\?step=6$/);
  await expect(page.getByTestId("step-text-container")).toContainText("distant focus");
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="compliance"]')).toHaveCount(1);
});
