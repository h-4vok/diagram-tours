import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("authored ER tours focus entity rows and relationships across themes", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("diagram-tour-theme") === null) {
      window.localStorage.setItem("diagram-tour-theme", "dark");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/entity-relationship/order-fulfillment.tour.yaml"], port });
  const evidence: object[] = [];
  const artifactDirectory = resolve(process.cwd(), "../../.loopard/artifacts/issue-60");
  mkdirSync(artifactDirectory, { recursive: true });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await expectFocused(page, "CUSTOMER");
    evidence.push(await captureFocusScreenshot({
      artifactDirectory,
      focusId: "CUSTOMER",
      kind: "entity",
      page,
      textSelector: '[data-node-id="CUSTOMER"] .name',
      relatedTextSelector: '[data-node-id="attribute-customer-customer-id"].attribute-name',
      shapeSelector: '[data-node-id="CUSTOMER"]',
      theme: "dark",
      backgroundSelector: '[data-node-id="CUSTOMER"] path[stroke="none"]'
    }));
    const darkEntityFill = await readEntityFill(page, "CUSTOMER");

    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/order-fulfillment\?step=2$/);
    await expectFocused(page, "attribute-customer-customer-id");
    await expectFocused(page, "attribute-customer-email");
    evidence.push(await captureFocusScreenshot({
      artifactDirectory,
      focusId: "attribute-customer-customer-id",
      kind: "attribute",
      page,
      textSelector: '[data-node-id="attribute-customer-customer-id"].attribute-name foreignObject .nodeLabel p',
      shapeSelector: '[data-node-id="attribute-customer-customer-id"].row-rect-even, [data-node-id="attribute-customer-customer-id"].row-rect-odd',
      theme: "dark",
      backgroundSelector: '[data-node-id="attribute-customer-customer-id"].row-rect-even, [data-node-id="attribute-customer-customer-id"].row-rect-odd'
    }));
    const focusedRow = page.locator('[data-node-id="attribute-customer-customer-id"].row-rect-even, [data-node-id="attribute-customer-customer-id"].row-rect-odd');
    const neighborRow = page.locator('[data-node-id="attribute-customer-full-name"].row-rect-even, [data-node-id="attribute-customer-full-name"].row-rect-odd');
    const focusedOpacity = await focusedRow.evaluate(readOpacityEvidence);
    const neighborOpacity = await neighborRow.evaluate(readOpacityEvidence);
    expect(focusedOpacity.effective).toBeGreaterThan(
      neighborOpacity.effective,
      JSON.stringify({ focusedOpacity, neighborOpacity })
    );
    const focusedNameText = page.locator('[data-node-id="attribute-customer-customer-id"].attribute-name foreignObject .nodeLabel p');
    const neighborNameText = page.locator('[data-node-id="attribute-sales-order-customer-id"].attribute-name foreignObject .nodeLabel p');
    const focusedNameForeignObject = page.locator('[data-node-id="attribute-customer-customer-id"].attribute-name foreignObject');
    const neighborNameForeignObject = page.locator('[data-node-id="attribute-sales-order-customer-id"].attribute-name foreignObject');
    await expect.poll(async () => Math.min(
      (await focusedNameText.evaluate(readOpacityEvidence)).effective,
      (await focusedNameForeignObject.evaluate(readOpacityEvidence)).effective
    )).toBeGreaterThan(0.99);
    await expect.poll(async () => Math.max(
      (await neighborNameText.evaluate(readOpacityEvidence)).effective,
      (await neighborNameForeignObject.evaluate(readOpacityEvidence)).effective
    )).toBeLessThan(0.99);
    const focusedKey = page.locator('[data-node-id="attribute-customer-customer-id"].attribute-keys foreignObject .nodeLabel p');
    const neighborKey = page.locator('[data-node-id="attribute-sales-order-customer-id"].attribute-keys foreignObject .nodeLabel p');
    const focusedKeyForeignObject = page.locator('[data-node-id="attribute-customer-customer-id"].attribute-keys foreignObject');
    const neighborKeyForeignObject = page.locator('[data-node-id="attribute-sales-order-customer-id"].attribute-keys foreignObject');
    await expect.poll(async () => Math.min(
      (await focusedKey.evaluate(readOpacityEvidence)).effective,
      (await focusedKeyForeignObject.evaluate(readOpacityEvidence)).effective
    )).toBeGreaterThan(0.99);
    await expect.poll(async () => Math.max(
      (await neighborKey.evaluate(readOpacityEvidence)).effective,
      (await neighborKeyForeignObject.evaluate(readOpacityEvidence)).effective
    )).toBeLessThan(0.99);

    await page.getByTestId("next-button").click();
    await expectFocused(page, "SALES_ORDER");
    await expectFocused(page, "ORDER_LINE");
    await page.getByTestId("previous-button").click();
    await expectFocused(page, "attribute-customer-customer-id");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="SALES_ORDER"]')).toHaveAttribute(
      "data-focus-state",
      "dimmed"
    );

    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await expectFocused(page, "relationship-sales-order-to-order-line-contains-one-identifying-one-or-more");
    const relationshipPath = page.locator(
      '[data-testid="diagram-container"] .relationshipLine[data-node-id="relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"]'
    );
    await expect(relationshipPath).toHaveAttribute("data-connector-source-id", "SALES_ORDER");
    await expect(relationshipPath).toHaveAttribute("data-connector-target-id", "ORDER_LINE");
    await expect(relationshipPath).toHaveAttribute("data-focus-state", "focused");
    const nativePathIdentity = await relationshipPath.evaluate(readNativePathIdentity);
    expect(nativePathIdentity.edge).toMatch(new RegExp(`^${nativePathIdentity.expectedPrefix}`));
    const pairedNativeLabel = page.locator(
      `[data-testid="diagram-container"] .edgeLabels .label[data-id="${nativePathIdentity.edge}"]`
    );
    await expect(pairedNativeLabel).toHaveAttribute(
      "data-node-id",
      "relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"
    );
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabels .label[data-node-id="relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"]')
    ).toContainText("contains");
    evidence.push(await captureFocusScreenshot({
      artifactDirectory,
      focusId: "relationship-sales-order-to-order-line-contains-one-identifying-one-or-more",
      kind: "relationship",
      page,
      textSelector: '.edgeLabels .label[data-node-id="relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"]',
      shapeSelector: '[data-testid="diagram-container"] .relationshipLine[data-node-id="relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"]',
      theme: "dark",
      backgroundSelector: ".theme-root"
    }));

    await page.getByTestId("theme-toggle").click();
    await page.reload();
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await expectFocused(page, "relationship-sales-order-to-order-line-contains-one-identifying-one-or-more");
    evidence.push(await captureFocusScreenshot({
      artifactDirectory,
      focusId: "relationship-sales-order-to-order-line-contains-one-identifying-one-or-more",
      kind: "relationship",
      page,
      textSelector: '.edgeLabels .label[data-node-id="relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"]',
      shapeSelector: '[data-testid="diagram-container"] .relationshipLine[data-node-id="relationship-sales-order-to-order-line-contains-one-identifying-one-or-more"]',
      theme: "light",
      backgroundSelector: ".theme-root"
    }));
    expect(await readEntityFill(page, "CUSTOMER")).not.toBe(darkEntityFill);
    await page.goto(`${server.baseUrl}/order-fulfillment?step=1`);
    await expectDiagramVisible(page);
    evidence.push(await captureFocusScreenshot({
      artifactDirectory,
      focusId: "CUSTOMER",
      kind: "entity",
      page,
      textSelector: '[data-node-id="CUSTOMER"] .name',
      relatedTextSelector: '[data-node-id="attribute-customer-customer-id"].attribute-name',
      shapeSelector: '[data-node-id="CUSTOMER"]',
      theme: "light",
      backgroundSelector: '[data-node-id="CUSTOMER"] path[stroke="none"]'
    }));
    await page.goto(`${server.baseUrl}/order-fulfillment?step=2`);
    await expectDiagramVisible(page);
    evidence.push(await captureFocusScreenshot({
      artifactDirectory,
      focusId: "attribute-customer-customer-id",
      kind: "attribute",
      page,
      textSelector: '[data-node-id="attribute-customer-customer-id"].attribute-name foreignObject .nodeLabel p',
      shapeSelector: '[data-node-id="attribute-customer-customer-id"].row-rect-even, [data-node-id="attribute-customer-customer-id"].row-rect-odd',
      theme: "light",
      backgroundSelector: '[data-node-id="attribute-customer-customer-id"].row-rect-even, [data-node-id="attribute-customer-customer-id"].row-rect-odd'
    }));
    writeFileSync(resolve(artifactDirectory, "measurements.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    await server.stop();
  }
});

async function expectFocused(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${id}"]`).first()).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
}

type FocusKind = "entity" | "attribute" | "relationship";

type FocusSelectors = {
  backgroundSelector: string;
  kind: FocusKind;
  relatedTextSelector?: string;
  shapeSelector: string;
  textSelector: string;
};

type FocusStyleEvidence = {
  backgroundColor: string;
  focusColor: string;
  focusOpacity: number;
  relationshipBackground: string;
  relatedTextAncestors: string[];
  relatedTextOpacity: number | null;
  rootBackground: string;
  shapeFill: string;
  textAncestors: string[];
  textColor: string;
  textOpacity: number;
};

type FocusColors = FocusStyleEvidence & {
  focusContrast: number;
  shapeBackground: string;
  textBackground: string;
  textContrast: number;
  visibleTextColor: number[];
};

async function captureFocusScreenshot(input: {
  artifactDirectory: string;
  backgroundSelector: string;
  focusId: string;
  kind: FocusKind;
  page: Page;
  relatedTextSelector?: string;
  shapeSelector: string;
  textSelector: string;
  theme: "dark" | "light";
}): Promise<object> {
  const { artifactDirectory, backgroundSelector, focusId, kind, page, relatedTextSelector, shapeSelector, textSelector, theme } = input;
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", theme);
  await expectFocused(page, focusId);
  await page.waitForTimeout(500);
  const colors = await readFocusColors(page, {
    backgroundSelector,
    kind,
    relatedTextSelector,
    shapeSelector,
    textSelector
  });
  const screenshot = resolve(artifactDirectory, `${theme}-${kind}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const visibleTextPixels = await countPixelsNearColor(page, textSelector, colors.visibleTextColor);
  expect(visibleTextPixels, JSON.stringify({ focusId, visibleTextPixels, visibleTextColor: colors.visibleTextColor })).toBeGreaterThan(0);
  const relatedTextPixels = await countRelatedTextPixels(page, relatedTextSelector, colors.visibleTextColor);
  assertRelatedTextIsReadable(relatedTextSelector, colors, relatedTextPixels);
  expect(colors.focusOpacity).toBeGreaterThan(0);
  expect(colors.textContrast, JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
  expect(colors.focusContrast, JSON.stringify(colors)).toBeGreaterThanOrEqual(3);
  return { focusId, kind, screenshot, theme, visibleTextPixels, relatedTextPixels, ...colors };
}

async function countRelatedTextPixels(page: Page, selector: string | undefined, color: number[]): Promise<number | null> {
  if (selector === undefined) {
    return null;
  }
  return countPixelsNearColor(page, selector, color);
}

function assertRelatedTextIsReadable(
  selector: string | undefined,
  colors: FocusColors,
  pixelCount: number | null
): void {
  if (selector === undefined) {
    return;
  }
  expect(colors.relatedTextOpacity, JSON.stringify(colors)).toBeGreaterThanOrEqual(0.99);
  expect(pixelCount).toBeGreaterThan(0);
}

async function countPixelsNearColor(page: Page, selector: string, color: number[]): Promise<number> {
  const png = await page.locator(selector).screenshot();
  return page.evaluate(countVisiblePixelsInBrowser, { encodedPng: png.toString("base64"), expected: color });
}

async function readFocusColors(page: Page, input: FocusSelectors): Promise<FocusColors> {
  const styles = await page.evaluate(readFocusStylesInBrowser, input);
  const shapeBackground = styles.shapeFill === "none" ? styles.rootBackground : styles.shapeFill;
  const textBackground = input.kind === "relationship" ? styles.relationshipBackground : shapeBackground;
  const visibleTextColor = compositeColor({
    front: toRgb(styles.textColor),
    back: toRgb(textBackground),
    opacity: styles.textOpacity,
    rootColor: toRgb(styles.rootBackground)
  });
  return {
    ...styles,
    focusContrast: readContrast({
      foreground: styles.focusColor,
      backdrop: shapeBackground,
      opacity: styles.focusOpacity,
      rootBackground: styles.rootBackground
    }),
    shapeBackground,
    textBackground,
    textContrast: readContrast({
      foreground: styles.textColor,
      backdrop: textBackground,
      opacity: styles.textOpacity,
      rootBackground: styles.rootBackground
    }),
    visibleTextColor
  };
}

function readFocusStylesInBrowser(input: FocusSelectors): FocusStyleEvidence {
  const root = requireElement(".theme-root");
  const textTarget = requireElement(input.textSelector);
  const shapeTarget = requireElement(input.shapeSelector);
  const background = requireElement(input.backgroundSelector);
  const text = readMatchingDescendant(textTarget, "text, p, span, tspan");
  const shape = readMatchingDescendant(shapeTarget, "path[fill='none'], path, rect, polygon, circle, ellipse, line");
  const textColor = readPaint(text);
  const textOpacity = effectiveOpacity(text);
  const rootBackground = readThemeColor(root, "--bg-base");
  const relatedText = readOptionalText(input.relatedTextSelector);
  return {
    backgroundColor: readPaint(background),
    focusColor: getComputedStyle(shape).stroke,
    focusOpacity: effectiveOpacity(shape),
    relationshipBackground: readThemeColor(root, "--color-edge-label-bg"),
    rootBackground,
    relatedTextAncestors: readOptionalAncestorStyles(relatedText),
    relatedTextOpacity: readOptionalOpacity(relatedText),
    shapeFill: getComputedStyle(shape).fill,
    textAncestors: readAncestorStyles(text),
    textColor,
    textOpacity
  };
  function requireElement(selector: string): Element {
    const element = document.querySelector(selector);
    if (element === null) {
      throw new Error(`Missing screenshot evidence selector: ${selector}`);
    }
    return element;
  }
  function readMatchingDescendant(target: Element, selector: string): Element {
    if (target.matches(selector)) {
      return target;
    }
    const descendant = target.querySelector(selector);
    if (descendant === null) {
      throw new Error(`Missing evidence in ${target.tagName}.${target.getAttribute("class")}`);
    }
    return descendant;
  }
  function readOptionalText(selector: string | undefined): Element | null {
    if (selector === undefined) {
      return null;
    }
    const target = document.querySelector(selector);
    return target === null ? null : readMatchingDescendant(target, "text, p, span, tspan");
  }
  function readPaint(element: Element): string {
    const styles = getComputedStyle(element);
    return styles.fill !== "none" && styles.fill !== "rgba(0, 0, 0, 0)" ? styles.fill : styles.color;
  }
  function effectiveOpacity(element: Element): number {
    let result = 1;
    for (let current: Element | null = element; current !== null; current = current.parentElement) {
      result *= Number.parseFloat(getComputedStyle(current).opacity);
    }
    return result;
  }
  function readThemeColor(rootElement: Element, name: string): string {
    return getComputedStyle(rootElement).getPropertyValue(name).trim();
  }
  function readOptionalOpacity(element: Element | null): number | null {
    return element === null ? null : effectiveOpacity(element);
  }
  function readOptionalAncestorStyles(element: Element | null): string[] {
    return element === null ? [] : readAncestorStyles(element);
  }
  function readAncestorStyles(element: Element): string[] {
    const ancestors: string[] = [];
    for (let current: Element | null = element; current !== null; current = current.parentElement) {
      const styles = getComputedStyle(current);
      ancestors.push(`${current.tagName}.${current.getAttribute("class")} opacity=${styles.opacity} filter=${styles.filter} backdrop=${styles.backdropFilter} blend=${styles.mixBlendMode}`);
    }
    return ancestors;
  }
}

function toRgb(color: string): number[] {
  return color.startsWith("#") ? readHexColor(color) : readCssRgbColor(color);
}

function readHexColor(color: string): number[] {
  const hex = color.slice(1);
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16) / 255).concat(1);
}

function readCssRgbColor(color: string): number[] {
  const channels = color.match(/[\d.]+%?/gu) ?? [];
  if (channels.length < 3) {
    throw new Error(`Unsupported computed color ${color}`);
  }
  return [readCssChannel(channels[0]!, 0), readCssChannel(channels[1]!, 1), readCssChannel(channels[2]!, 2), readCssAlpha(channels)];
}

function readCssChannel(value: string, index: number): number {
  const amount = Number.parseFloat(value);
  return value.endsWith("%") ? amount / 100 : index < 3 ? amount / 255 : amount;
}

function readCssAlpha(channels: string[]): number {
  return channels.length === 3 ? 1 : readCssChannel(channels[3]!, 3);
}

function compositeColor(input: { back: number[]; front: number[]; opacity: number; rootColor: number[] }): number[] {
  const { back, front, opacity, rootColor } = input;
  const background = [0, 1, 2].map((index) => back[index]! * back[3]! + rootColor[index]! * (1 - back[3]!));
  return background.map((channel, index) => Math.round((front[index]! * opacity + channel * (1 - opacity)) * 255));
}

function readContrast(input: { backdrop: string; foreground: string; opacity: number; rootBackground: string }): number {
  const { backdrop, foreground, opacity, rootBackground } = input;
  const root = toRgb(rootBackground);
  const front = toRgb(foreground);
  const back = toRgb(backdrop);
  const visible = compositeColor({ back, front, opacity: opacity * front[3]!, rootColor: root });
  const visibleBackground = compositeColor({ back: root, front: back, opacity: back[3]!, rootColor: root });
  return calculateContrast(visible, visibleBackground);
}

function calculateContrast(first: number[], second: number[]): number {
  const values = [readLuminance(first), readLuminance(second)].sort((left, right) => right - left);
  return Number(((values[0]! + 0.05) / (values[1]! + 0.05)).toFixed(2));
}

function readLuminance(channels: number[]): number {
  const [red, green, blue] = channels.map((channel) => readLinearChannel(channel! / 255));
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function readLinearChannel(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

async function countVisiblePixelsInBrowser(input: { encodedPng: string; expected: number[] }): Promise<number> {
  const image = new Image();
  image.src = `data:image/png;base64,${input.encodedPng}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = requireContext(canvas);
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  return countPixels(pixels, input.expected);
  function requireContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
    const context2d = target.getContext("2d");
    if (context2d === null) {
      throw new Error("Canvas 2D context is unavailable");
    }
    return context2d;
  }
  function countPixels(data: Uint8ClampedArray, expected: number[]): number {
    let count = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (isVisibleTextPixel(data, offset, expected)) {
        count += 1;
      }
    }
    return count;
  }
  function isVisibleTextPixel(data: Uint8ClampedArray, offset: number, expected: number[]): boolean {
    return data[offset + 3]! > 200 && isNearColor(data, offset, expected);
  }
  function isNearColor(data: Uint8ClampedArray, offset: number, expected: number[]): boolean {
    return [0, 1, 2].every((channel) => Math.abs(data[offset + channel]! - expected[channel]!) <= 30);
  }
}

async function readEntityFill(page: Page, id: string): Promise<string> {
  return page
    .locator(`[data-testid="diagram-container"] [data-node-id="${id}"]`)
    .first()
    .evaluate((element) => getComputedStyle(element.querySelector("rect, path") ?? element).fill);
}

function readOpacityEvidence(element: Element): { effective: number; ancestors: string[] } {
  const selfOpacity = Number.parseFloat(getComputedStyle(element).opacity);
  const focusTarget = element.closest("[data-focus-state]")!;
  const entity = element.closest(".node")!;
  const targetOpacity = Number.parseFloat(getComputedStyle(focusTarget).opacity);
  const entityOpacity = Number.parseFloat(getComputedStyle(entity).opacity);
  return {
    effective: selfOpacity * targetOpacity * entityOpacity,
    ancestors: []
  };
}

function readNativePathIdentity(path: Element): { edge: string | null; expectedPrefix: string } {
  const svg = path.closest("svg")!;
  const source = svg.querySelector<SVGElement>("#entity-SALES_ORDER-1")!.id;
  const target = svg.querySelector<SVGElement>("#entity-ORDER_LINE-2")!.id;
  return { edge: path.getAttribute("data-id"), expectedPrefix: `id_${source}_${target}_` };
}
