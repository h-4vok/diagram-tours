import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("connector labels remain readable as context in a branching diagram", async ({ page }) => {
  await page.goto("/payments-platform-overview?step=3");

  await expectDiagramVisible(page);
  expect(await page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]').count()).toBeGreaterThan(0);
  expect(
    await page
      .locator('[data-testid="diagram-container"] [data-connector-role="label"][data-connector-state="context"]')
      .count()
  ).toBeGreaterThan(0);
});
