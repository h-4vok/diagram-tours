import { expect, test, type Page } from "@playwright/test";

test("docs shell browse navigation changes tours without breaking the player", async ({
  page
}) => {
  await page.goto("/decision-flow?step=3");

  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("tour-identity")).toContainText("Decision Flow");
  await expect(page.getByRole("button", { name: "Browse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "christianguzman.uk" })).toBeVisible();
  await expect(page).toHaveURL(/\/decision-flow\?step=3$/);
  await page.getByTestId("tour-identity").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await expect(page.getByTestId("browse-search-input")).toBeVisible();
  await expect(page.getByTestId("browse-folder-row").first()).toBeVisible();
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

  await page.getByTestId("browse-search-input").fill("refund");
  await expect(page.getByText("Refund Flow")).toBeVisible();
  await page.getByText("Refund Flow").click();

  await expect(page).toHaveURL(/\/refund-flow$/);
  await expect(page.getByTestId("step-text")).toContainText(
    "reverse a payment"
  );

  await page.getByTestId("browse-trigger").click();
  await page.getByTestId("browse-search-input").fill("decision");
  await expect(page.getByText("Decision Flow")).toBeVisible();
  await page.getByText("Decision Flow").click();

  await expect(page).toHaveURL(/\/decision-flow$/);
  await expect(page.getByTestId("step-text")).toBeVisible();
});

test("browse search keeps long queries strict enough to avoid unrelated fuzzy matches", async ({ page }) => {
  await page.goto("/refund-flow");

  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("browse-trigger")).toBeVisible();
  await page.getByTestId("browse-trigger").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await page.getByTestId("browse-search-input").fill("release");

  await expect(page.getByText("Release Pipeline")).toBeVisible();
  await expect(page.getByText("Parallel Onboarding")).toHaveCount(0);
  await expect(page.getByText("Huge System Stress Test")).toHaveCount(0);
});

test("diagram canvas owns horizontal overflow instead of the document body", async ({
  page
}) => {
  await page.goto("/decision-flow");

  await expect(page.getByTestId("diagram-container")).toBeVisible();
  await expect(page.getByTestId("tour-identity")).toContainText("Decision Flow");

  await expectDocumentWidthToMatchViewport(page);
  await expectCanvasToOwnBody(page);
});

test("focused areas stay reasonably centered through viewport-centering examples", async ({
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

test("deep-linked step changes reuse the same Mermaid svg", async ({ page }) => {
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

test("huge-system stress fixture remains navigable across step changes", async ({
  page
}) => {
  await page.goto("/huge-system?step=5");

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

test("huge-system first step starts at a readable focus scale", async ({ page }) => {
  await page.goto("/huge-system");

  await expect(page).toHaveURL(/\/huge-system$/);
  await expectDiagramVisible(page);
  await expectFocusedAreaNearViewportCenter(page, ["edge"], {
    x: 280,
    y: 220
  });

  expect(await readNodeAxisSize(page, "edge", "width")).toBeGreaterThan(80);
});

test("connector labels remain readable as context in a branching diagram", async ({
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

test("long step text does not break the usable diagram area", async ({ page }) => {
  await page.goto("/incident-response?step=4");

  await expectDiagramVisible(page);

  const stepTextBox = await page.getByTestId("step-text").boundingBox();
  const diagramBox = await page.getByTestId("diagram-container").boundingBox();
  const overlayBox = await page.getByTestId("step-overlay").boundingBox();

  assertLayoutBox(stepTextBox);
  assertLayoutBox(diagramBox);
  assertLayoutBox(overlayBox);
  expect(diagramBox.height).toBeGreaterThan(300);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(diagramBox.y + diagramBox.height);
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(diagramBox.x + diagramBox.width);
});

test("dark mode persists across reloads and direct navigation", async ({ page }) => {
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

test("unknown tours show a guided 404 with a single recovery action", async ({ page }) => {
  const response = await page.goto("/examples/tuvieja");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tour not found" })).toBeVisible();
  await expect(page.getByText('Unknown tour slug "examples/tuvieja".')).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Tours" })).toBeVisible();

  await page.getByRole("link", { name: "Back to Tours" }).click();

  await expect(page).toHaveURL(/\/[^/]+$/);
});

test("empty-focus steps keep viewport behavior stable", async ({ page }) => {
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

test("desktop minimap stays visible and tracks the focused step", async ({ page }) => {
  await page.goto("/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-shell")).toBeVisible();
  await expect(page.getByTestId("minimap-surface")).toBeVisible();
  expect(await page.getByTestId("minimap-node-marker").count()).toBeGreaterThan(3);
  await expect(page.getByTestId("minimap-focus-marker")).toHaveCount(1);

  const initialMarkerStyle = await page.getByTestId("minimap-focus-marker").getAttribute("style");

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text")).toContainText("Validation Service");
  await expect
    .poll(async () => page.getByTestId("minimap-focus-marker").getAttribute("style"))
    .not.toBe(initialMarkerStyle);
});

test("clicking the minimap pans the main diagram viewport", async ({ page }) => {
  await page.goto("/huge-system");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-surface")).toBeVisible();

  const previousScroll = await readDiagramScrollPosition(page);
  const minimapBox = await page.getByTestId("minimap-surface").boundingBox();

  assertLayoutBox(minimapBox);
  await page.getByTestId("minimap-surface").click({
    position: {
      x: minimapBox.width - 10,
      y: minimapBox.height - 10
    }
  });

  await expect.poll(async () => readDiagramScrollPosition(page)).not.toEqual(previousScroll);
});

test("dragging the minimap viewport rectangle pans the main diagram viewport", async ({ page }) => {
  await page.goto("/huge-system");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-viewport-rect")).toBeVisible();

  const previousScroll = await readDiagramScrollPosition(page);
  const viewportRectBox = await page.getByTestId("minimap-viewport-rect").boundingBox();

  assertLayoutBox(viewportRectBox);
  await page.mouse.move(viewportRectBox.x + viewportRectBox.width / 2, viewportRectBox.y + viewportRectBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewportRectBox.x + viewportRectBox.width / 2 + 36, viewportRectBox.y + viewportRectBox.height / 2 + 24, {
    steps: 4
  });
  await page.mouse.up();

  await expect.poll(async () => readDiagramScrollPosition(page)).not.toEqual(previousScroll);
});

test("small screens hide the minimap automatically", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 640 });
  await page.goto("/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("step-overlay")).toBeVisible();
  await expect(page.getByTestId("minimap-shell")).toHaveCount(0);
});

async function expectDiagramVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
}

async function expectDocumentWidthToMatchViewport(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    bodyClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.documentElement.scrollWidth
  }));

  expect(metrics.bodyScrollWidth).toBe(metrics.bodyClientWidth);
}

async function expectCanvasToOwnBody(page: Page): Promise<void> {
  const canvasBox = await page.getByTestId("diagram-container").boundingBox();
  const viewport = page.viewportSize();

  assertLayoutBox(canvasBox);
  assertViewport(viewport);
  expectCanvasHeight(canvasBox, viewport);
  expectCanvasWidth(canvasBox, viewport);
}

function assertViewport(input: {
  height: number;
  width: number;
} | null): asserts input is {
  height: number;
  width: number;
} {
  expect(input).not.toBeNull();
}

function expectCanvasHeight(
  canvasBox: {
    height: number;
    width: number;
    x: number;
    y: number;
  },
  viewport: {
    height: number;
    width: number;
  }
): void {
  expect(canvasBox.height).toBeGreaterThan(viewport.height * 0.6);
}

function expectCanvasWidth(
  canvasBox: {
    height: number;
    width: number;
    x: number;
    y: number;
  },
  viewport: {
    height: number;
    width: number;
  }
): void {
  expect(canvasBox.width).toBeGreaterThan(viewport.width * 0.9);
}

async function expectFocusedAreaNearViewportCenter(
  page: Page,
  nodeIds: string[],
  thresholds: { x: number; y: number } = {
    x: 180,
    y: 220
  }
): Promise<void> {
  await expect.poll(async () => readCenterDistance(page, nodeIds, "x")).toBeLessThan(thresholds.x);
  await expect.poll(async () => readCenterDistance(page, nodeIds, "y")).toBeLessThan(thresholds.y);
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

async function readDiagramScrollPosition(page: Page): Promise<{
  scrollLeft: number;
  scrollTop: number;
}> {
  return page.getByTestId("diagram-container").evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  }));
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
