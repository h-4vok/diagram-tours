import { expect, test } from "@playwright/test";
import { expectDiagramVisible, expectFocusedNodeToStayAwayFromCanvasOrigin } from "./smoke-test-helpers";

test("step navigation keeps the focused node in the guided viewport instead of snapping toward the origin", async ({
  page
}) => {
  await page.goto("/checkout-payment-flow");
  await expectDiagramVisible(page);

  await expectFocusedNodeToStayAwayFromCanvasOrigin(page, "api_gateway");

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/checkout-payment-flow\?step=2$/);
  await expect(page.getByTestId("step-text-container")).toContainText("Validation Service");
  await expectFocusedNodeToStayAwayFromCanvasOrigin(page, "validation_service");

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/checkout-payment-flow\?step=3$/);
  await expect(page.getByTestId("step-text-container")).toContainText("Payment Service");
  await expectFocusedNodeToStayAwayFromCanvasOrigin(page, "payment_service");
});
