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

test("keeps the same Mermaid svg mounted while deep-linked steps change", async ({ page }) => {
  await page.goto("/decision-flow?step=2");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();

  const diagramInstanceId = await page
    .locator('[data-testid="diagram-container"] svg')
    .evaluate((element) => {
      const instanceId =
        element.getAttribute("data-test-instance-id") ?? globalThis.crypto.randomUUID();

      element.setAttribute("data-test-instance-id", instanceId);

      return instanceId;
    });

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/decision-flow\?step=3$/);
  await expect(page.locator('[data-testid="diagram-container"] svg')).toHaveAttribute(
    "data-test-instance-id",
    diagramInstanceId
  );
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

test("persists dark mode across reloads and direct navigation", async ({ page }) => {
  await page.goto("/payment-flow");
  await expectDiagramVisible(page);

  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

  await page.goto("/refund-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
});

test("shows a guided 404 for unknown tours and offers a single recovery action", async ({ page }) => {
  const response = await page.goto("/examples/tuvieja");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tour not found" })).toBeVisible();
  await expect(page.getByText('Unknown tour slug "examples/tuvieja".')).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Tours" })).toBeVisible();

  await page.getByRole("link", { name: "Back to Tours" }).click();

  await expect(page).toHaveURL(/\/[^/]+$/);
});

test("keeps empty-focus viewport behavior stable in the dedicated example", async ({ page }) => {
  await page.goto("/viewport-stability?step=1");
  await expectDiagramVisible(page);

  const focusedPanY = await page
    .getByTestId("diagram-container")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--diagram-pan-y").trim() || "0px"
    );

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/viewport-stability\?step=2$/);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')
  ).toHaveCount(0);

  const neutralPanY = await page
    .getByTestId("diagram-container")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--diagram-pan-y").trim() || "0px"
    );

  expect(neutralPanY).not.toBe(focusedPanY);
  expect(neutralPanY).toBe("0px");
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
