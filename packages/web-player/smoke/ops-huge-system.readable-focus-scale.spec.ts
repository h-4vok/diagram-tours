import { expect, test } from "@playwright/test";
import { expectDiagramVisible, readNodeAxisSize } from "./smoke-test-helpers";

test("huge-system first step starts at a readable focus scale", async ({ page }) => {
  await page.goto("/payments-platform-overview");

  await expect(page).toHaveURL(/\/payments-platform-overview$/);
  await expectDiagramVisible(page);
  await expect
    .poll(async () => readNodeAxisSize(page, "edge_gateway", "width"), {
      timeout: 10_000
    })
    .toBeGreaterThan(80);
});
