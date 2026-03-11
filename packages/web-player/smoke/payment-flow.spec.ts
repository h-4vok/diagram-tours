import { expect, test } from "@playwright/test";

test("renders the payment-flow diagram and first step in the browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Payment Flow" })).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "The API Gateway is the public entry point"
  );
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="api_gateway"]')).toHaveCount(1);
});
