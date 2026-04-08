import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("huge-system stress fixture remains navigable across step changes", async ({ page }) => {
  await page.goto("/payments-platform-overview?step=5");

  await expectDiagramVisible(page);
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="event_bus"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(4);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/payments-platform-overview\?step=6$/);
  await expect(page.getByTestId("step-text-container")).toContainText("Pull back");
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="compliance_exports"]')).toHaveCount(1);
});
