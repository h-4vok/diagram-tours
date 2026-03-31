import { expect, test } from "@playwright/test";
import { expectDiagramVisible, readNodeAxisSize } from "./smoke-test-helpers";

test("huge-system first step starts at a readable focus scale", async ({ page }) => {
  await page.goto("/ops-huge-system");

  await expect(page).toHaveURL(/\/ops-huge-system$/);
  await expectDiagramVisible(page);
  await expect
    .poll(async () => readNodeAxisSize(page, "edge", "width"), {
      timeout: 10_000
    })
    .toBeGreaterThan(80);
});
