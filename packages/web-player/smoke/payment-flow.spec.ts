import { expect, test } from "@playwright/test";

test("renders the docs shell and navigates between discovered examples", async ({
  page
}) => {
  await page.goto("/decision-flow?step=3");

  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByTestId("tour-navigation")).toBeVisible();
  await expect(page).toHaveURL(/\/decision-flow\?step=3$/);
  await expect(page.getByRole("heading", { name: "Decision Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payment Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Refund Flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Release Pipeline" })).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "human or audited service"
  );
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(page).toHaveURL(/\/decision-flow\?step=3$/);
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="review"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(2);
  await expect(
    page.locator('[data-testid="diagram-container"][data-focus-group-mode="group"][data-focus-group-size="2"]')
  ).toHaveCount(1);

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

test("repositions the viewport toward the focused area in a tall diagram", async ({
  page
}) => {
  await page.goto("/incident-response");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();

  const initialPanY = await page
    .getByTestId("diagram-container")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--diagram-pan-y").trim() || "0px"
    );

  await page.getByTestId("next-button").click();
  await page.getByTestId("next-button").click();
  await page.getByTestId("next-button").click();

  await expect(page.getByTestId("step-text")).toContainText("communication loop is done");

  const focusedPanY = await page
    .getByTestId("diagram-container")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--diagram-pan-y").trim() || "0px"
    );

  expect(focusedPanY).not.toBe(initialPanY);
});
