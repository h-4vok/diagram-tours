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

test("best-effort centers focused areas inside the padded viewport stage", async ({
  page
}) => {
  await page.goto("/viewport-centering");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expectFocusedAreaNearViewportCenter(page, ["build"]);

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text")).toContainText("Roll Out");
  await expectFocusedAreaNearViewportCenter(page, ["rollout"]);

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text")).toContainText("Verify in Staging");
  await expectFocusedAreaNearViewportCenter(page, ["verify", "observe"]);
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

test("loads and navigates the huge stress-test diagram without destabilizing the player", async ({
  page
}) => {
  await page.goto("/huge-system?step=5");

  await expect(page.getByRole("heading", { name: "Huge System Stress Test" })).toBeVisible();
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="event_bus"]')
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')
  ).toHaveCount(4);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/huge-system\?step=6$/);
  await expect(page.getByTestId("step-text")).toContainText("distant focus");
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="compliance"]')
  ).toHaveCount(1);
});

test("starts the huge stress-test tour at a readable first-focus scale", async ({ page }) => {
  await page.goto("/huge-system");

  await expect(page.getByRole("heading", { name: "Huge System Stress Test" })).toBeVisible();
  await expect(page).toHaveURL(/\/huge-system$/);
  await expectDiagramVisible(page);
  await expectFocusedAreaNearViewportCenter(page, ["edge"]);

  expect(await readNodeAxisSize(page, "edge", "width")).toBeGreaterThan(80);
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
  await page.goto("/viewport-centering?step=3");
  await expectDiagramVisible(page);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/viewport-centering\?step=4$/);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')
  ).toHaveCount(0);

  await expect.poll(async () =>
    page.getByTestId("diagram-container").evaluate((element) => element.scrollTop)
  ).toBe(0);

  const neutralScrollTop = await page
    .getByTestId("diagram-container")
    .evaluate((element) => element.scrollTop);

  expect(neutralScrollTop).toBe(0);
});

async function expectDiagramVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
}

async function expectFocusedAreaNearViewportCenter(page: Page, nodeIds: string[]): Promise<void> {
  await expect.poll(async () => readCenterDistance(page, nodeIds, "x")).toBeLessThan(180);
  await expect.poll(async () => readCenterDistance(page, nodeIds, "y")).toBeLessThan(220);
}

function mergeBounds(input: Array<{
  height: number;
  width: number;
  x: number;
  y: number;
}>): {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  const left = Math.min(...input.map((item) => item.x));
  const top = Math.min(...input.map((item) => item.y));
  const right = Math.max(...input.map((item) => item.x + item.width));
  const bottom = Math.max(...input.map((item) => item.y + item.height));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top
  };
}

async function readCenterDistance(
  page: Page,
  nodeIds: string[],
  axis: "x" | "y"
): Promise<number> {
  const diagramBox = await page.getByTestId("diagram-container").boundingBox();
  const nodeBoxes = await Promise.all(
    nodeIds.map((nodeId) =>
      page.locator(`[data-testid="diagram-container"] [data-node-id="${nodeId}"]`).boundingBox()
    )
  );

  assertLayoutBox(diagramBox);
  nodeBoxes.forEach(assertLayoutBox);

  const areaBounds = mergeBounds(nodeBoxes);

  return axis === "x"
    ? Math.abs(areaBounds.x + areaBounds.width / 2 - (diagramBox.x + diagramBox.width / 2))
    : Math.abs(areaBounds.y + areaBounds.height / 2 - (diagramBox.y + diagramBox.height / 2));
}

async function readNodeAxisSize(
  page: Page,
  nodeId: string,
  axis: "height" | "width"
): Promise<number> {
  const nodeBox = await page
    .locator(`[data-testid="diagram-container"] [data-node-id="${nodeId}"]`)
    .boundingBox();

  assertLayoutBox(nodeBox);

  return nodeBox[axis];
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
