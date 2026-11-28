import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

const FOCI = [
  ["group", "group-platform", 2], ["service", "service-app", 1], ["junction", "junction-split", 1],
  ["connection", "connection-1", 1], ["connection", "connection-2", 1],
  ["connection", "connection-3", 1], ["connection", "connection-4", 1]
] as const;

test("architecture-beta focuses real SVG targets and stays legible across themes", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("architecture-smoke-theme-seeded") !== "true") {
      window.localStorage.setItem("diagram-tour-theme", "dark");
      window.sessionStorage.setItem("architecture-smoke-theme-seeded", "true");
    }
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/architecture/platform-topology.tour.yaml"], port });
  const artifactPath = resolve(process.cwd(), "../../.loopard/artifacts/issue-64");
  const measurements: Array<Record<string, unknown>> = [];
  await mkdir(artifactPath, { recursive: true });

  try {
    await page.goto(server.baseUrl);
    const svg = page.getByTestId("diagram-container").locator("svg").first();
    await expect(svg).toBeVisible();
    await writeFile(resolve(artifactPath, "architecture-rendered-dom.html"), await svg.evaluate((element) => element.outerHTML));
    await expect(svg.locator(".architecture-groups #group-platform.node-bkg")).toBeAttached();
    await expect(svg.locator(".architecture-services #service-app.architecture-service")).toBeAttached();
    await expect(svg.locator(".architecture-services .architecture-junction #node-split")).toBeAttached();
    await expect(svg.locator(".architecture-edges path.edge")).toHaveCount(4);
    await expect(svg.locator('.architecture-edges path.edge[id="L_app_database_0"]')).toBeAttached();
    await captureTheme(page, { artifactPath, measurements, theme: "dark" });
    await rewind(page);
    await page.getByTestId("theme-toggle").click();
    await captureTheme(page, { artifactPath, measurements, theme: "light" });
    await writeFile(resolve(artifactPath, "architecture-computed-styles.json"), JSON.stringify(measurements, null, 2));
    await page.reload();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
  } finally {
    await server.stop();
  }
});

async function captureTheme(page: Page, input: { artifactPath: string; measurements: Array<Record<string, unknown>>; theme: string }): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", input.theme);
  for (const [index, [semantic, key, count]] of FOCI.entries()) {
    await captureThemeFocus({ page, input, index, semantic, key, count });
  }
}

async function captureThemeFocus(input: {
  page: Page;
  input: { artifactPath: string; measurements: Array<Record<string, unknown>>; theme: string };
  index: number;
  semantic: string;
  key: string;
  count: number;
}): Promise<void> {
  await advanceThemeFocus(input.page, input.index);
  const targets = input.page.locator(`[data-testid="diagram-container"] [data-node-id="${input.key}"]`);
  await expect(targets).toHaveCount(input.count);
  await expect.poll(() => targets.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-focus-state"))))
    .toEqual(Array.from({ length: input.count }, () => "focused"));
  await input.page.getByRole("button", { name: "Fit diagram to view" }).click();
  await adjustGroupView(input.page, input.semantic);
  await expect.poll(() => targets.evaluateAll((elements) => elements.flatMap((element) => [element, ...Array.from(element.querySelectorAll("*"))])
    .every((element) => getComputedStyle(element).opacity === "1"))).toBe(true);
  const measurement = await readMeasurement(input.page, { key: input.key, semantic: input.semantic, theme: input.input.theme });
  input.input.measurements.push(measurement);
  await writeFile(resolve(input.input.artifactPath, "architecture-computed-styles.json"), JSON.stringify(input.input.measurements, null, 2));
  await input.page.screenshot({ path: resolve(input.input.artifactPath, `architecture-${input.semantic}-${input.input.theme}-${input.index}.png`), fullPage: true });
  if (measurement.textContrast !== null) { expect(measurement.textContrast).toBeGreaterThanOrEqual(4.5); }
  expect(measurement.figureContrast).toBeGreaterThanOrEqual(3);
  expect(measurement.focusContrast).toBeGreaterThanOrEqual(3);
  expect(measurement.effectiveOpacity, JSON.stringify(measurement.computed)).toBe(1);
  if (input.semantic === "group") { expect(measurement.groupFullyVisible).toBe(true); }
}

async function adjustGroupView(page: Page, semantic: string): Promise<void> {
  if (semantic === "group") { await page.getByTestId("zoom-out-button").click(); }
}

async function advanceThemeFocus(page: Page, index: number): Promise<void> {
  if (index === 0) { return; }
  await page.getByTestId("next-button").click();
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${FOCI[index - 1]![1]}"]`).first())
    .toHaveAttribute("data-focus-state", "dimmed");
}

async function rewind(page: Page): Promise<void> {
  for (let index = 1; index < FOCI.length; index += 1) {
    await page.getByTestId("previous-button").click();
  }
}

async function readMeasurement(page: Page, input: { key: string; semantic: string; theme: string }): Promise<{
  background: string; computed: Array<Record<string, string>>; effectiveOpacity: number;
  figureContrast: number; focusContrast: number; textContrast: number | null;
}> {
  const target = page.locator(`[data-testid="diagram-container"] [data-node-id="${input.key}"]`).first();
  return target.evaluate(readArchitectureMeasurement, input);
}

function readArchitectureMeasurement(focusedTarget: Element, data: { key: string; semantic: string; theme: string }) {
  const targets = Array.from(document.querySelectorAll(`[data-node-id="${data.key}"]`));
  const elements = targets.flatMap((parent) => [parent, ...Array.from(parent.querySelectorAll("*"))]);
  const text = elements.find((element) => ["text", "tspan"].includes(element.tagName.toLowerCase()));
  const figure = elements.find((element) => ["path", "rect", "polygon", "line"].includes(element.tagName.toLowerCase()));
  const targetStyle = getComputedStyle(focusedTarget);
  const svg = focusedTarget.closest("svg")!;
  const background = readArchitectureBackdrop({ semantic: data.semantic, svg, figure, text });
  const computed = elements.map(readComputedStyle);
  const boxes = targets.map((target) => target.getBoundingClientRect());
  const viewport = document.querySelector("[data-testid='diagram-container']")!.getBoundingClientRect();
  const overlays = Array.from(document.querySelectorAll("[data-testid='teleprompter'], [data-testid='minimap-shell']"))
    .filter((element) => isVisibleOverlay(element)).map((element) => element.getBoundingClientRect());
  const figureOpacity = readFigurePaintOpacity(figure, svg);
  const textOpacity = readPaintOpacity(text, "fillOpacity", svg);
  const figureColor = readFigureColor(figure, targetStyle);
  return {
    ...data, background, computed,
    effectiveOpacity: Math.min(figureOpacity, textOpacity),
    groupFullyVisible: boxes.every((box) => isUnobscured(box)),
    textContrast: text === undefined ? null : contrastRatio(readTextColor(text, targetStyle), background, textOpacity),
    figureContrast: contrastRatio(figureColor, background, figureOpacity),
    focusContrast: contrastRatio(figureColor, background, figureOpacity)
  };

  function isVisibleOverlay(element: Element): boolean {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
  }

  function isUnobscured(box: DOMRect): boolean {
    return isFullyVisible(box, viewport) && overlays.every((overlay) => !overlaps(box, overlay));
  }

  function overlaps(first: DOMRect, second: DOMRect): boolean {
    return Math.min(first.right, second.right) > Math.max(first.left, second.left) &&
      Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top);
  }

  function readArchitectureBackdrop(input: { semantic: string; svg: Element; figure: Element | undefined; text: Element | undefined }): string {
    const group = input.svg.querySelector(".architecture-groups #group-platform.node-bkg")!;
    if (input.semantic === "connection") { return readConnectorBackdrop(input.figure, input.svg); }
    if (input.semantic === "junction") {
      return getComputedStyle(document.querySelector("[data-testid='theme-root']")!).getPropertyValue("--bg-base").trim();
    }
    const backdrop = readPaintedTextBackdrop(input.text, readFigureBackdrop(input.figure, group));
    return getComputedStyle(backdrop).fill;
  }

  function readConnectorBackdrop(connector: Element | undefined, svg: Element): string {
    const shell = document.querySelector("[data-testid='diagram-shell']")!;
    if (connector === undefined) { return getComputedStyle(shell).backgroundColor; }
    const center = readElementCenter(connector);
    const backdrop = Array.from(svg.querySelectorAll("rect"))
      .filter((rect) => hasPaintedFill(rect) && containsPoint(rect.getBoundingClientRect(), center))
      .sort((left, right) => area(left.getBoundingClientRect()) - area(right.getBoundingClientRect()))[0];
    return backdrop === undefined ? getComputedStyle(shell).backgroundColor : getComputedStyle(backdrop).fill;
  }

  function readElementCenter(element: Element): { x: number; y: number } {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  function hasPaintedFill(element: Element): boolean {
    const style = getComputedStyle(element);
    return style.fill !== "none" && Number(style.fillOpacity) > 0;
  }

  function containsPoint(box: DOMRect, point: { x: number; y: number }): boolean {
    return Math.min(point.x - box.left, box.right - point.x, point.y - box.top, box.bottom - point.y) >= 0;
  }

  function area(box: DOMRect): number {
    return box.width * box.height;
  }

  function readPaintedTextBackdrop(textTarget: Element | undefined, fallback: Element): Element {
    return readPaintedTextBackdropAncestor(readTextBackdropStart(textTarget)) ?? fallback;
  }

  function readPaintedTextBackdropAncestor(start: Element | null): Element | null {
    if (start === null) { return null; }
    const group = start.closest("g:has(rect.background)");
    return group === null ? null : group.querySelector("rect.background");
  }

  function readTextBackdropStart(textTarget: Element | undefined): Element | null {
    return textTarget === undefined ? null : textTarget.parentElement;
  }

  function readFigureBackdrop(figureTarget: Element | undefined, fallback: Element): Element {
    return figureTarget?.parentElement ?? fallback;
  }

  function readComputedStyle(element: Element): Record<string, string> {
    const style = getComputedStyle(element);
    return { color: style.color, fill: style.fill, opacity: style.opacity, stroke: style.stroke,
      tagName: element.tagName.toLowerCase(), id: readAttribute(element, "id"), className: readAttribute(element, "class"),
      nodeId: readAttribute(element, "data-node-id"), focusState: readAttribute(element, "data-focus-state"),
      inlineStyle: readAttribute(element, "style"), parentFocusState: readAttribute(element.parentElement!, "data-focus-state") };
  }

  function readAttribute(element: Element, name: string): string {
    return element.getAttribute(name) ?? "";
  }

  function isFullyVisible(box: DOMRect, bounds: DOMRect): boolean {
    return box.width > 0 && box.height > 0 &&
      Math.min(box.left - bounds.left, bounds.right - box.right, box.top - bounds.top, bounds.bottom - box.bottom) >= 0;
  }

  function readElementOpacity(element: Element | undefined, svgRoot: Element): number {
    return element === undefined ? 1 : readEffectiveOpacity(element, svgRoot);
  }

  function readPaintOpacity(element: Element | undefined, property: "fillOpacity" | "strokeOpacity", svgRoot: Element): number {
    return element === undefined ? 1 : readElementOpacity(element, svgRoot) * Number(getComputedStyle(element)[property]);
  }

  function readFigurePaintOpacity(element: Element | undefined, svgRoot: Element): number {
    if (element === undefined) { return 1; }
    const property = getComputedStyle(element).stroke === "none" ? "fillOpacity" : "strokeOpacity";
    return readPaintOpacity(element, property, svgRoot);
  }

  function readEffectiveOpacity(element: Element, svgRoot: Element): number {
    let opacity = 1;
    let current: Element | null = element;
    while (current !== null) {
      opacity *= Number(getComputedStyle(current).opacity);
      if (current === svgRoot) { break; }
      current = current.parentElement;
    }
    return opacity;
  }

  function readTextColor(textTarget: Element | undefined, style: CSSStyleDeclaration): string {
    return textTarget === undefined ? style.color : getComputedStyle(textTarget).fill;
  }

  function readFigureColor(figureTarget: Element | undefined, style: CSSStyleDeclaration): string {
    return figureTarget === undefined ? style.color : readComputedFigureColor(getComputedStyle(figureTarget), style);
  }

  function readComputedFigureColor(style: CSSStyleDeclaration, targetStyle: CSSStyleDeclaration): string {
    if (style.stroke !== "none") { return style.stroke; }
    if (style.fill !== "none") { return style.fill; }
    return targetStyle.color;
  }

  function contrastRatio(first: string, second: string, opacity: number): number {
    const levels = [luminance(blend(parseRgb(first), parseRgb(second), opacity)), luminance(parseRgb(second))].sort((left, right) => right - left);
    return Number(((levels[0]! + 0.05) / (levels[1]! + 0.05)).toFixed(2));
  }

  function blend(first: number[], second: number[], opacity: number): number[] {
    return first.map((channel, index) => channel * opacity + second[index]! * (1 - opacity));
  }

  function parseRgb(color: string): number[] {
    const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/iu);
    if (hex === null) { return parseRgbChannels(color); }
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((digit) => digit + digit).join("") : hex[1]!;
    return [0, 2, 4].map((index) => Number.parseInt(digits.slice(index, index + 2), 16));
  }

  function parseRgbChannels(color: string): number[] {
    const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/iu);
    if (srgb !== null) { return [1, 2, 3].map((index) => Number(srgb[index]) * 255); }
    const channels = color.match(/[\d.]+/gu);
    if (channels === null) { throw new Error(`Unsupported computed paint: ${color}`); }
    return channels.slice(0, 3).map(Number);
  }

  function luminance(rgb: number[]): number {
    return rgb.map((value) => value / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  }
}
