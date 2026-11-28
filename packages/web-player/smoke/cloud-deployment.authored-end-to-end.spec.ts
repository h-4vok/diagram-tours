import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

const STRATEGIES = [
  {
    path: "./examples/architecture/cloud-deployment.tour.yaml",
    name: "architecture-beta",
    stepKeys: ["group-cloud", "group-region", "group-vpc", "service-api", "service-database_primary", "service-database_replica", "connection-1", "connection-5"],
    previousKey: "connection-1",
    focuses: [["group", "group-cloud", 0], ["service", "service-api", 3], ["connection", "connection-5", 7]]
  },
  {
    path: "./examples/flowchart/cloud-deployment.tour.yaml",
    name: "flowchart",
    stepKeys: ["group-cloud", "group-region", "group-network", "group-subnet", "api", "transition-gateway-to-api-routes-requests", "transition-primary-to-replica-unlabeled"],
    previousKey: "transition-gateway-to-api-routes-requests",
    focuses: [["group", "group-cloud", 0], ["node", "api", 4], ["connection", "transition-primary-to-replica-unlabeled", 6]]
  }
] as const;

const FLOWCHART_NATIVE_PATH_IDS = {
  "transition-gateway-to-api-routes-requests": "L_gateway_api_0",
  "transition-api-to-worker-queues-work": "L_api_worker_0",
  "transition-worker-to-primary-unlabeled": "L_worker_primary_0",
  "transition-primary-to-replica-unlabeled": "L_primary_replica_0"
} as const;

test("cloud deployment tours resolve real targets, styles, arrows, and both themes", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(15_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const artifactPath = resolve(process.cwd(), "../../.loopard/artifacts/issue-78");
  const measurements: Array<Record<string, unknown>> = [];
  await mkdir(artifactPath, { recursive: true });
  await page.addInitScript(() => {
    if (localStorage.getItem("diagram-tour-theme") === null) { localStorage.setItem("diagram-tour-theme", "dark"); }
  });

  for (const strategy of STRATEGIES) {
    const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}-${strategy.name}` });
    const server = await startDevServer({ args: [strategy.path], port });
    try {
      await page.goto(server.baseUrl);
      await assertRenderedTargets(page, strategy.name);
      await captureTheme(page, { artifactPath, measurements, strategy, theme: "dark" });
      await page.getByTestId("theme-toggle").click();
      await page.reload();
      await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
      await rewindTour({ page, steps: strategy.stepKeys.length });
      await captureTheme(page, { artifactPath, measurements, strategy, theme: "light" });
    } finally {
      await server.stop();
    }
  }
  await writeFile(resolve(artifactPath, "cloud-deployment-computed-styles.json"), JSON.stringify(measurements, null, 2));
});

async function assertRenderedTargets(page: Page, name: string): Promise<void> {
  const svg = page.getByTestId("diagram-container").locator("svg").first();
  await expect(svg).toBeVisible();
  if (name === "architecture-beta") {
    await expect(svg.locator(".architecture-groups #group-cloud.node-bkg")).toBeAttached();
    await expect(svg.locator(".architecture-services #service-api.architecture-service")).toBeAttached();
    await expect(svg.locator(".architecture-services #service-database_primary.architecture-service")).toBeAttached();
    await expect(svg.locator(".architecture-services #service-database_replica.architecture-service")).toBeAttached();
    await expect(svg.locator(".architecture-edges path.edge")).toHaveCount(5);
    await expect(svg.locator('[data-node-id="connection-1"] polygon.arrow')).toHaveCount(1);
    await expect(svg.locator('[data-node-id="connection-5"] polygon.arrow')).toHaveCount(2);
    await expect(svg.locator('[data-node-id="connection-5"] polygon.arrow').first()).toBeVisible();
    await expect(svg.locator('[data-node-id="connection-5"] polygon.arrow').last()).toBeVisible();
    return;
  }
  await expect(svg.locator("g.cluster > rect")).toHaveCount(4);
  await expect(svg.locator("g.node")).toHaveCount(5);
  await expect(svg.locator("g.node.azure")).toHaveCount(5);
  await expect(svg.locator(".flowchart-link")).toHaveCount(4);
  await expect(svg.locator(".flowchart-link[style*='stroke']")).toHaveCount(2);
  for (const [key, nativeId] of Object.entries(FLOWCHART_NATIVE_PATH_IDS)) {
    await expect(svg.locator(`[data-node-id="${key}"].flowchart-link`)).toHaveAttribute("id", nativeId);
  }
  await expect(svg.locator("g.node.clickable")).toHaveAttribute("title", "Azure API service details");
  const edges = await svg.locator(".flowchart-link").evaluateAll((elements) => elements.map((element) => ({
    id: element.getAttribute("data-node-id"), outerHTML: element.outerHTML,
    markerStart: element.getAttribute("marker-start"), markerEnd: element.getAttribute("marker-end"),
    style: getComputedStyle(element).cssText
  })));
  await writeFile(resolve(process.cwd(), "../../.loopard/artifacts/issue-78/flowchart-edge-dom.json"), JSON.stringify(edges, null, 2));
  await expectFlowchartOneWay(svg.locator('[data-node-id="transition-gateway-to-api-routes-requests"].flowchart-link'));
  await expectFlowchartBidirectional(svg.locator('[data-node-id="transition-primary-to-replica-unlabeled"].flowchart-link'));
}

async function expectFlowchartOneWay(path: Locator): Promise<void> {
  await expect(path).not.toHaveAttribute("marker-start");
  await expectMarker(path, "end");
}

async function expectFlowchartBidirectional(path: Locator): Promise<void> {
  await expectMarker(path, "start");
  await expectMarker(path, "end");
}

async function expectMarker(path: Locator, side: "start" | "end"): Promise<void> {
  await expect(path).toHaveAttribute(`marker-${side}`, /^url\(#.+\)$/u);
  const geometry = await path.evaluate(readMarkerGeometry, side);
  expect(geometry).not.toBe("");
}

function readMarkerGeometry(path: Element, side: "start" | "end"): string {
  const reference = path.getAttribute(`marker-${side}`)!;
  const marker = reference.slice(5, -1);
  return document.getElementById(marker)!.querySelector("path")!.getAttribute("d")!;
}

async function captureTheme(page: Page, input: {
  artifactPath: string; measurements: Array<Record<string, unknown>>; strategy: (typeof STRATEGIES)[number]; theme: string;
}): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", input.theme);
  let currentStep = 0;
  for (const [semantic, key, step] of input.strategy.focuses) {
    currentStep = await advanceToStep({ page, currentStep, destination: step, stepKeys: input.strategy.stepKeys });
    await test.step(`${input.strategy.name} ${input.theme}: ${semantic} ${key}`, () => captureFocus(page, { ...input, semantic, key }));
  }
  const finalKey = input.strategy.focuses[input.strategy.focuses.length - 1]![1];
  await page.getByTestId("previous-button").click();
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${input.strategy.previousKey}"]`).first()).toHaveAttribute("data-focus-state", "focused");
  await page.getByTestId("next-button").click();
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${finalKey}"]`).first()).toHaveAttribute("data-focus-state", "focused");
}

async function advanceToStep(input: { page: Page; currentStep: number; destination: number; stepKeys: readonly string[] }): Promise<number> {
  while (input.currentStep < input.destination) {
    await input.page.getByTestId("next-button").click();
    input.currentStep += 1;
    await expect(input.page.locator(`[data-testid="diagram-container"] [data-node-id="${input.stepKeys[input.currentStep]}"]`).first())
      .toHaveAttribute("data-focus-state", "focused");
  }
  return input.currentStep;
}

async function rewindTour(input: { page: Page; steps: number }): Promise<void> {
  for (let index = 0; index < input.steps; index += 1) {
    const previous = input.page.getByTestId("previous-button");
    if (await previous.isDisabled()) { return; }
    await previous.click();
  }
}

async function captureFocus(page: Page, input: {
  artifactPath: string; key: string; measurements: Array<Record<string, unknown>>;
  semantic: string; strategy: (typeof STRATEGIES)[number]; theme: string;
}): Promise<void> {
  const target = page.locator(`[data-testid="diagram-container"] [data-node-id="${input.key}"]`).first();
  await test.step(`wait for focused target ${input.key}`, async () => {
    await expect(target).toHaveAttribute("data-focus-state", "focused", { timeout: 8_000 });
  }, { timeout: 9_000 });
  await assertFocusedArrows(page, target, input.key);
  await page.getByTestId("teleprompter-toggle").click();
  await test.step(`adjust camera for ${input.key}`, async () => {
    await page.getByRole("button", { name: "Fit diagram to view" }).click();
    if (input.semantic === "group") { await zoomOutForGroup(page); }
    await expect(target).toBeInViewport({ ratio: 0, timeout: 8_000 });
  }, { timeout: 12_000 });
  await test.step(`settle focus styles for ${input.key}`, async () => {
    await page.waitForTimeout(450);
  }, { timeout: 2_000 });
  const snapshot = await target.evaluate(readFocusSnapshot, { key: input.key });
  const measurement = await measureFlowchartConnection({
    page, target, input, measurement: measureFocus(snapshot, { key: input.key, semantic: input.semantic, theme: input.theme })
  });
  input.measurements.push(measurement);
  await writeFile(resolve(input.artifactPath, "cloud-deployment-computed-styles.json"), JSON.stringify(input.measurements, null, 2));
  await test.step(`capture ${input.strategy.name} ${input.semantic} screenshot (${input.theme})`, async () => {
    await page.screenshot({ path: resolve(input.artifactPath, `${input.strategy.name}-${input.semantic}-${input.theme}.png`), fullPage: true, timeout: 10_000 });
  }, { timeout: 11_000 });
  expect(measurement.effectiveOpacity).toBeGreaterThan(0);
  expect(measurement.focusVisible, JSON.stringify(measurement)).toBe(true);
  if (input.semantic === "group") { expect(measurement.focusFullyVisible, JSON.stringify(measurement)).toBe(true); }
  if (measurement.textContrast !== null) { expect(measurement.textContrast, JSON.stringify(measurement)).toBeGreaterThanOrEqual(4.5); }
  expect(measurement.figureContrast).toBeGreaterThanOrEqual(3);
  expect(measurement.focusContrast).toBeGreaterThanOrEqual(3);
  await page.getByTestId("restore-teleprompter-button").click();
  await assertProviderStyle(target, input);
  await assertTooltip(target, input.key);
}

function isFlowchartConnection(input: { strategy: (typeof STRATEGIES)[number]; semantic: string }): boolean {
  return input.strategy.name === "flowchart" && input.semantic === "connection";
}

async function measureFlowchartConnection(input: {
  page: Page; target: Locator;
  input: { artifactPath: string; key: string; strategy: (typeof STRATEGIES)[number]; semantic: string; theme: string };
  measurement: ReturnType<typeof measureFocus>;
}): Promise<ReturnType<typeof measureFocus>> {
  const { page, target, measurement } = input;
  const data = input.input;
  if (!isFlowchartConnection(data)) { return measurement; }
  const raster = await readRasterFocusContrast(page, target, await page.screenshot({
    path: resolve(data.artifactPath, `flowchart-connection-${data.key}-${data.theme}-viewport.png`),
    scale: "device"
  }));
  return { ...measurement, rasterFocus: raster, figureContrast: Number(raster.contrast), focusContrast: Number(raster.contrast) };
}

async function assertFocusedArrows(page: Page, target: Locator, key: string): Promise<void> {
  if (key === "transition-primary-to-replica-unlabeled") { await expectFlowchartBidirectional(target); }
  if (key === "connection-5") {
    await expect(page.locator('[data-node-id="connection-5"] polygon.arrow')).toHaveCount(2);
  }
}

async function zoomOutForGroup(page: Page): Promise<void> {
  const button = page.getByTestId("zoom-out-button");
  for (let count = 0; count < 2; count += 1) {
    if (!(await button.isEnabled())) { return; }
    await button.click();
  }
}

async function assertProviderStyle(target: Locator, input: { key: string; strategy: (typeof STRATEGIES)[number] }): Promise<void> {
  if (input.strategy.name !== "flowchart" || input.key !== "api") { return; }
  await expect(target).toHaveClass(/azure/u);
  await expect(target.locator("rect").first()).toHaveCSS("fill", "rgb(239, 246, 255)");
}

async function assertTooltip(target: Locator, key: string): Promise<void> {
  if (key !== "api") { return; }
  await expect(target).toHaveAttribute("title", "Azure API service details");
  await target.hover();
}

function readFocusSnapshot(target: Element, data: { key: string }) {
  const targets = Array.from(document.querySelectorAll(`[data-node-id="${data.key}"]`));
  const descendants = targets.flatMap((element) => [element, ...Array.from(element.querySelectorAll("*"))]);
  const text = descendants.find((element) => ["text", "tspan", "p"].includes(element.tagName.toLowerCase())) ?? target;
  const figure = descendants.find((element) => ["path", "rect", "polygon", "line"].includes(element.tagName.toLowerCase())) ?? target;
  const svg = target.closest("svg")!;
  const theme = document.querySelector("[data-testid='theme-root']")!;
  const background = getComputedStyle(theme).getPropertyValue("--bg-base").trim();
  const shell = document.querySelector("[data-testid='diagram-shell']")!.getBoundingClientRect();
  const header = document.querySelector(".topbar")!.getBoundingClientRect();
  const viewport = { left: shell.left, right: shell.right, top: Math.max(shell.top, header.bottom), bottom: shell.bottom };
  const focusBoxes = targets.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  });
  const computed = descendants.map((element) => {
    const current = getComputedStyle(element);
    return { tag: element.tagName.toLowerCase(), color: current.color, fill: current.fill, stroke: current.stroke,
      opacity: current.opacity, fillOpacity: current.fillOpacity, strokeOpacity: current.strokeOpacity };
  });
  const textAncestors = [svg, ...Array.from(svg.querySelectorAll("*"))]
    .filter((element) => element.contains(text))
    .map((element) => ({ opacity: getComputedStyle(element).opacity }));
  const figureAncestors = [svg, ...Array.from(svg.querySelectorAll("*"))]
    .filter((element) => element.contains(figure))
    .map((element) => ({ opacity: getComputedStyle(element).opacity }));
  return {
    background, computed, focusBoxes, viewport,
    accent: getComputedStyle(theme).getPropertyValue("--accent-primary").trim(),
    text: { value: text.textContent!.trim(), visible: isVisibleText(text),
      tag: text.tagName.toLowerCase(), fill: getComputedStyle(text).fill, color: getComputedStyle(text).color,
      fillOpacity: getComputedStyle(text).fillOpacity },
    textAncestors,
    figure: { fill: getComputedStyle(figure).fill, stroke: getComputedStyle(figure).stroke,
      fillOpacity: getComputedStyle(figure).fillOpacity, strokeOpacity: getComputedStyle(figure).strokeOpacity },
    figureAncestors
  };

  function isVisibleText(element: Element): boolean {
    return Boolean(element.textContent?.trim()) && getComputedStyle(element).visibility !== "hidden";
  }
}

function measureFocus(snapshot: ReturnType<typeof readFocusSnapshot>, data: { key: string; semantic: string; theme: string }) {
  const base = snapshot.background;
  const textOpacity = readTextOpacity(snapshot.text, snapshot.textAncestors);
  const figure = readFigurePaint(snapshot.figure, snapshot.figureAncestors);
  const textBackground = snapshot.figure.fill !== "none" ? snapshot.figure.fill : base;
  return {
    ...data, ...snapshot, effectiveOpacity: Math.min(textOpacity, figure.opacity),
    focusVisible: snapshot.focusBoxes.some((box) => isVisible(box, snapshot.viewport)),
    focusFullyVisible: snapshot.focusBoxes.every((box) => isFullyVisible(box, snapshot.viewport)),
    textOpacity, figureOpacity: figure.opacity,
    textContrast: snapshot.text.visible ? contrast(readTextPaint(snapshot.text), textBackground, textOpacity) : null,
    figureContrast: contrast(figure.color, base, figure.opacity), focusContrast: contrast(snapshot.accent, base)
  };
}

async function readRasterFocusContrast(page: Page, path: Locator, screenshot: Buffer): Promise<Record<string, unknown>> {
  const probe = await path.evaluate(readFlowchartPathProbe);
  return page.evaluate(async ({ base64, line }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const focusOffsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    const adjacentOffsets = [-7, 7];
    const focusPixels = focusOffsets.map((distance) => readPixel(distance));
    const adjacentPixels = adjacentOffsets.map((distance) => readPixel(distance));
    return {
      contrast: measureRasterContrast(focusPixels, focusOffsets, adjacentPixels), focusPixels, focusOffsets,
      adjacentPixels, adjacentOffsets, strokePixel: focusPixels[4], probe: line,
      screenshotSize: { width: image.width, height: image.height }
    };

    function readPixel(distance: number): number[] {
      const x = Math.round((line.x + line.nx * distance) * line.scale);
      const y = Math.round((line.y + line.ny * distance) * line.scale);
      return Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3);
    }

    function measureRasterContrast(foregrounds: number[][], offsets: number[], backgrounds: number[][]): number {
      return Math.max(...foregrounds.map((foreground, index) => ratio(foreground, backgrounds[offsets[index]! < 0 ? 0 : 1]!)));
    }

    function ratio(first: number[], second: number[]): number {
      const levels = [luminance(first), luminance(second)].sort((left, right) => right - left);
      return Number(((levels[0]! + 0.05) / (levels[1]! + 0.05)).toFixed(2));
    }

    function luminance(channels: number[]): number {
      return channels.map((channel) => channel / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
    }
  }, { base64: screenshot.toString("base64"), line: probe });
}

function readFlowchartPathProbe(element: Element): { x: number; y: number; nx: number; ny: number; scale: number } {
  const geometry = element as SVGGeometryElement;
  const length = geometry.getTotalLength();
  const matrix = geometry.getScreenCTM()!;
  const blockers = Array.from(geometry.ownerSVGElement!.querySelectorAll(".edgeLabel foreignObject, .node"))
    .map((candidate) => candidate.getBoundingClientRect());
  const candidates = Array.from({ length: 13 }, (_, index) => (index + 1) * length / 14)
    .map((distance) => ({ distance, point: geometry.getPointAtLength(distance).matrixTransform(matrix) }))
    .filter(({ point }) => blockers.every((rect) => !containsPoint(rect, point)));
  const midpoint = { distance: length / 2, point: geometry.getPointAtLength(length / 2).matrixTransform(matrix) };
  const available = candidates.length === 0 ? [midpoint] : candidates;
  const point = available.reduce((best, candidate) => clearance(candidate.point, blockers) > clearance(best.point, blockers) ? candidate : best);
  const next = geometry.getPointAtLength(Math.min(length, point.distance + 1)).matrixTransform(matrix);
  const previous = geometry.getPointAtLength(Math.max(0, point.distance - 1)).matrixTransform(matrix);
  const magnitude = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
  return { x: point.point.x, y: point.point.y, nx: -(next.y - previous.y) / magnitude,
    ny: (next.x - previous.x) / magnitude, scale: window.devicePixelRatio };

  function containsPoint(rect: DOMRect, candidate: DOMPoint): boolean {
    const dx = Math.max(rect.left - candidate.x, 0, candidate.x - rect.right);
    const dy = Math.max(rect.top - candidate.y, 0, candidate.y - rect.bottom);
    return dx + dy === 0;
  }

  function clearance(candidate: DOMPoint, rects: DOMRect[]): number {
    return Math.min(...rects.map((rect) => Math.hypot(Math.max(rect.left - candidate.x, 0, candidate.x - rect.right), Math.max(rect.top - candidate.y, 0, candidate.y - rect.bottom))));
  }
}

function readFigurePaint(figure: ReturnType<typeof readFocusSnapshot>["figure"], ancestors: Array<{ opacity: string }>) {
  const usesStroke = figure.stroke !== "none";
  return { color: usesStroke ? figure.stroke : figure.fill,
    opacity: effectiveOpacity(ancestors) * Number(usesStroke ? figure.strokeOpacity : figure.fillOpacity) };
}

function readTextPaint(text: ReturnType<typeof readFocusSnapshot>["text"]): string {
  return ["text", "tspan"].includes(text.tag) && text.fill !== "none" ? text.fill : text.color;
}

function readTextOpacity(text: ReturnType<typeof readFocusSnapshot>["text"], ancestors: Array<{ opacity: string }>): number {
  const fillOpacity = ["text", "tspan"].includes(text.tag) ? Number(text.fillOpacity) : 1;
  return effectiveOpacity(ancestors) * fillOpacity;
}

function effectiveOpacity(ancestors: Array<{ opacity: string }>): number {
  return ancestors.map((element) => Number(element.opacity)).reduce((result, opacity) => result * opacity, 1);
}

function isVisible(box: { left: number; right: number; top: number; bottom: number }, shell: { left: number; right: number; top: number; bottom: number }): boolean {
  const visibleWidth = Math.min(box.right, shell.right) - Math.max(box.left, shell.left);
  const visibleHeight = Math.min(box.bottom, shell.bottom) - Math.max(box.top, shell.top);
  return Math.min(visibleWidth, visibleHeight) >= 0 && Math.max(box.right - box.left, box.bottom - box.top) > 0;
}

function isFullyVisible(box: { left: number; right: number; top: number; bottom: number }, viewport: { left: number; right: number; top: number; bottom: number }): boolean {
  return Math.min(box.left - viewport.left, viewport.right - box.right, box.top - viewport.top, viewport.bottom - box.bottom) >= 0;
}

function contrast(foreground: string, background: string, opacity = 1): number {
  const composite = blend(rgb(foreground), rgb(background), opacity);
  const levels = [luminance(composite), luminance(rgb(background))].sort((left, right) => right - left);
  return Number(((levels[0]! + 0.05) / (levels[1]! + 0.05)).toFixed(2));
}

function blend(foreground: number[], background: number[], opacity: number): number[] {
  return foreground.map((channel, index) => channel * opacity + background[index]! * (1 - opacity));
}

function rgb(color: string): number[] {
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/iu);
  const values = hex === null ? color.match(/[\d.]+/gu)!.slice(0, 3).map(Number) : parseHex(hex[1]!);
  return values;
}

function parseHex(digits: string): number[] {
  const expanded = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16));
}

function luminance(channels: number[]): number {
  return channels.map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
}
