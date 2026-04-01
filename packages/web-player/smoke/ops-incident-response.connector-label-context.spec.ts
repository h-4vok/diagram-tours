import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("connector labels remain readable as context in a branching diagram", async ({ page }) => {
  await page.goto("/ops-incident-response?step=2");

  await expectDiagramVisible(page);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(1);
  expect(
    await page
      .locator('[data-testid="diagram-container"] [data-connector-role="label"][data-connector-state="context"]')
      .count()
  ).toBeGreaterThan(0);
});
