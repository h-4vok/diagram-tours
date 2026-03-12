import { expect, test } from "@playwright/test";

test("renders the docs shell and navigates between discovered examples", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByTestId("tour-navigation")).toBeVisible();
  await expect(page).toHaveURL(/\/decision-flow$/);
  await expect(page.getByRole("heading", { name: "Decision Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payment Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Refund Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Release Pipeline" })).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "represents a case entering the queue"
  );
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="request"]')).toHaveCount(1);

  await page.getByRole("link", { name: "Refund Flow" }).click();

  await expect(page).toHaveURL(/\/refund-flow$/);
  await expect(page.getByRole("heading", { name: "Refund Flow" })).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "reverse a payment"
  );

  await page.getByRole("link", { name: "Decision Flow" }).click();

  await expect(page).toHaveURL(/\/decision-flow$/);
  await expect(page.getByRole("heading", { name: "Decision Flow" })).toBeVisible();
});
