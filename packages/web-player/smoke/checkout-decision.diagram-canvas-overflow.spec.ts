import { expect, test } from "@playwright/test";
import { expectCanvasToOwnBody, expectDocumentWidthToMatchViewport } from "./smoke-test-helpers";

test("diagram canvas owns horizontal overflow instead of the document body", async ({ page }) => {
  await page.goto("/checkout-payment-flow");

  await expect(page.getByTestId("diagram-container")).toBeVisible();
  await expect(page.getByTestId("topbar-breadcrumbs")).toContainText("Payment Flow");

  await expectDocumentWidthToMatchViewport(page);
  await expectCanvasToOwnBody(page);
});
