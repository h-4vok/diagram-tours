import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("theme selection persists across reloads and direct navigation", async ({ page }) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");

  await page.goto("/sequence-order-sequence");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
});
