import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

const FOCI = [
  ["group", "group-platform", 2, 0],
  ["node", "api", 1, 3],
  ["connection", "transition-api-to-worker-dispatches", 2, 4],
  ["connection", "transition-api-to-database-unlabeled", 1, 5],
  ["connection", "transition-worker-to-cache-reads", 2, 6],
  ["connection", "transition-cache-to-database-unlabeled", 1, 7],
  ["connection", "transition-cache-to-api-unlabeled", 1, 8],
  ["connection", "transition-database-to-audit-unlabeled", 1, 9],
  ["connection", "transition-audit-to-worker-unlabeled", 1, 9]
] as const;

test("Flowchart component groups, nodes, and connectors focus in both themes", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/flowchart/component-platform.tour.yaml"], port });
  const artifactPath = resolve(process.cwd(), "../../.loopard/artifacts/issue-76");
  const fixturePath = await mkdtemp(resolve(tmpdir(), "diagram-tours-flowchart-fixtures-"));
  const measurements: Array<Record<string, unknown>> = [];
  await mkdir(artifactPath, { recursive: true });

  try {
    await page.addInitScript(() => {
      if (localStorage.getItem("diagram-tour-theme") === null) { localStorage.setItem("diagram-tour-theme", "dark"); }
    });
    await page.goto(server.baseUrl);
    await assertActualMermaidSvg(page, artifactPath);
    const derivedGroup = page.locator('[data-testid="diagram-container"] [data-node-id="group-platform-persistence"]');
    await expect(derivedGroup).toHaveCount(2);
    await expect(derivedGroup.filter({ hasText: "Persistence" }).first()).toBeAttached();
    await captureTheme(page, { artifactPath, measurements, theme: "dark" });
    await page.getByTestId("theme-toggle").click();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await assertExplicitSubgraphIdFocus({ artifactPath, fixturePath, page, workerIndex: testInfo.workerIndex });
    await page.goto(server.baseUrl);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await captureTheme(page, { artifactPath, measurements, theme: "light" });
    await writeFile(resolve(artifactPath, "flowchart-component-computed-styles.json"), JSON.stringify(measurements, null, 2));
  } finally {
    await server.stop();
    await rm(fixturePath, { recursive: true, force: true });
  }
});

async function assertActualMermaidSvg(page: Page, artifactPath: string): Promise<Record<string, unknown>> {
  const svg = page.getByTestId("diagram-container").locator("svg").first();
  await expect(svg).toBeVisible();
  const probe = await svg.evaluate((element) => ({
    clusters: Array.from(element.querySelectorAll("g.cluster"), (cluster) => ({
      id: cluster.getAttribute("id"),
      label: cluster.querySelector(".cluster-label")?.textContent?.trim(),
      directChildren: Array.from(cluster.children, (child) => `${child.tagName.toLowerCase()}.${child.getAttribute("class") ?? ""}`)
    })),
    nodes: Array.from(element.querySelectorAll("g.node"), (node) => ({
      id: node.getAttribute("id"), className: node.getAttribute("class"),
      titles: Array.from(node.querySelectorAll("title"), (title) => title.textContent),
      links: Array.from(node.querySelectorAll("a"), (link) => ({ href: link.getAttribute("href"), xlinkHref: link.getAttributeNS("http://www.w3.org/1999/xlink", "href"), title: link.getAttribute("title") })),
      markup: node.classList.contains("clickable") ? node.outerHTML.slice(0, 1800) : ""
    })),
    edges: Array.from(element.querySelectorAll(".flowchart-link"), (edge) => ({ id: edge.getAttribute("id"), dataId: edge.getAttribute("data-id"), className: edge.getAttribute("class") })),
    edgeLabels: Array.from(element.querySelectorAll(".edgeLabel"), (label) => ({
      tagName: label.tagName.toLowerCase(), id: label.getAttribute("id"), dataId: label.getAttribute("data-id"),
      text: label.textContent?.trim(), descendants: Array.from(label.querySelectorAll("[id], [data-id]"), (child) => ({
        id: child.getAttribute("id"), dataId: child.getAttribute("data-id"), tagName: child.tagName.toLowerCase()
      }))
    }))
  }));
  await writeFile(resolve(artifactPath, "flowchart-component-mermaid-dom.json"), JSON.stringify(probe, null, 2));
  await expect(svg.locator("g.cluster > rect")).toHaveCount(3);
  await expect(svg.locator("g.cluster > .cluster-label")).toHaveCount(3);
  await expect(svg.locator("g.node")).toHaveCount(5);
  await expect(svg.locator(".flowchart-link")).toHaveCount(7);
  await expect(svg.locator(".edgeLabel")).toHaveCount(14);
  await expect(svg.locator(".flowchart-link[data-node-id]")).toHaveCount(7);
  for (const [key, nativeId, label] of [
    ["transition-api-to-worker-dispatches", "L_api_worker_0", "dispatches"],
    ["transition-api-to-database-unlabeled", "L_api_database_0"],
    ["transition-worker-to-cache-reads", "L_worker_cache_0", "reads"],
    ["transition-cache-to-database-unlabeled", "L_cache_database_0"],
    ["transition-cache-to-api-unlabeled", "L_cache_api_0"],
    ["transition-database-to-audit-unlabeled", "L_database_audit_0"],
    ["transition-audit-to-worker-unlabeled", "L_audit_worker_0"]
  ]) {
    await expect(svg.locator(`.flowchart-link[id="${nativeId}"][data-node-id="${key}"]`)).toHaveCount(1);
    if (label !== undefined) {
      const labelTarget = svg.locator(`.edgeLabel[data-node-id="${key}"]`);
      await expect(labelTarget).toContainText(label);
      await expect(labelTarget.locator(`[data-id="${nativeId}"]`)).toHaveCount(1);
    }
  }
  await expect(svg.locator(".edgeLabel[data-node-id]")).toHaveCount(2);
  await expect(svg.locator("g.node.provider")).toHaveCount(2);
  await expect(svg.locator(".flowchart-link[style*='stroke']")).toHaveCount(3);
  await expect(svg.locator("g.node.clickable")).toHaveCount(1);
  await expect(svg.locator("g.node.clickable")).toHaveAttribute("title", "API component details");
  return probe;
}

async function assertExplicitSubgraphIdFocus(input: { artifactPath: string; fixturePath: string; page: Page; workerIndex: number }): Promise<void> {
  const diagramPath = resolve(input.fixturePath, "explicit-subgraph-ids.mmd");
  const tourPath = resolve(input.fixturePath, "explicit-subgraph-ids.tour.yaml");
  await writeFile(diagramPath, [
    "flowchart LR", "subgraph _region[Region]", "subgraph 123[Numeric]", "A[Node A] --> B[Node B]", "end", "end",
    "subgraph géo [Area]", "C[Node C] --> D[Node D]", "end"
  ].join("\n"));
  await writeFile(tourPath, ["version: 1", "title: Explicit subgraph IDs", "diagram: ./explicit-subgraph-ids.mmd", "steps:",
    "  - focus: [group-_region]", "    text: Focus the underscore region.",
    "  - focus: [group-123]", "    text: Focus the numeric nested region.",
    "  - focus: [group-géo]", "    text: Focus the Unicode region."].join("\n"));
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${input.workerIndex}-explicit-subgraph-ids` });
  const server = await startDevServer({ args: [tourPath], port });
  try {
    await input.page.goto(server.baseUrl);
    await expect(input.page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await captureExplicitGroup({ ...input, key: "group-_region", nativeId: "_region", semantic: "underscore", theme: "dark" });
    await input.page.getByTestId("next-button").click();
    await captureExplicitGroup({ ...input, key: "group-123", nativeId: "123", semantic: "numeric", theme: "dark" });
    await input.page.getByTestId("next-button").click();
    await captureExplicitGroup({ ...input, key: "group-géo", nativeId: "géo", semantic: "unicode", theme: "dark" });
    await input.page.getByTestId("theme-toggle").click();
    await expect(input.page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await captureExplicitGroup({ ...input, key: "group-géo", nativeId: "géo", semantic: "unicode", theme: "light" });
    await input.page.getByTestId("previous-button").click();
    await captureExplicitGroup({ ...input, key: "group-123", nativeId: "123", semantic: "numeric", theme: "light" });
    await input.page.getByTestId("previous-button").click();
    await captureExplicitGroup({ ...input, key: "group-_region", nativeId: "_region", semantic: "underscore", theme: "light" });
    await input.page.reload();
    await expect(input.page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await assertExplicitGroupTarget(input.page, "_region", "group-_region");
  } finally {
    await server.stop();
  }
}

async function captureExplicitGroup(input: {
  artifactPath: string; key: string; nativeId: string; page: Page; semantic: string; theme: string;
  workerIndex: number;
}): Promise<void> {
  await expect(input.page.getByTestId("theme-root")).toHaveAttribute("data-theme", input.theme);
  await assertExplicitGroupTarget(input.page, input.nativeId, input.key);
  await input.page.screenshot({ path: resolve(input.artifactPath, `flowchart-subgraph-${input.semantic}-${input.theme}.png`), fullPage: true });
}

async function assertExplicitGroupTarget(page: Page, nativeId: string, key: string): Promise<void> {
  const svg = page.locator(".diagram svg");
  const cluster = svg.locator(`g.cluster[id="${nativeId}"]`);
  const boundary = cluster.locator(`:scope > rect[data-node-id="${key}"]`);
  const label = cluster.locator(`:scope > .cluster-label[data-node-id="${key}"]`);
  await expect(boundary).toHaveCount(1);
  await expect(label).toHaveCount(1);
  await expect(boundary).toHaveAttribute("data-focus-state", "focused");
  await expect(label).toHaveAttribute("data-focus-state", "focused");
}

async function captureTheme(page: Page, input: { artifactPath: string; measurements: Array<Record<string, unknown>>; theme: string }): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", input.theme);
  const progress = { currentStep: 0 };
  for (const [semantic, key, count, stepIndex] of FOCI) {
    await captureFocus(page, { artifactPath: input.artifactPath, measurements: input.measurements, progress, semantic, key, count, stepIndex, theme: input.theme });
  }
  await page.getByTestId("previous-button").click();
  progress.currentStep -= 1;
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${FOCI[3]![1]}"]`).first()).toHaveAttribute("data-focus-state", "dimmed");
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="transition-cache-to-api-unlabeled"]').first())
    .toHaveAttribute("data-focus-state", "focused");
  while (progress.currentStep > 0) {
    await page.getByTestId("previous-button").click();
    progress.currentStep -= 1;
  }
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${FOCI[0]![1]}"]`).first()).toHaveAttribute("data-focus-state", "focused");
}

async function captureFocus(page: Page, input: {
  artifactPath: string; count: number; key: string; measurements: Array<Record<string, unknown>>;
  progress: { currentStep: number }; semantic: string; stepIndex: number; theme: string;
}): Promise<void> {
  while (input.progress.currentStep < input.stepIndex) {
    await page.getByTestId("next-button").click();
    input.progress.currentStep += 1;
  }
  const targets = page.locator(`[data-testid="diagram-container"] [data-node-id="${input.key}"]`);
  await expect(targets).toHaveCount(input.count);
  await expect.poll(() => targets.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-focus-state"))))
    .toEqual(Array.from({ length: input.count }, () => "focused"));
  await page.getByTestId("teleprompter-toggle").click();
  await page.getByRole("button", { name: "Fit diagram to view" }).click();
  await zoomFocusedGroup(page, input.semantic);
  await page.waitForTimeout(500);
  const measurement = await readMeasurement(page, { key: input.key, semantic: input.semantic, theme: input.theme });
  const raster = await readRasterFocusContrast(page, input.key, await page.screenshot({
    path: resolve(input.artifactPath, `flowchart-component-${input.semantic}-${input.theme}-viewport.png`),
    scale: "device"
  }));
  measurement.rasterFocus = raster;
  measurement.figureContrast = raster.contrast;
  measurement.focusContrast = raster.contrast;
  input.measurements.push(measurement);
  await writeFile(resolve(input.artifactPath, "flowchart-component-computed-styles.json"), JSON.stringify(input.measurements, null, 2));
  assertTextContrast(measurement.textContrast);
  expect(measurement.figureContrast).toBeGreaterThanOrEqual(3);
  expect(measurement.focusContrast).toBeGreaterThanOrEqual(3);
  expect(measurement.focusVisible).toBe(true);
  expect(measurement.effectiveOpacity).toBe(1);
  await page.screenshot({ path: resolve(input.artifactPath, `flowchart-component-${input.semantic}-${input.theme}.png`), fullPage: true });
  await page.getByTestId("restore-teleprompter-button").click();
}

async function readRasterFocusContrast(page: Page, key: string, screenshot: Buffer): Promise<{
  contrast: number; focusPixels: number[][]; focusOffsets: number[]; adjacentPixels: number[][]; adjacentOffsets: number[];
  strokePixel: number[];
  probe: { x: number; y: number; nx: number; ny: number; scale: number }; screenshotSize: { width: number; height: number };
}> {
  const probe = await page.locator(`[data-testid="diagram-container"] [data-node-id="${key}"]`).first().evaluate(readFocusProbe);
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
    const focusPixels = focusOffsets.map((distance) => readPixel({ context, image, line, distance }));
    const adjacentPixels = adjacentOffsets.map((distance) => readPixel({ context, image, line, distance }));
    return {
      contrast: measureRasterContrast(focusPixels, focusOffsets, adjacentPixels), focusPixels, focusOffsets, adjacentPixels, adjacentOffsets,
      strokePixel: focusPixels[4],
      probe: line, screenshotSize: { width: image.width, height: image.height }
    };

    function readPixel(input: { context: CanvasRenderingContext2D; image: HTMLImageElement; line: typeof line; distance: number }): number[] {
      const { context, image, line, distance } = input;
      const x = Math.max(0, Math.min(image.width - 1, Math.round((line.x + line.nx * distance) * line.scale)));
      const y = Math.max(0, Math.min(image.height - 1, Math.round((line.y + line.ny * distance) * line.scale)));
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

function readFocusProbe(element: Element): { x: number; y: number; nx: number; ny: number; scale: number } {
  return element.matches("g.cluster > rect")
    ? readClusterBoundaryProbe()
    : readGeometryProbe();

  function readClusterBoundaryProbe(): { x: number; y: number; nx: number; ny: number; scale: number } {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top, nx: 0, ny: 1, scale: window.devicePixelRatio };
  }

  function readGeometryProbe(): { x: number; y: number; nx: number; ny: number; scale: number } {
    return readSvgGeometryProbe(element as SVGGeometryElement);
  }

  function readSvgGeometryProbe(geometry: SVGGeometryElement): { x: number; y: number; nx: number; ny: number; scale: number } {
  if (typeof geometry.getTotalLength !== "function") {
    const box = geometry.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, nx: 0, ny: 1, scale: window.devicePixelRatio };
  }
  const length = geometry.getTotalLength();
  const matrix = geometry.getScreenCTM()!;
  const point = findUncoveredPathPoint(geometry, length, matrix);
  const next = geometry.getPointAtLength(Math.min(length, point.distance + 1)).matrixTransform(matrix);
  const previous = geometry.getPointAtLength(Math.max(0, point.distance - 1)).matrixTransform(matrix);
  const midpoint = point.point;
  const magnitude = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
  return { x: midpoint.x, y: midpoint.y, nx: -(next.y - previous.y) / magnitude, ny: (next.x - previous.x) / magnitude, scale: window.devicePixelRatio };
  }

  function findUncoveredPathPoint(geometry: SVGGeometryElement, length: number, matrix: DOMMatrix): { point: DOMPoint; distance: number } {
    const blockers = Array.from(geometry.ownerSVGElement!.querySelectorAll(".edgeLabel foreignObject, .node"))
      .map((element) => element.getBoundingClientRect());
    const candidates = Array.from({ length: 13 }, (_, index) => (index + 1) * length / 14)
      .map((distance) => ({ distance, point: geometry.getPointAtLength(distance).matrixTransform(matrix) }))
      .filter(({ point }) => blockers.every((rect) => !contains(rect, point)));
    return candidates.reduce((best, candidate) => clearance(candidate.point, blockers) > clearance(best.point, blockers) ? candidate : best);
  }

  function contains(rect: DOMRect, point: DOMPoint): boolean {
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
    const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
    return dx + dy === 0;
  }

  function clearance(point: DOMPoint, blockers: DOMRect[]): number {
    return Math.min(...blockers.map((rect) => Math.hypot(Math.max(rect.left - point.x, 0, point.x - rect.right), Math.max(rect.top - point.y, 0, point.y - rect.bottom))));
  }
}

async function zoomFocusedGroup(page: Page, semantic: string): Promise<void> {
  if (semantic === "group") { await page.getByTestId("zoom-out-button").click(); }
}

function assertTextContrast(value: number | null): void {
  if (value !== null) { expect(value).toBeGreaterThanOrEqual(4.5); }
}

async function readMeasurement(page: Page, input: { key: string; semantic: string; theme: string }): Promise<{
  background: string; computed: Array<Record<string, string>>; effectiveOpacity: number;
  figureContrast: number; figureFillContrast: number | null; focusContrast: number; focusVisible: boolean; textContrast: number | null;
}> {
  const target = page.locator(`[data-testid="diagram-container"] [data-node-id="${input.key}"]`).first();
  return target.evaluate(readFocusedMeasurement, input);
}

function readFocusedMeasurement(target: Element, data: { key: string; semantic: string; theme: string }) {
  const targets = Array.from(document.querySelectorAll(`[data-node-id="${data.key}"]`));
  const elements = targets.flatMap((parent) => [parent, ...Array.from(parent.querySelectorAll("*"))]);
  const text = elements.find(isVisibleDiagramText);
  const figure = elements.find((element) => ["path", "rect", "polygon", "line"].includes(element.tagName.toLowerCase()));
  const targetStyle = getComputedStyle(target);
  const root = document.querySelector("[data-testid='theme-root']")!;
  const background = getComputedStyle(root).getPropertyValue("--bg-base").trim();
  const computed = elements.map(readStyles);
  const shell = document.querySelector("[data-testid='diagram-container']")!.getBoundingClientRect();
  const boxes = targets.map((element) => element.getBoundingClientRect());
  const focusVisible = boxes.every((box) => isFocusBoxVisible(box, shell));
  const figureFill = readFigureFill(figure, targetStyle);
  const surface = readCompositedBackdrop(figure, background);
  const figureOpacity = figure === undefined ? 1 : readEffectiveOpacity(figure) * readFigureOpacity(figure);
  const textSurface = readTextSurfaceFor(text, background);
  return {
    ...data, background, surface, computed, focusVisible,
    focusBounds: boxes.map((box) => ({ x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom })),
    diagramViewport: { x: shell.x, y: shell.y, width: shell.width, height: shell.height, right: shell.right, bottom: shell.bottom },
    effectiveOpacity: Math.min(...elements.map(readEffectiveOpacity)),
    textContrast: readMeasurementTextContrast(text, targetStyle, textSurface),
    figureContrast: contrastRatio(readFigureColor(figure, targetStyle), surface, figureOpacity),
    figureFillContrast: isTransparentFill(figureFill) ? null : contrastRatio(figureFill, surface, figureOpacity),
    focusContrast: contrastRatio(readFigureColor(figure, targetStyle), surface, figureOpacity)
  };

  function readTextColor(textElement: Element | undefined, styles: CSSStyleDeclaration): string {
    if (textElement === undefined) { return styles.color; }
    const textStyle = getComputedStyle(textElement);
    return isSvgTextElement(textElement) ? textStyle.fill : textStyle.color;
  }

  function isDiagramText(element: Element): boolean {
    return isSvgTextElement(element) || element.classList.contains("nodeLabel") ||
      isVisibleEdgeLabelText(element);
  }

  function isVisibleEdgeLabelText(element: Element): boolean {
    return element.matches(".edgeLabel span, .edgeLabel p") && hasVisibleText(element);
  }

  function isVisibleDiagramText(element: Element): boolean {
    return isDiagramText(element) && hasVisibleText(element) && hasVisibleStyles(element);
  }

  function hasVisibleText(element: Element): boolean {
    return Boolean(element.textContent?.trim());
  }

  function hasVisibleStyles(element: Element): boolean {
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && readEffectiveOpacity(element) > 0;
  }

  function readTextContrast(element: Element | undefined, styles: CSSStyleDeclaration, surface: string): number | null {
    return element === undefined ? null : contrastRatio(readTextColor(element, styles), surface);
  }

  function readMeasurementTextContrast(element: Element | undefined, styles: CSSStyleDeclaration, surface: string): number | null {
    return readTextContrast(element, element === undefined ? styles : getComputedStyle(element), surface);
  }

  function isSvgTextElement(element: Element): boolean {
    return ["text", "tspan"].includes(element.tagName.toLowerCase());
  }

  function readCompositedBackdrop(element: Element | undefined, fallback: string): string {
    if (element === undefined) { return fallback; }
    const box = element.getBoundingClientRect();
    const point = { x: box.left + box.width / 2, y: readBackdropY(element, box) };
    const layers = Array.from(element.closest("svg")!.querySelectorAll("g.cluster > rect"))
      .filter((rect) => containsPoint(rect.getBoundingClientRect(), point))
      .sort((left, right) => area(right.getBoundingClientRect()) - area(left.getBoundingClientRect()));
    return layers.reduce((surface, rect) => {
      const style = getComputedStyle(rect);
      return blendColor(style.fill, surface, readEffectiveOpacity(rect) * Number(style.fillOpacity));
    }, fallback);
  }

  function readBackdropY(element: Element, box: DOMRect): number {
    return element.matches("g.cluster > rect") ? box.top - 1 : box.top + box.height / 2;
  }

  function readTextSurface(input: { element: Element | undefined; fill: string; styles: CSSStyleDeclaration; backdrop: string }): string {
    const { element, fill, styles, backdrop } = input;
    if (element === undefined || isTransparentFill(fill)) { return backdrop; }
    const opacity = readEffectiveOpacity(element) * Number(styles.fillOpacity);
    return blendColor(fill, backdrop, opacity);
  }

  function readTextSurfaceFor(element: Element | undefined, fallback: string): string {
    if (element === undefined) { return fallback; }
    return readTextSurfaceFromElement(readTextSurfaceElement(element), fallback);
  }

  function readTextSurfaceElement(element: Element): Element {
    return element.closest(".edgeLabel")?.querySelector("rect") ?? element;
  }

  function readTextSurfaceFromElement(surfaceElement: Element, fallback: string): string {
    const styles = getComputedStyle(surfaceElement);
    const fill = readTextSurfaceFill(surfaceElement, styles);
    return readTextSurface({ element: surfaceElement, fill, styles, backdrop: readCompositedBackdrop(surfaceElement, fallback) });
  }

  function readTextSurfaceFill(element: Element, styles: CSSStyleDeclaration): string {
    return element.tagName.toLowerCase() === "rect" ? styles.fill : styles.backgroundColor;
  }

  function containsPoint(box: DOMRect, point: { x: number; y: number }): boolean {
    return isBetween(point.x, box.left, box.right) && isBetween(point.y, box.top, box.bottom);
  }

  function isBetween(value: number, minimum: number, maximum: number): boolean {
    return value >= minimum && value <= maximum;
  }

  function area(box: DOMRect): number { return box.width * box.height; }

  function blendColor(foreground: string, background: string, opacity: number): string {
    const first = readColorChannels(foreground);
    const second = readColorChannels(background);
    return `rgb(${first.map((channel, index) => Math.round(channel * opacity + second[index]! * (1 - opacity))).join(", ")})`;
  }

  function readFigureOpacity(element: Element): number {
    const style = getComputedStyle(element);
    return Number(style.stroke !== "none" ? style.strokeOpacity : style.fillOpacity);
  }

  function readStyles(element: Element): Record<string, string> {
    const style = getComputedStyle(element);
    return {
      color: style.color, fill: style.fill, fillOpacity: style.fillOpacity, opacity: style.opacity,
      stroke: style.stroke, strokeOpacity: style.strokeOpacity, filter: style.filter,
      tagName: element.tagName.toLowerCase(), id: readAttribute(element, "id"),
      className: readAttribute(element, "class"), focusState: readAttribute(element, "data-focus-state"),
      connectorRole: readAttribute(element, "data-connector-role"),
      connectorState: readAttribute(element, "data-connector-state"),
      matchesActiveFlowRule: String(element.matches('.diagram [data-connector-state="active"][data-connector-role="flow"]')),
      diagramAncestor: element.closest(".diagram")?.getAttribute("class") ?? ""
    };
  }

  function readAttribute(element: Element, name: string): string {
    return element.getAttribute(name) ?? "";
  }

  function isFocusBoxVisible(box: DOMRect, bounds: DOMRect): boolean {
    return hasFocusBoxArea(box) && isHorizontallyVisible(box, bounds) && isVerticallyVisible(box, bounds);
  }

  function hasFocusBoxArea(box: DOMRect): boolean { return box.width > 0 || box.height > 0; }
  function isHorizontallyVisible(box: DOMRect, bounds: DOMRect): boolean { return box.left >= bounds.left && box.right <= bounds.right; }
  function isVerticallyVisible(box: DOMRect, bounds: DOMRect): boolean { return box.top >= bounds.top && box.bottom <= bounds.bottom; }

  function readEffectiveOpacity(element: Element): number {
    let opacity = 1;
    let current: Element | null = element;
    while (current !== null) {
      opacity *= Number(getComputedStyle(current).opacity);
      current = current.parentElement;
    }
    return opacity;
  }

  function readFigureColor(element: Element | undefined, style: CSSStyleDeclaration): string {
    if (element === undefined) { return style.color; }
    const computedStyle = getComputedStyle(element);
    return computedStyle.stroke !== "none" ? computedStyle.stroke : computedStyle.fill;
  }

  function readFigureFill(element: Element | undefined, style: CSSStyleDeclaration): string {
    return element === undefined ? "none" : getComputedStyle(element).fill || style.color;
  }

  function isTransparentFill(value: string): boolean {
    return value === "none" || value === "transparent" || value.endsWith(", 0)");
  }

  function contrastRatio(first: string, second: string, opacity = 1): number {
    const composite = readColorChannels(first).map((channel, index) => channel * opacity + readColorChannels(second)[index]! * (1 - opacity));
    const levels = [luminance(composite), luminance(readColorChannels(second))].sort((left, right) => right - left);
    return Number(((levels[0]! + 0.05) / (levels[1]! + 0.05)).toFixed(2));
  }

  function luminance(channels: number[]): number {
    return channels.map((value) => value / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  }

  function readColorChannels(color: string): number[] {
    const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/iu);
    if (hex === null) { return color.match(/[\d.]+/gu)!.slice(0, 3).map(Number); }
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((digit) => digit + digit).join("") : hex[1]!;
    return [0, 2, 4].map((index) => Number.parseInt(digits.slice(index, index + 2), 16));
  }
}
