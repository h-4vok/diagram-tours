import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { startDevServer } from "./dev-server";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { resolveSmokeServerPort } from "./smoke-port";

type FocusTarget = {
  id: string;
  kind: "requirement" | "element" | "relationship";
  theme: "dark" | "light";
};
type RequirementRowEvidence = {
  fontCheckInter: boolean;
  fontStatus: FontFaceSetLoadStatus;
  labelFontFamily: string;
  labelFontSize: string;
  labelScrollWidth: number;
  textRectsWithinForeignObject: boolean;
  labelClientWidth: number;
  foreignObjectBounds: { left: number; right: number; top: number; bottom: number };
  foreignObjectSvgBounds: { x: number; y: number; width: number; height: number };
  foreignObjectWithinShape: boolean;
  shapeSvgBounds: { x: number; y: number; width: number; height: number };
  shapeBounds: { left: number; right: number; top: number; bottom: number };
  text: string;
  textRects: Array<{ left: number; right: number; top: number; bottom: number }>;
  textRectsWithinShape: boolean;
};
type RequirementBadgeEvidence = {
  text: string;
  foreignObjectOverflow: string;
  textWithinRootDiv: boolean;
  backgroundColor: string;
  rootDivBounds: { left: number; right: number; top: number; bottom: number };
  foreignObjectBounds: { left: number; right: number; top: number; bottom: number };
  textBounds: { left: number; right: number; top: number; bottom: number };
  padding: { left: number; right: number };
  borderRadius: number;
};

test.setTimeout(60_000);

test("authored requirement tours focus requirements, elements, and typed relations", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("diagram-tour-theme") === null) {
      localStorage.setItem("diagram-tour-theme", "dark");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/requirement/payment-security-requirements.tour.yaml"], port });
  const artifacts = resolve(process.cwd(), "../../.loopard/artifacts/issue-61");
  mkdirSync(artifacts, { recursive: true });
  const evidence: object[] = [];
  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.locator("svg.requirementDiagram")).toBeVisible();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await captureTarget({ page, artifacts, evidence, target: { theme: "dark", kind: "requirement", id: "REQ_AUTH" } });

    await page.getByTestId("next-button").click();
    await captureTarget({ page, artifacts, evidence, target: { theme: "dark", kind: "element", id: "IDENTITY_PROVIDER" } });

    await page.getByTestId("next-button").click();
    const relation = "relationship-identity-provider-satisfies-req-auth";
    const path = page.locator(`[data-testid="diagram-container"] .edgePaths > path[data-node-id="${relation}"]`);
    await expect(path).toHaveAttribute("id", "diagram-tour-requirement-edge-1");
    const label = page.locator(`[data-testid="diagram-container"] .edgeLabels > .edgeLabel[data-node-id="${relation}"]`);
    await expect(label.locator('.label[data-id="diagram-tour-requirement-edge-1"]')).toBeVisible();
    await expect(label).toContainText("satisfies");
    await captureTarget({ page, artifacts, evidence, target: { theme: "dark", kind: "relationship", id: relation } });

    await page.getByTestId("next-button").click();
    const parallelRelation = "relationship-identity-provider-verifies-req-auth";
    await expectRequirementRelation(page, parallelRelation, "diagram-tour-requirement-edge-2");
    await page.getByTestId("previous-button").click();
    await expectRequirementRelation(page, relation, "diagram-tour-requirement-edge-1");

    await page.getByTestId("theme-toggle").click();
    await page.reload();
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await expectRequirementRelation(page, relation, "diagram-tour-requirement-edge-1");
    await captureLightTargets({ page, artifacts, evidence, relation, baseUrl: server.baseUrl });
    writeFileSync(resolve(artifacts, "measurements.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await verifyRequirementRenderRegressions(page, testInfo);
  } finally {
    await server.stop();
  }
});

async function captureLightTargets(input: {
  page: Page;
  artifacts: string;
  evidence: object[];
  relation: string;
  baseUrl: string;
}): Promise<void> {
  for (const [step, kind, id] of [
    [1, "requirement", "REQ_AUTH"],
    [2, "element", "IDENTITY_PROVIDER"],
    [3, "relationship", input.relation]
  ] as const) {
    await input.page.goto(`${input.baseUrl}/payment-security-requirements?step=${step}`);
    await expectDiagramVisible(input.page);
    await captureTarget({
      page: input.page,
      artifacts: input.artifacts,
      evidence: input.evidence,
      target: { theme: "light", kind, id }
    });
  }
}

async function captureTarget(input: {
  page: Page;
  artifacts: string;
  evidence: object[];
  target: FocusTarget;
}): Promise<void> {
  const { page, artifacts, evidence, target } = input;
  const selector = `[data-testid="diagram-container"] [data-node-id="${target.id}"]`;
  const element = page.locator(selector).first();
  const label = readTargetLabel(page, target, element);
  await expect(element).toHaveAttribute("data-focus-state", "focused");
  await waitForFocusAnimations([element, label]);
  await expect.poll(() => label.evaluate(readEffectiveOpacity)).toBeGreaterThan(0.99);
  const [browserStyles, rowGeometry] = await Promise.all([
    element.evaluate(readBrowserEvidence, target),
    element.evaluate(readRowGeometry)
  ]);
  const browserStyle = { ...browserStyles, rowGeometry };
  const style = computeFocusEvidence(browserStyle);
  const endpointEvidence = await readTargetEndpoints(page, target);
  const badgeEvidence = target.kind === "relationship" ? await readRelationshipBadge(page, target) : undefined;
  const screenshot = resolve(artifacts, `${target.theme}-${target.kind}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  expect(style.textOpacity, JSON.stringify(style.textAncestors)).toBeGreaterThan(0.99);
  expect(style.shapeOpacity, JSON.stringify(style.shapeAncestors)).toBeGreaterThan(0.99);
  expect(style.textContrast, JSON.stringify(style)).toBeGreaterThanOrEqual(4.5);
  expect(style.focusContrast, JSON.stringify(style)).toBeGreaterThanOrEqual(3);
  expectRequirementRows(target, style.rowGeometry);
  verifyEndpointEvidence(endpointEvidence, target);
  evidence.push({ ...target, screenshot, ...style, endpointEvidence, badgeEvidence });
}

async function readRelationshipBadge(page: Page, target: FocusTarget): Promise<RequirementBadgeEvidence> {
  const badge = page.locator(`[data-testid="diagram-container"] .edgeLabel[data-node-id="${target.id}"]`);
  const evidence = await badge.evaluate(readRelationshipBadgeInBrowser);
  expect(evidence.text, JSON.stringify(evidence)).toContain("satisfies");
  expect(evidence.text, JSON.stringify(evidence)).toContain("»");
  expect(evidence.foreignObjectOverflow).toBe("visible");
  expect(evidence.textWithinRootDiv, JSON.stringify(evidence)).toBe(true);
  expect(evidence.backgroundColor, JSON.stringify(evidence)).not.toBe("rgba(0, 0, 0, 0)");
  expect(evidence.padding.left, JSON.stringify(evidence)).toBeGreaterThanOrEqual(2);
  expect(evidence.padding.right, JSON.stringify(evidence)).toBeGreaterThanOrEqual(2);
  expect(evidence.borderRadius, JSON.stringify(evidence)).toBeGreaterThanOrEqual(3);
  return evidence;
}

function readRelationshipBadgeInBrowser(badge: Element): RequirementBadgeEvidence {
  const foreignObject = badge.querySelector("foreignObject")!;
  const rootDiv = foreignObject.querySelector("div")!;
  const textNode = rootDiv.querySelector("p")!;
  const rootStyle = getComputedStyle(rootDiv);
  const textRange = document.createRange();
  textRange.selectNodeContents(textNode);
  const textBounds = textRange.getBoundingClientRect();
  const rootBounds = rootDiv.getBoundingClientRect();
  const foreignBounds = foreignObject.getBoundingClientRect();
  const rect = (bounds: DOMRect) => ({ left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom });
  return {
    text: textNode.textContent as string,
    foreignObjectOverflow: getComputedStyle(foreignObject).overflow,
    textWithinRootDiv: isRectWithin(rootBounds, textBounds),
    backgroundColor: rootStyle.backgroundColor,
    rootDivBounds: rect(rootBounds),
    foreignObjectBounds: rect(foreignBounds),
    textBounds: rect(textBounds),
    padding: {
      left: Number.parseFloat(rootStyle.paddingLeft),
      right: Number.parseFloat(rootStyle.paddingRight)
    },
    borderRadius: Number.parseFloat(rootStyle.borderTopLeftRadius)
  };
  function isRectWithin(container: DOMRect, content: DOMRect): boolean {
    const tolerance = 1;
    return [
      content.left >= container.left - tolerance,
      content.right <= container.right + tolerance,
      content.top >= container.top - tolerance,
      content.bottom <= container.bottom + tolerance
    ].every(Boolean);
  }
}

function readTargetLabel(page: Page, target: FocusTarget, element: Locator): Locator {
  if (target.kind !== "relationship") {
    return element;
  }
  return page.locator(`[data-testid="diagram-container"] .edgeLabel[data-node-id="${target.id}"] .label`);
}

async function readTargetEndpoints(page: Page, target: FocusTarget) {
  if (target.kind !== "relationship") {
    return [];
  }
  return readRequirementEndpointEvidence(page.locator('[data-requirement-context="true"]'));
}

function verifyEndpointEvidence(endpoints: Awaited<ReturnType<typeof readRequirementEndpointEvidence>>, target: FocusTarget): void {
  endpoints.forEach((endpoint) => {
    expect(endpoint.opacity, JSON.stringify(endpoint)).toBeGreaterThan(0.99);
    expect(endpoint.contrast, JSON.stringify(endpoint)).toBeGreaterThanOrEqual(4.5);
  });
  if (target.kind === "relationship") {
    expect(endpoints.map(({ id }) => id).sort()).toEqual(["IDENTITY_PROVIDER", "REQ_AUTH"]);
  }
}

function expectRequirementRows(target: FocusTarget, rows: RequirementRowEvidence[]): void {
  if (target.kind === "relationship") {
    return;
  }
  expect(rows.length, target.id).toBeGreaterThan(0);
  rows.forEach((row) => {
    expect(row.foreignObjectWithinShape, JSON.stringify(row)).toBe(true);
    expect(row.textRectsWithinForeignObject, JSON.stringify(row)).toBe(true);
    expect(row.textRectsWithinShape, JSON.stringify(row)).toBe(true);
  });
  const allText = rows.map(({ text }) => text).join(" ");
  const expectedText = readExpectedRequirementText(target.id);
  expect(allText).toContain(expectedText);
}

function readExpectedRequirementText(targetId: string): string {
  if (targetId === "REQ_AUTH") {
    return "Authenticate each account.";
  }
  if (targetId === "A <- X") {
    return "quoted source name";
  }
  return "auth service";
}

async function readRequirementEndpointEvidence(nodes: Locator) {
  const browserEvidence = await nodes.evaluateAll(readRequirementEndpointEvidenceInBrowser);
  return browserEvidence.map((endpoint) => ({
    ...endpoint,
    contrast: contrast(
      compositeColor(parseCssColor(endpoint.textColor), parseCssColor(endpoint.background), endpoint.opacity),
      compositeColor(parseCssColor(endpoint.background), parseCssColor(endpoint.rootBackground), 1)
    )
  }));
}

function readRequirementEndpointEvidenceInBrowser(elements: Element[]) {
  return elements.map((element) => {
    const label = element.querySelector("foreignObject .nodeLabel, .nodeLabel, text")!;
    const text = label.querySelector("p, span, text")!;
    const shape = element.querySelector(".label-container path")!;
    const root = document.querySelector(".theme-root")!;
    let opacity = 1;
    for (let current: Element | null = text; current; current = current.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(current).opacity);
    }
    return {
      id: element.id,
      text: label.textContent,
      textColor: getComputedStyle(text).color,
      background: getComputedStyle(shape).fill,
      rootBackground: getComputedStyle(root).getPropertyValue("--bg-base").trim(),
      opacity
    };
  });
}

async function expectRequirementRelation(page: Page, relationshipId: string, renderId: string): Promise<void> {
  const path = page.locator(`[data-testid="diagram-container"] .edgePaths > path[data-node-id="${relationshipId}"]`);
  const label = page.locator(`[data-testid="diagram-container"] .edgeLabels > .edgeLabel[data-node-id="${relationshipId}"]`);
  if (renderId.includes("cyclic-special-mid")) {
    await expect(path).toHaveCount(3);
    await expect(path.first()).toHaveAttribute("data-focus-state", "focused");
    const focusStates = await path.evaluateAll((paths) => paths.map((candidate) => candidate.getAttribute("data-focus-state")));
    const focusDebug = await path.evaluateAll((paths) => ({
      group: document.querySelector('[data-testid="diagram-container"]')?.getAttribute("data-focus-group-mode"),
      paths: paths.map((candidate) => ({ id: candidate.id, elementId: candidate.getAttribute("data-diagram-element-id"), focusState: candidate.getAttribute("data-focus-state"), group: candidate.getAttribute("data-focus-group") })),
      focused: Array.from(document.querySelectorAll('[data-focus-state="focused"]')).map((candidate) => ({ id: (candidate as SVGElement).id, elementId: candidate.getAttribute("data-diagram-element-id") })),
      stepTargets: Array.from(document.querySelectorAll('[data-step-target="true"]')).map((candidate) => candidate.getAttribute("data-diagram-element-id")),
      targetText: document.querySelector('[data-testid="step-text"]')?.textContent
    }));
    expect(focusStates, JSON.stringify(focusDebug)).toEqual(["focused", "focused", "focused"]);
  } else {
    await expect(path).toHaveCount(1);
    await expect(path).toHaveAttribute("id", renderId);
    await expect(path).toHaveAttribute("data-focus-state", "focused");
  }
  await expect(label.locator(`.label[data-id="${renderId}"]`)).toBeVisible();
  await expect(label).toContainText(relationshipId.includes("satisfies") ? "satisfies" : "verifies");
}

async function verifyRequirementRenderRegressions(page: Page, testInfo: { workerIndex: number }): Promise<void> {
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-requirement-regressions-${testInfo.workerIndex}` });
  const server = await startDevServer({
    args: ["./packages/web-player/test/fixtures/requirement/review-regressions.tour.yaml"],
    port
  });
  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    const longLabelRows = await page.locator('svg.requirementDiagram g.node[id="A <- X"]').evaluate(readRowGeometry);
    expectRequirementRows({ id: "A <- X", kind: "requirement", theme: "dark" }, longLabelRows);
    await expectRequirementRelation(page, "relationship-a-x-verifies-b", "diagram-tour-requirement-edge-0");
    await page.getByTestId("next-button").click();
    await expectRequirementRelation(page, "relationship-b-verifies-a-x", "diagram-tour-requirement-edge-1");
    await page.getByTestId("next-button").click();
    const selfLoop = "relationship-a-x-verifies-a-x";
    await expectRequirementRelation(page, selfLoop, "A <- X-cyclic-special-mid");
    await expectSelfLoopGeometry(page, selfLoop);
    await page.getByTestId("next-button").click();
    await expectRequirementRelation(page, "relationship-a-x-verifies-b-2", "diagram-tour-requirement-edge-4");
    await expect(page.locator('[data-node-id="relationship-a-x-contains-a-x"]')).toHaveCount(0);
  } finally {
    await server.stop();
  }
}

async function expectSelfLoopGeometry(page: Page, relationshipId: string): Promise<void> {
  const loops = await page.locator(`[data-testid="diagram-container"] .edgePaths > path[data-node-id="${relationshipId}"]`).evaluateAll((paths) =>
    paths.map((path) => ({ id: path.id, curve: path.getAttribute("d") ?? "" }))
  );
  expect(loops).toHaveLength(3);
  expect(loops.map(({ id }) => id).sort()).toEqual([
    "A <- X-cyclic-special-1",
    "A <- X-cyclic-special-2",
    "A <- X-cyclic-special-mid"
  ].sort());
  expect(loops.every(({ curve }) => curve.length > 0)).toBe(true);
  await expect(page.locator('.edgeLabels > .edgeLabel .label[data-id="A <- X-cyclic-special-mid"]')).toBeVisible();
}

async function waitForFocusAnimations(elements: Locator[]): Promise<void> {
  await Promise.all(elements.map((element) => element.evaluate(async (target) => {
    await Promise.all(target.getAnimations({ subtree: true }).map((animation) => animation.finished));
  })));
}

function readEffectiveOpacity(element: Element): number {
  let opacity = 1;
  for (let current: Element | null = element; current; current = current.parentElement) {
    opacity *= Number.parseFloat(getComputedStyle(current).opacity);
  }
  return opacity;
}

function readBrowserEvidence(element: Element, target: FocusTarget) {
  const root = document.querySelector(".theme-root")!;
  const label = readLabel(element, target);
  const text = readText(label);
  const shape = readShape(element, target);
  const shapeStyle = getComputedStyle(shape);
  const textStyle = getComputedStyle(text);
  const rootBackground = getComputedStyle(root).getPropertyValue("--bg-base").trim();
  const shapeBackground = readShapeBackground(shapeStyle.fill, rootBackground);
  const textBackground = readTextBackground(root, target, shapeBackground);
  const textColor = readTextColor(text, textStyle);
  return {
    targetOuterHTML: element.outerHTML.slice(0, 500),
    targetFocusState: element.getAttribute("data-focus-state"),
    textColor,
    textBackground,
    textContent: text.textContent,
    rootBackground,
    textOpacity: effectiveOpacity(text),
    textAncestors: ancestors(text),
    shapeStroke: shapeStyle.stroke,
    shapeFill: shapeStyle.fill,
    shapeBackground,
    shapeOpacity: effectiveOpacity(shape),
    shapeAncestors: ancestors(shape)
  };
  function effectiveOpacity(node: Element): number {
    let opacity = 1;
    for (let current: Element | null = node; current; current = current.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(current).opacity);
    }
    return opacity;
  }
  function ancestors(node: Element): string[] {
    const values: string[] = [];
    for (let current: Element | null = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      values.push(`${current.tagName}.${current.getAttribute("class")} opacity=${style.opacity} filter=${style.filter} blend=${style.mixBlendMode}`);
    }
    return values;
  }
  function readLabel(node: Element, focus: FocusTarget): Element {
    if (focus.kind !== "relationship") {
      return node;
    }
    return document.querySelector(`.edgeLabel[data-node-id="${focus.id}"] .label`) ?? node;
  }
  function readText(labelElement: Element): Element {
    return labelElement.querySelector("text, p, span, tspan") ?? labelElement;
  }
  function readShape(node: Element, focus: FocusTarget): Element {
    return document.querySelector(`[data-node-id="${focus.id}"].relationshipLine`)
      ?? node.querySelector(".label-container path")
      ?? node;
  }
  function readShapeBackground(fill: string, background: string): string {
    return fill === "none" ? background : fill;
  }
  function readTextBackground(themeRoot: Element, focus: FocusTarget, fill: string): string {
    if (focus.kind !== "relationship") {
      return fill;
    }
    return getComputedStyle(themeRoot).getPropertyValue("--color-edge-label-bg").trim();
  }
  function readTextColor(textElement: Element, styles: CSSStyleDeclaration): string {
    return textElement instanceof SVGElement && styles.fill !== "none" ? styles.fill : styles.color;
  }
}

function computeFocusEvidence(input: ReturnType<typeof readBrowserEvidence>) {
  const visibleText = compositeColor(parseCssColor(input.textColor), parseCssColor(input.textBackground), input.textOpacity);
  const visibleStroke = compositeColor(parseCssColor(input.shapeStroke), parseCssColor(input.shapeBackground), input.shapeOpacity);
  const visibleTextBackground = compositeColor(parseCssColor(input.textBackground), parseCssColor(input.rootBackground), 1);
  const visibleShapeBackground = compositeColor(parseCssColor(input.shapeBackground), parseCssColor(input.rootBackground), 1);
  return {
    ...input,
    textContrast: contrast(visibleText, visibleTextBackground),
    focusContrast: contrast(visibleStroke, visibleShapeBackground)
  };
}

function readRowGeometry(element: Element): RequirementRowEvidence[] {
  const shape = element.querySelector(".label-container path");
  if (shape === null) {
    return [];
  }
  const shapeRect = shape.getBoundingClientRect();
  return Array.from(element.querySelectorAll("foreignObject")).map((foreignObject) => {
    const label = foreignObject.querySelector(".nodeLabel, .edgeLabel") ?? foreignObject;
    const labelStyle = getComputedStyle(label);
    const box = foreignObject.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(label);
    const textRects = Array.from(range.getClientRects());
    return {
      text: foreignObject.textContent,
      shapeBounds: readBounds(shapeRect),
      shapeSvgBounds: readSvgBounds(shape),
      foreignObjectBounds: readBounds(box),
      foreignObjectSvgBounds: readSvgBounds(foreignObject),
      textRects: textRects.map(readBounds),
      fontCheckInter: document.fonts.check("12px Inter"),
      fontStatus: document.fonts.status,
      labelFontFamily: labelStyle.fontFamily,
      labelFontSize: labelStyle.fontSize,
      labelClientWidth: (label as HTMLElement).clientWidth,
      labelScrollWidth: (label as HTMLElement).scrollWidth,
      textRectsWithinForeignObject: areRectsWithin(textRects, box),
      foreignObjectWithinShape: isWithin(shapeRect, box),
      textRectsWithinShape: areRectsWithin(textRects, shapeRect)
    };
  });
  function areRectsWithin(rects: DOMRect[], container: DOMRect): boolean {
    return rects.length > 0 && rects.every((rect) => isWithin(container, rect));
  }
  function isWithin(container: DOMRect, content: DOMRect): boolean {
    const tolerance = 1;
    return [
      content.left >= container.left - tolerance,
      content.top >= container.top - tolerance,
      content.right <= container.right + tolerance,
      content.bottom <= container.bottom + tolerance
    ].every(Boolean);
  }
  function readBounds(rect: DOMRect): { left: number; right: number; top: number; bottom: number } {
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }
  function readSvgBounds(target: Element): { x: number; y: number; width: number; height: number } {
    const bounds = (target as SVGGraphicsElement).getBBox();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }
}

function parseCssColor(color: string): number[] {
  return color.startsWith("#") ? parseHexColor(color) : parseRgbColor(color);
}

function parseHexColor(color: string): number[] {
  const hex = color.slice(1);
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16) / 255).concat(1);
}

function parseRgbColor(color: string): number[] {
  const values = color.match(/[\d.]+%?/gu) ?? [];
  const alpha = readCssAlpha(values);
  return [0, 1, 2].map((index) => readCssChannel(values[index]!)).concat(alpha);
}

function readCssAlpha(values: string[]): number {
  return values.length > 3 ? readCssChannel(values[3]!) : 1;
}

function readCssChannel(value: string): number {
  const amount = Number.parseFloat(value);
  return value.endsWith("%") ? amount / 100 : amount / 255;
}

function compositeColor(front: number[], back: number[], opacity: number): number[] {
  const alpha = front[3]! * opacity;
  return [0, 1, 2].map((index) => front[index]! * alpha + back[index]! * (1 - alpha)).concat(1);
}

function contrast(first: number[], second: number[]): number {
  const values = [readLuminance(first), readLuminance(second)].sort((left, right) => right - left);
  return Number(((values[0]! + 0.05) / (values[1]! + 0.05)).toFixed(2));
}

function readLuminance(color: number[]): number {
  const weights = [0.2126, 0.7152, 0.0722];
  return color.slice(0, 3)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * weights[index]!, 0);
}
