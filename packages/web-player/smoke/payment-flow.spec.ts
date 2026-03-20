import { expect, test, type Page } from "@playwright/test";
import { expectDevServerToFail, startDevServer } from "./dev-server";

test("docs shell browse navigation changes tours without breaking the player @core", async ({
  page
}) => {
  await page.goto("/checkout/decision-flow?step=3");

  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("tour-identity")).toContainText("Decision Flow");
  await expect(page.getByRole("button", { name: "Browse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "christianguzman.uk" })).toBeVisible();
  await expect(page).toHaveURL(/\/checkout\/decision-flow\?step=3$/);
  await page.getByTestId("tour-identity").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await expect(page.getByTestId("browse-search-input")).toBeVisible();
  await expect(page.getByTestId("browse-folder-row").first()).toBeVisible();
  await expect(page.getByTestId("step-text")).toContainText(
    "human or audited service"
  );
  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(page).toHaveURL(/\/checkout\/decision-flow\?step=3$/);
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="review"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(2);
  await expect(
    page.locator('[data-testid="diagram-container"][data-focus-group-mode="group"][data-focus-group-size="2"]')
  ).toHaveCount(1);

  await page.getByTestId("browse-search-input").fill("refund");
  await expect(page.getByText("Refund Flow")).toBeVisible();
  await page.getByText("Refund Flow").click();

  await expect(page).toHaveURL(/\/checkout\/refund-flow$/);
  await expect(page.getByTestId("step-text")).toContainText(
    "reverse a payment"
  );

  await page.getByTestId("browse-trigger").click();
  await page.getByTestId("browse-search-input").fill("decision");
  await expect(page.getByText("Decision Flow")).toBeVisible();
  await page.getByText("Decision Flow").click();

  await expect(page).toHaveURL(/\/checkout\/decision-flow$/);
  await expect(page.getByTestId("step-text")).toBeVisible();
});

test("browse search keeps long queries strict enough to avoid unrelated fuzzy matches @extended", async ({ page }) => {
  await page.goto("/checkout/refund-flow");

  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("browse-trigger")).toBeVisible();
  await page.getByTestId("browse-trigger").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
  await page.getByTestId("browse-search-input").fill("release");

  await expect(page.getByText("Release Pipeline")).toBeVisible();
  await expect(page.getByText("Parallel Onboarding")).toHaveCount(0);
  await expect(page.getByText("Huge System Stress Test")).toHaveCount(0);
});

test("diagram canvas owns horizontal overflow instead of the document body @extended", async ({
  page
}) => {
  await page.goto("/checkout/decision-flow");

  await expect(page.getByTestId("diagram-container")).toBeVisible();
  await expect(page.getByTestId("tour-identity")).toContainText("Decision Flow");

  await expectDocumentWidthToMatchViewport(page);
  await expectCanvasToOwnBody(page);
});

test("focused areas stay reasonably centered through viewport-centering examples @extended", async ({
  page
}) => {
  await page.goto("/navigation/viewport-centering");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expectFocusedAreaNearViewportCenter(page, ["build"]);

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text")).toContainText("Roll Out");
  await expectFocusedAreaNearViewportCenter(page, ["rollout"]);

  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("step-text")).toContainText("Verify in Staging");
  await expectFocusedAreaNearViewportCenter(page, ["verify", "observe"]);
});

test("deep-linked step changes reuse the same Mermaid svg @core", async ({ page }) => {
  await page.goto("/checkout/decision-flow?step=2");

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

  await expect(page).toHaveURL(/\/checkout\/decision-flow\?step=3$/);
  await expect(page.locator('[data-testid="diagram-container"] svg')).toHaveAttribute(
    "data-test-instance-id",
    diagramInstanceId
  );
});

test("huge-system stress fixture remains navigable across step changes @extended", async ({
  page
}) => {
  await page.goto("/ops/huge-system?step=5");

  await expect(page.locator('[data-testid="diagram-container"] svg')).toBeVisible();
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="event_bus"]')
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')
  ).toHaveCount(4);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/ops\/huge-system\?step=6$/);
  await expect(page.getByTestId("step-text")).toContainText("distant focus");
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="compliance"]')
  ).toHaveCount(1);
});

test("huge-system first step starts at a readable focus scale @extended", async ({ page }) => {
  await page.goto("/ops/huge-system");

  await expect(page).toHaveURL(/\/ops\/huge-system$/);
  await expectDiagramVisible(page);
  await expectFocusedAreaNearViewportCenter(page, ["edge"], {
    x: 280,
    y: 220
  });

  expect(await readNodeAxisSize(page, "edge", "width")).toBeGreaterThan(80);
});

test("connector labels remain readable as context in a branching diagram @extended", async ({
  page
}) => {
  await page.goto("/ops/incident-response?step=2");

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

test("long step text does not break the usable diagram area @extended", async ({ page }) => {
  await page.goto("/ops/incident-response?step=4");

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

test("theme selection persists across reloads and direct navigation @extended", async ({ page }) => {
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");

  await page.goto("/checkout/refund-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
});

test("first load defaults to dark mode until a preference is chosen @core", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("diagram-tour-theme");
  });
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
});

test("selected steps keep a focused-node contract while the default dark mode remains usable @extended", async ({
  page
}) => {
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="api_gateway"]')
  ).toHaveAttribute("data-focus-state", "focused");
  await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(1);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="validation_service"]')
  ).toHaveAttribute("data-step-target", "true");
});

test("unknown tours show a guided 404 with a single recovery action @extended", async ({ page }) => {
  const response = await page.goto("/examples/tuvieja");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("Diagram Tours")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tour not found" })).toBeVisible();
  await expect(page.getByText('Unknown tour slug "examples/tuvieja".')).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Tours" })).toBeVisible();

  await page.getByRole("link", { name: "Back to Tours" }).click();

  await expect(page).toHaveURL(/\/[^/]+$/);
});

test("empty-focus steps keep viewport behavior stable @extended", async ({ page }) => {
  await page.goto("/navigation/viewport-centering?step=3");
  await expectDiagramVisible(page);

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/navigation\/viewport-centering\?step=4$/);
  await expect(
    page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')
  ).toHaveCount(0);

  await expect.poll(async () =>
    page.getByTestId("diagram-container").evaluate((element) => element.scrollTop)
  ).toBeLessThanOrEqual(4);

  const neutralScrollTop = await page
    .getByTestId("diagram-container")
    .evaluate((element) => element.scrollTop);

  expect(neutralScrollTop).toBeLessThanOrEqual(4);
});

test("desktop minimap stays visible and tracks the focused step @extended", async ({ page }) => {
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-shell")).toBeVisible();
  await expect(page.getByTestId("minimap-surface")).toBeVisible();
  expect(await page.getByTestId("minimap-node-marker").count()).toBeGreaterThan(3);
  await expect(page.getByTestId("minimap-focus-marker")).toHaveCount(1);

  await page.getByTestId("timeline-step-button").nth(2).click();
  await expect(page.getByTestId("step-text")).toContainText("merchant-side transaction state");
  await expect(page.getByTestId("minimap-focus-marker")).toHaveCount(2);
});

test("zoom controls resize the active diagram and reset cleanly @extended", async ({ page }) => {
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);

  const baselineWidth = await readNodeAxisSize(page, "api_gateway", "width");

  await page.getByTestId("zoom-in-button").click();

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeGreaterThan(
    baselineWidth * 1.15
  );
  await expect(page.getByTestId("zoom-reset-button")).toContainText("125%");

  await page.getByTestId("zoom-reset-button").click();

  await expect.poll(async () => readNodeAxisSize(page, "api_gateway", "width")).toBeLessThan(
    baselineWidth * 1.05
  );
  await expect(page.getByTestId("zoom-reset-button")).toContainText("100%");
});

test("clicking the minimap pans the main diagram viewport @extended", async ({ page }) => {
  await page.goto("/ops/huge-system");
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

test("dragging the minimap viewport rectangle pans the main diagram viewport @extended", async ({ page }) => {
  await page.goto("/ops/huge-system");
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

test("clicking a node jumps directly to its matching step @core", async ({ page }) => {
  await page.goto("/checkout/refund-flow");
  await expectDiagramVisible(page);

  await page.locator('[data-testid="diagram-container"] [data-node-id="payment_gateway"]').click({
    position: {
      x: 16,
      y: 16
    }
  });

  await expect(page).toHaveURL(/\/checkout\/refund-flow\?step=2$/);
  await expect(page.getByTestId("step-text")).toContainText("Payment Gateway");
});

test("clicking a repeated node opens a chooser with matching steps @extended", async ({ page }) => {
  await page.goto("/navigation/viewport-stability");
  await expectDiagramVisible(page);

  await page.locator('[data-testid="diagram-container"] [data-node-id="review"]').click({
    position: {
      x: 16,
      y: 16
    }
  });

  await expect(page.getByTestId("node-step-chooser")).toBeVisible();
  await expect(page.getByTestId("node-step-choice")).toHaveCount(2);
  await page.getByTestId("node-step-choice").nth(1).click();

  await expect(page).toHaveURL(/\/navigation\/viewport-stability\?step=3$/);
});

test("favorites pin a starred tour above the browse tree @extended", async ({ page }) => {
  await page.goto("/checkout/refund-flow");
  await expectDiagramVisible(page);

  await page.getByTestId("browse-trigger").click();
  await page
    .locator('[data-testid="browse-tour-row"][data-tour-slug="checkout/refund-flow"]')
    .getByTestId("favorite-toggle")
    .click();

  await expect(page.getByTestId("browse-favorites")).toBeVisible();
  await expect(page.getByTestId("browse-favorite-row")).toContainText("Refund Flow");
});

test("timeline pills jump directly between steps @extended", async ({ page }) => {
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);

  await page.getByTestId("timeline-step-button").nth(2).click();

  await expect(page).toHaveURL(/\/checkout\/payment-flow\?step=3$/);
  await expect(page.getByTestId("step-text")).toContainText("merchant-side transaction state");
});

test("issues popover presents a readable diagnostics hierarchy @extended", async ({ page }) => {
  const server = await startDevServer({
    port: 4181,
    promptInputs: ["1", "n", "", ""]
  });

  try {
    await page.goto(`${server.baseUrl}/parallel-onboarding`);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");

    await expect(page.getByTestId("diagnostics-trigger")).toBeVisible();
    await page.getByTestId("diagnostics-trigger").evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    await expect(page.getByTestId("diagnostics-panel")).toBeVisible();
    await expect(page.getByTestId("diagnostics-item").first()).toContainText(".tour.yaml");
    await expect(page.getByTestId("diagnostics-item").first()).toContainText("unknown Mermaid node id");
  } finally {
    await server.stop();
  }
});

test("small screens hide the minimap automatically @extended", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 640 });
  await page.goto("/checkout/payment-flow");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("step-overlay")).toBeVisible();
  await expect(page.getByTestId("minimap-shell")).toHaveCount(0);
});

test("generated fallback tours render a minimal overview and node-by-node walkthrough @core", async ({
  page
}) => {
  const server = await startDevServer({
    args: ["./examples/checkout/payment-flow.mmd"],
    port: 4183
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text")).toContainText("Overview of Payment Flow.");

    await page.getByTestId("next-button").click();

    await expect(page.getByTestId("step-text")).toContainText("Focus on Client.");
    await expect(
      page.locator('[data-testid="diagram-container"] [data-node-id="client"]')
    ).toHaveAttribute("data-focus-state", "focused");
  } finally {
    await server.stop();
  }
});

test("authored sequence tours focus participants and messages, and sequence elements stay clickable @extended", async ({
  page
}) => {
  await page.goto("/sequence/order-sequence");
  await expectDiagramVisible(page);

  await expect(page.getByTestId("step-text")).toContainText("Customer");
  await expect(
    page.locator(
      '[data-testid="diagram-container"] [data-diagram-element-id="customer"][data-focus-state="focused"]'
    )
  ).toHaveCount(2);

  await page
    .locator('[data-testid="diagram-container"] .messageText[data-diagram-element-id="enqueue_order"]')
    .click({
      position: {
        x: 12,
        y: 12
      }
    });

  await expect(page).toHaveURL(/\/sequence\/order-sequence\?step=3$/);
  await expect(page.getByTestId("step-text")).toContainText("Enqueue fulfillment");
  await expect(
    page.locator(
      '[data-testid="diagram-container"] .messageText[data-diagram-element-id="enqueue_order"][data-focus-state="focused"], [data-testid="diagram-container"] .messageLine0[data-diagram-element-id="enqueue_order"][data-focus-state="focused"], [data-testid="diagram-container"] .messageLine1[data-diagram-element-id="enqueue_order"][data-focus-state="focused"]'
    )
  ).toHaveCount(2);

  await page
    .locator('[data-testid="diagram-container"] [data-diagram-element-id="customer"]')
    .first()
    .click({
      position: {
        x: 12,
        y: 12
      }
    });

  await expect(page).toHaveURL(/\/sequence\/order-sequence\?step=1$/);
});

test("generated fallback sequence tours include participants before tagged messages @extended", async ({
  page
}) => {
  const server = await startDevServer({
    args: ["./examples/support/support-handoff.mmd"],
    port: 4187
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text")).toContainText("Overview of Support Handoff.");

    await page.getByTestId("next-button").click();
    await expect(page.getByTestId("step-text")).toContainText("Focus on Customer.");

    const supportHandoffUrl = new URL(page.url());
    supportHandoffUrl.searchParams.set("step", "5");
    await page.goto(supportHandoffUrl.toString());
    await expect(page.getByTestId("step-text")).toContainText("Focus on Open case.");
    await expect(
      page.locator(
        '[data-testid="diagram-container"] .messageText[data-diagram-element-id="open_case"][data-focus-state="focused"], [data-testid="diagram-container"] .messageLine0[data-diagram-element-id="open_case"][data-focus-state="focused"], [data-testid="diagram-container"] .messageLine1[data-diagram-element-id="open_case"][data-focus-state="focused"]'
      )
    ).toHaveCount(2);

    supportHandoffUrl.searchParams.set("step", "6");
    await page.goto(supportHandoffUrl.toString());
    await expect(page.getByTestId("step-text")).toContainText("Focus on Handoff case.");
  } finally {
    await server.stop();
  }
});

test("markdown-backed sequence diagrams load as generated tours @extended", async ({ page }) => {
  const server = await startDevServer({
    args: ["./fixtures/markdown/sequence-checklist.md"],
    port: 4188
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text")).toContainText("Overview of Support Sequence.");

    await page.getByTestId("next-button").click();

    await expect(page.getByTestId("step-text")).toContainText("Focus on User.");
    await expect(
      page.locator(
        '[data-testid="diagram-container"] [data-diagram-element-id="user"][data-focus-state="focused"]'
      )
    ).toHaveCount(2);
  } finally {
    await server.stop();
  }
});

test("authored tours can target a markdown diagram block by fragment @extended", async ({ page }) => {
  const server = await startDevServer({
    args: ["./fixtures/markdown/checklist.tour.yaml"],
    port: 4185
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text")).toContainText("Focus on Detail.");
    await expect(
      page.locator('[data-testid="diagram-container"] [data-node-id="detail"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await expect(
      page.locator('[data-testid="diagram-container"] [data-node-id="start"]')
    ).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test("markdown files without Mermaid blocks fail cleanly before startup @extended", async () => {
  const result = await expectDevServerToFail({
    args: ["./fixtures/markdown/empty.md"],
    port: 4186
  });

  expect(result.output).toContain("does not contain any Mermaid fenced blocks");
  expect(result.output).not.toContain("[500] GET /");
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

