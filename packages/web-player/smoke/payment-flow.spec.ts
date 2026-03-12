import { expect, test, type Page } from "@playwright/test";

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

test("keeps connector labels readable as secondary context in a branching diagram", async ({
  page
}) => {
  await page.goto("/incident-response?step=2");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(
    page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')
  ).toHaveCount(1);
  expect(
    await page
      .locator('[data-testid="diagram-container"] [data-connector-role="label"][data-connector-state="context"]')
      .count()
  ).toBeGreaterThan(0);
});

test("keeps the diagram usable when the selected step text is long", async ({ page }) => {
  await page.goto("/incident-response?step=4");

  await expectDiagramVisible(page);

  const stepTextBox = await page.getByTestId("step-text").boundingBox();
  const diagramBox = await page.getByTestId("diagram-container").boundingBox();

  assertLayoutBox(stepTextBox);
  assertLayoutBox(diagramBox);
  expect(diagramBox.height).toBeGreaterThan(300);
  expect(diagramBox.y).toBeGreaterThan(stepTextBox.y);
});

async function expectDiagramVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
}

function assertLayoutBox(input: {
  height: number;
  width: number;
  x: number;
  y: number;
} | null): asserts input is {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  expect(input).not.toBeNull();
}
