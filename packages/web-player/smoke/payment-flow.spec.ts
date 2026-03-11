import { expect, test } from "@playwright/test";

test("renders the payment-flow diagram and navigates to another discovered tour", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByTestId("tour-navigation")).toBeVisible();
  await expect(page.getByRole("link", { name: "Payment Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Refund Flow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment Flow" })).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "The API Gateway is the public entry point"
  );
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="api_gateway"]')).toHaveCount(1);

  await page.getByRole("link", { name: "Refund Flow" }).click();

  await expect(page).toHaveURL(/\/refund-flow$/);
  await expect(page.getByRole("heading", { name: "Refund Flow" })).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "The Refund Service receives the request from Customer."
  );
});
