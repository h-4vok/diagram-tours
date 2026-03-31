import { expect, type Page } from "@playwright/test";

export async function expectDiagramVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
}

export async function expectDocumentWidthToMatchViewport(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    bodyClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.documentElement.scrollWidth
  }));

  expect(metrics.bodyScrollWidth).toBe(metrics.bodyClientWidth);
}

export async function expectCanvasToOwnBody(page: Page): Promise<void> {
  const canvasBox = await page.getByTestId("diagram-container").boundingBox();
  const viewport = page.viewportSize();

  assertLayoutBox(canvasBox);
  assertViewport(viewport);
  expectCanvasHeight(canvasBox, viewport);
  expectCanvasWidth(canvasBox, viewport);
}

export async function expectFocusedAreaNearViewportCenter(
  page: Page,
  nodeIds: string[],
  options: {
    thresholds?: { x: number; y: number };
    timeout?: number;
  } = {}
): Promise<void> {
  const thresholds = readCenterThresholds(options);
  const timeout = readCenterTimeout(options);

  await expect.poll(async () => readCenterDistance(page, nodeIds, "x"), { timeout }).toBeLessThan(
    thresholds.x
  );
  await expect.poll(async () => readCenterDistance(page, nodeIds, "y"), { timeout }).toBeLessThan(
    thresholds.y
  );
}

export async function expectFocusedNodeToStayAwayFromCanvasOrigin(
  page: Page,
  nodeId: string
): Promise<void> {
  await expect
    .poll(async () => readNodeOffsetFromCanvasOrigin(page, nodeId, "x"), {
      timeout: 5_000
    })
    .toBeGreaterThan(48);
  await expect
    .poll(async () => readNodeOffsetFromCanvasOrigin(page, nodeId, "y"), {
      timeout: 5_000
    })
    .toBeGreaterThan(48);
}

export async function expectCameraPanelToContainControls(page: Page): Promise<void> {
  const panelBox = await page.getByTestId("camera-control-panel").boundingBox();
  const minimapBox = await page.getByTestId("minimap-shell").boundingBox();
  const toolbarBox = await page.getByTestId("viewport-toolbar").boundingBox();

  assertLayoutBox(panelBox);
  assertLayoutBox(minimapBox);
  assertLayoutBox(toolbarBox);
  expect(minimapBox.x).toBeGreaterThanOrEqual(panelBox.x);
  expect(minimapBox.y).toBeGreaterThanOrEqual(panelBox.y);
  expect(minimapBox.x + minimapBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
  expect(toolbarBox.x).toBeGreaterThanOrEqual(panelBox.x);
  expect(toolbarBox.y).toBeGreaterThan(minimapBox.y);
  expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
}

export async function readDiagramScrollPosition(page: Page): Promise<{
  scrollLeft: number;
  scrollTop: number;
}> {
  return page.getByTestId("diagram-container").evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  }));
}

export async function readNodeAxisSize(
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

export async function openBrowse(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("search-hint-trigger").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
}

export const expectBrowseOpen = openBrowse;

export async function expectBrowseSearchMatch(
  page: Page,
  query: string,
  label: string
): Promise<void> {
  await page.getByTestId("browse-search-input").fill(query);
  await expect(readBrowsePanel(page).getByText(label, { exact: true })).toBeVisible();
}

export async function expectBrowseSearchEmpty(page: Page, query: string): Promise<void> {
  await page.getByTestId("browse-search-input").fill(query);
  await expect(page.getByTestId("browse-empty-state")).toContainText(`No tours match "${query}".`);
}

export async function expectSingleTourBrowse(
  page: Page,
  options: {
    expectedTitle: string;
    filename: string;
    unexpectedTitle: string;
  }
): Promise<void> {
  await expect(page.getByTestId("preview-target-notice")).toContainText(options.filename);
  await expect(readBrowsePanel(page).getByText(options.expectedTitle, { exact: true })).toBeVisible();
  await expect(readBrowsePanel(page).getByText(options.unexpectedTitle, { exact: true })).toHaveCount(0);
}

export function readBrowsePanel(page: Page) {
  return page.getByTestId("browse-panel");
}

function readCenterThresholds(input: {
  thresholds?: { x: number; y: number };
  timeout?: number;
}): { x: number; y: number } {
  return input.thresholds ?? { x: 180, y: 360 };
}

function readCenterTimeout(input: {
  thresholds?: { x: number; y: number };
  timeout?: number;
}): number {
  return input.timeout ?? 5_000;
}

function mergeBounds(
  input: Array<{
    height: number;
    width: number;
    x: number;
    y: number;
  }>
): {
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
  const diagramBox = await page.getByTestId("diagram-shell").boundingBox();
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
    : Math.abs(areaBounds.y + areaBounds.height / 2 - (diagramBox.y + diagramBox.height * 0.38));
}

async function readNodeOffsetFromCanvasOrigin(
  page: Page,
  nodeId: string,
  axis: "x" | "y"
): Promise<number> {
  const canvasBox = await page.getByTestId("diagram-container").boundingBox();
  const nodeBox = await page
    .locator(`[data-testid="diagram-container"] [data-node-id="${nodeId}"]`)
    .boundingBox();

  assertLayoutBox(canvasBox);
  assertLayoutBox(nodeBox);

  return axis === "x" ? nodeBox.x - canvasBox.x : nodeBox.y - canvasBox.y;
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

function assertViewport(input: {
  height: number;
  width: number;
} | null): asserts input is {
  height: number;
  width: number;
} {
  expect(input).not.toBeNull();
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
