import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

const FOCI = [
  ["person", "person-visitor"], ["system", "system-shop"], ["external-system", "system-payments"],
  ["container", "container-storefront"],
  ["component", "component-checkout"], ["deployment", "deployment-cloud"],
  ["boundary", "boundary-company"], ["relationship", "relationship-2"]
] as const;
const C4_SEMANTICS: Record<string, string> = { container: "container", deployment: "deployment", relationship: "relationship" };
const C4_VARIANTS = [
  ["C4Context", 'System_Boundary(outer, "Same") {\nSystem_Boundary(inner, "Same") {\nSystem(app, "App<br/>Server")\n}\n}\nPerson(user, "User")\nRel(user, app, "Uses<br/>Database", "TLS")', "Uses"],
  ["C4Container", 'Person(user, "User")\nSystem_Boundary(app, "App") {\nContainer(web, "Web", "Node", "Frontend")\n}\nRel(user, web, "Opens", "HTTPS")', "Opens"],
  ["C4Component", 'Person(user, "User")\nContainer_Boundary(web, "Web") {\nComponent(api, "API", "Node", "Service")\n}\nRel(user, api, "Calls", "HTTPS")', "Calls"],
  ["C4Dynamic", 'Person(user, "User")\nSystem(app, "App")\nRelIndex(1, user, app, "Uses", "HTTPS")', "Uses"],
  ["C4Deployment", 'Person(user, "User")\nDeployment_Node(cloud, "Cloud", "Provider", "Region") {\nContainer(app, "Application", "Runtime", "Service")\n}\nRel(user, app, "Deploys", "HTTPS")', "Deploys"],
  ["C4Context", 'System_Boundary(one, "Same") {\nSystem(a, "Same", "Inside")\n}\nSystem_Boundary(two, "Same") {\nSystem(b, "Same", "Outside")\n}\nPerson(user, "User")\nRel(user, a, "Inside relation", "HTTPS")', "Inside relation"],
  ["C4Context", 'System_Boundary(outer, "Outer") {\nSystem(a, "Same", $descr="Description")\n}\nSystem(b, "Same", $descr="Description")\nSystem_Ext(ext, "Same", $descr="Description")\nPerson(user, "User")\nRel(user, a, "Reads (cached)", $techn="HTTP")', "Reads (cached)"],
  ["C4Deployment", 'Deployment_Node(cloud, "Cloud", "Provider", "Region") {\nContainer(a, "Same", "Description")\n}\nContainer(b, "Same", "Description")\nDeployment_Node(region, "Region", "Provider", "Region") {\nContainer(c, "Same", "Description")\n}\nDeployment_Node(host, "Host", "Server", "Host") {\nContainer(d, "Same", "Description")\n}\nSystem(first, "Same", "Description", $tags="tagA")\nSystem(second, "Other")\nRel(first, second, "Reads [cache]")', "Reads [cache]"],
  ["C4Container", 'System(first, "Same", $tags="tagA")\nContainer(second, "Widget", $descr="Description", $techn="JS")', "Widget"],
  ["C4Context", 'Person(a, "A")\nSystem(b, "B")\nSystem(c, "C")\nRel(a, b, "First")\nRel(a, b, "Second")\nRel(b, c, "Third")', "Second"],
  ["C4Deployment", 'Deployment_Node(host01, "Application Host", $type="Infrastructure") {\nContainer(api, "API", "JS")\n}', "Infrastructure"],
  ["C4Deployment", 'Deployment_Node(host01, "Application Host") {\nContainer(api, "API", "JS")\n}', "[node]"]
] as const;
const C4_VARIANT_STEPS: Record<number, string[]> = {
  6: ["  - focus: [system-a]", "    text: The system is {{system-a}}.", "  - focus: [system-b]", "    text: The system is {{system-b}}.", "  - focus: [system-ext]", "    text: The external system is {{system-ext}}.", "  - focus: [relationship-1]", "    text: The relationship is {{relationship-1}}."],
  7: ["  - focus: [container-a]", "    text: The deployment container is {{container-a}}.", "  - focus: [system-first]", "    text: The tagged system is {{system-first}}.", "  - focus: [relationship-1]", "    text: The relationship is {{relationship-1}}."],
  8: ["  - focus: [system-first]", "    text: Tagged system {{system-first}}.", "  - focus: [container-second]", "    text: Named fields container {{container-second}}."],
  9: ["  - focus: [relationship-2]", "    text: Surviving relation {{relationship-2}}.", "  - focus: [relationship-3]", "    text: Final relation {{relationship-3}}."],
  10: ["  - focus: [deployment-host01]", "    text: Deployment host {{deployment-host01}}.", "  - focus: [container-api]", "    text: API container {{container-api}}."],
  11: ["  - focus: [deployment-host01]", "    text: Deployment host {{deployment-host01}}.", "  - focus: [container-api]", "    text: API container {{container-api}}."]
};
const C4_VARIANT_HANDLERS: Partial<Record<number, (page: Page, artifactPath: string) => Promise<void>>> = {
  6: assertC4PrefixFocusBothThemes,
  7: assertC4DeploymentRegression,
  8: (page, artifactPath) => captureC4VariantThemes({ page, artifactPath, index: 8, keys: ["system-first", "container-second"] }),
  9: (page, artifactPath) => captureC4VariantThemes({ page, artifactPath, index: 9, keys: ["relationship-2", "relationship-3"] }),
  10: (page, artifactPath) => captureC4VariantThemes({ page, artifactPath, index: 10, keys: ["deployment-host01", "container-api"] }),
  11: (page, artifactPath) => captureC4VariantThemes({ page, artifactPath, index: 11, keys: ["deployment-host01", "container-api"] })
};
const C4_VARIANT_ASSERTIONS: Partial<Record<number, (svg: Locator) => Promise<void>>> = {
  8: assertNamedC4Variant,
  9: assertRepeatedC4Relations,
  10: (svg) => assertDeploymentTypeMapping(svg, "Infrastructure"),
  11: (svg) => assertDeploymentTypeMapping(svg, "node")
};

test("C4 deployment focuses real SVG targets and stays legible across themes", async ({ page }, testInfo) => {
  test.setTimeout(360000);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("c4-smoke-theme-seeded") !== "true") {
      window.localStorage.setItem("diagram-tour-theme", "dark");
      window.sessionStorage.setItem("c4-smoke-theme-seeded", "true");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/c4/platform-context.tour.yaml"], port });
  const artifactPath = resolve(process.cwd(), "../../.loopard/artifacts/issue-62");
  const variantFixturePath = await mkdtemp(resolve(tmpdir(), "diagram-tours-c4-variants-"));
  const measurements: Array<Record<string, unknown>> = [];
  await mkdir(artifactPath, { recursive: true });

  try {
    await page.goto(server.baseUrl);
    const svg = page.getByTestId("diagram-container").locator("svg");
    await expect(svg).toBeVisible();
    await writeFile(resolve(artifactPath, "c4-rendered-dom.html"), await svg.evaluate((element) => element.outerHTML));
    for (const [key, label, technology] of [["relationship-1", "Browses and buys", "[HTTPS]"], ["relationship-2", "Authorizes payment", "[HTTPS]"], ["relationship-3", "Stores orders", "[SQL]"]]) {
      const targets = svg.locator(`[data-node-id="${key}"]`);
      const labels = svg.locator(`text[data-node-id="${key}"]`);
      const connector = svg.locator(`path[data-node-id="${key}"], line[data-node-id="${key}"]`);
      await expect(targets).toHaveCount(3);
      await expect(labels.filter({ hasText: label })).toHaveCount(1);
      await expect(labels.filter({ hasText: technology })).toHaveCount(1);
      await expect(connector).toHaveCount(1);
    }
    await captureTheme(page, { artifactPath, measurements, theme: "dark" });
    await rewind(page);
    await page.getByTestId("theme-toggle").click();
    await captureTheme(page, { artifactPath, measurements, theme: "light" });
    await writeFile(resolve(artifactPath, "computed-style-measurements.json"), JSON.stringify(measurements, null, 2));
    await page.reload();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await page.getByTestId("theme-toggle").click();
    await page.reload();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await assertAllC4Variants({ artifactPath, page, testInfo, variantFixturePath });
  } finally {
    await server.stop();
    await rm(variantFixturePath, { recursive: true, force: true });
  }
});

async function captureTheme(page: Page, input: { artifactPath: string; measurements: Array<Record<string, unknown>>; theme: string }): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", input.theme);
  for (const [index, [semantic, key]] of FOCI.entries()) {
    await captureFocus(page, { ...input, index, key, semantic });
  }
  await page.getByTestId("previous-button").click();
  await expectFocused(page, "boundary-company", { theme: input.theme });
}

async function assertAllC4Variants(input: { artifactPath: string; page: Page; testInfo: { workerIndex: number }; variantFixturePath: string }): Promise<void> {
  for (const [index, [header, source, label]] of C4_VARIANTS.entries()) {
    const variantPath = await writeC4Variant(input.variantFixturePath, { header, index, source });
    const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${input.testInfo.workerIndex}-c4-${header}` });
    const server = await startDevServer({ args: [variantPath], port });
    try {
      await input.page.goto(server.baseUrl);
      await writeFile(resolve(input.artifactPath, `variant-${index}-rendered.svg.html`),
        await input.page.getByTestId("diagram-container").locator("svg").evaluate((element) => element.outerHTML));
      await assertC4VariantSvg(input.page, label, index);
      await captureSpecialC4Variant(input.page, input.artifactPath, index);
    } finally {
      await server.stop();
    }
  }
}

async function writeC4Variant(fixturePath: string, input: { header: string; index: number; source: string }): Promise<string> {
  const name = `variant-${input.index}`;
  const diagramPath = resolve(fixturePath, `${name}.mmd`);
  const tourPath = resolve(fixturePath, `${name}.tour.yaml`);
  await writeFile(diagramPath, `${input.header}\n${input.source}\n`);
  await writeFile(tourPath, ["version: 1", `title: ${input.header}`, `diagram: ./${name}.mmd`, "steps:", ...readC4Steps(input.index)].join("\n"));
  return tourPath;
}

function readC4Steps(index: number): string[] {
  return C4_VARIANT_STEPS[index] ?? ["  - focus: [relationship-1]", "    text: The relationship is {{relationship-1}}."];
}

async function assertC4VariantSvg(page: Page, label: string, index: number): Promise<void> {
  const svg = page.getByTestId("diagram-container").locator("svg");
  await expect(svg).toBeVisible();
  const assertion = C4_VARIANT_ASSERTIONS[index];
  if (assertion !== undefined) { return assertion(svg); }
  const relationship = svg.locator('[data-node-id="relationship-1"]');
  const labels = svg.locator('text[data-node-id="relationship-1"]');
  if (index === 7) { await assertC4LiteralBracketLabels(relationship, labels); }
  else { await assertC4RenderedVariant({ svg, relationship, labels, index, label }); }
  await expect(svg.locator('path[data-node-id="relationship-1"], line[data-node-id="relationship-1"]')).toHaveCount(1);
}

async function assertNamedC4Variant(svg: Locator): Promise<void> {
  await expect(svg.locator('[data-node-id="system-first"]')).toHaveCount(1);
  await expect(svg.locator('[data-node-id="container-second"]')).toHaveCount(1);
  const labels = await svg.evaluate((root) => ["system-first", "container-second"].map((key) =>
    root.querySelector(`[data-node-id="${key}"]`)?.textContent?.replace(/\s+/gu, " ").trim()));
  expect(labels).toEqual(["<<system>>Same", "<<container>>Widget[JS]Description"]);
}

async function assertRepeatedC4Relations(svg: Locator): Promise<void> {
  await expect(svg.locator('[data-node-id="relationship-1"]')).toHaveCount(0);
  await expect(svg.locator('[data-node-id="relationship-2"]')).toHaveCount(2);
  await expect(svg.locator('[data-node-id="relationship-3"]')).toHaveCount(2);
  await expect(svg.locator('text[data-node-id="relationship-2"]')).toHaveText("Second");
  await expect(svg.locator('text[data-node-id="relationship-3"]')).toHaveText("Third");
}

async function assertDeploymentTypeMapping(svg: Locator, type: string): Promise<void> {
  const mapping = await svg.evaluate(readDeploymentTypeMapping);
  expect(mapping).toEqual({
    deploymentKind: "group",
    deploymentTexts: ["Application Host", `[${type}]`],
    containerClass: "person-man",
    containerText: "<<container>>API[JS]",
    childInsideDeployment: true
  });
  await expect(svg.locator('[data-node-id="deployment-host01"] > rect')).toHaveCount(1);
  await expect(svg.locator('.person-man[data-node-id="container-api"] rect')).toHaveCount(1);
}

function readDeploymentTypeMapping(root: SVGSVGElement): {
  deploymentKind: string | null | undefined;
  deploymentTexts: Array<string | undefined>;
  containerClass: string | null | undefined;
  containerText: string;
  childInsideDeployment: boolean;
} {
  const deployment = root.querySelector<SVGGElement>('[data-node-id="deployment-host01"]')!;
  const container = root.querySelector<SVGGElement>('[data-node-id="container-api"]')!;
  const deploymentBounds = deployment.querySelector("rect")!.getBoundingClientRect();
  const childBounds = container.querySelector("rect")!.getBoundingClientRect();
  return {
    deploymentKind: deployment.getAttribute("data-diagram-element-kind"),
    deploymentTexts: readDeploymentTexts(deployment),
    containerClass: container.getAttribute("class"),
    containerText: container.textContent?.replace(/\s+/gu, "") ?? "",
    childInsideDeployment: areBoundsInside(deploymentBounds, childBounds)
  };

  function readDeploymentTexts(target: SVGGElement): Array<string | undefined> {
    return Array.from(target.querySelectorAll("text"), (text) => text.textContent?.trim());
  }

  function areBoundsInside(container: DOMRect, child: DOMRect): boolean {
    return areHorizontalBoundsInside(container, child) && areVerticalBoundsInside(container, child);
  }

  function areHorizontalBoundsInside(container: DOMRect, child: DOMRect): boolean {
    return container.left <= child.left && container.right >= child.right;
  }

  function areVerticalBoundsInside(container: DOMRect, child: DOMRect): boolean {
    return container.top <= child.top && container.bottom >= child.bottom;
  }
}

async function assertC4RenderedVariant(input: { svg: Locator; relationship: Locator; labels: Locator; index: number; label: string }): Promise<void> {
  await assertC4TargetCounts(input.relationship, input.labels, input.index);
  if (input.index === 0) { await assertC4BreakLabels(input.svg, input.labels); }
  else {
    await assertC4IdentityVariant(input.svg, input.index);
    await assertC4PlainLabels(input.labels, input.label, readC4Technology(input.index));
  }
}

function readC4Technology(index: number): string {
  return index === 6 ? "[HTTP]" : "[HTTPS]";
}

async function assertC4LiteralBracketLabels(relationship: Locator, labels: Locator): Promise<void> {
  await expect(relationship).toHaveCount(2);
  await expect(labels).toHaveCount(1);
  await expect(labels.filter({ hasText: "Reads [cache]" })).toHaveCount(1);
}

async function captureSpecialC4Variant(page: Page, artifactPath: string, index: number): Promise<void> {
  await C4_VARIANT_HANDLERS[index]?.(page, artifactPath);
}

async function captureC4VariantThemes(input: { page: Page; artifactPath: string; index: number; keys: string[] }): Promise<void> {
  const measurements: Array<Record<string, unknown>> = [];
  for (const theme of ["dark", "light"] as const) {
    await captureC4VariantTheme({ ...input, measurements, theme });
  }
  await writeFile(resolve(input.artifactPath, `variant-${input.index}-computed-style-measurements.json`), JSON.stringify(measurements, null, 2));
}

async function captureC4VariantTheme(input: { page: Page; artifactPath: string; index: number; keys: string[]; measurements: Array<Record<string, unknown>>; theme: "dark" | "light" }): Promise<void> {
  await setC4Theme(input.page, input.theme);
  if (input.theme === "light") { await rewindVariantSteps(input.page, input.keys.length - 1); }
  await captureVariantSteps(input);
  await reloadLightC4Variant(input.page, input.theme);
}

async function reloadLightC4Variant(page: Page, theme: "dark" | "light"): Promise<void> {
  await page.reload();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", theme);
}

async function captureVariantSteps(input: { page: Page; artifactPath: string; index: number; keys: string[]; measurements: Array<Record<string, unknown>>; theme: "dark" | "light" }): Promise<void> {
  for (const [step, key] of input.keys.entries()) {
    if (step > 0) { await input.page.getByTestId("next-button").click(); }
    const semantic = readC4Semantic(key);
    await expectFocused(input.page, key, { theme: input.theme, targetCount: readVariantTargetCount(semantic) });
    await waitForC4Legibility(input.page, key, input.theme);
    const measurement = await readMeasurement(input.page, { key, semantic, theme: input.theme });
    const artifact = resolve(input.artifactPath, `variant-${input.index}-${key}-${input.theme}.png`);
    const screenshot = await input.page.screenshot({ path: artifact, fullPage: true });
    const raster = await readRasterTextContrast(input.page, key, screenshot);
    measurement.rasterText = raster;
    input.measurements.push(measurement);
    await writeFile(resolve(input.artifactPath, `variant-${input.index}-computed-style-measurements.json`), JSON.stringify(input.measurements, null, 2));
    expect(raster.every(({ contrast, inkPixels }) => contrast >= 4.5 && inkPixels > 0), JSON.stringify({ raster, styles: measurement.textMeasurements })).toBe(true);
    assertC4Legibility(measurement);
  }
}

function readVariantTargetCount(semantic: string): number {
  return semantic === "relationship" ? 2 : 1;
}

async function readRasterTextContrast(page: Page, key: string, screenshot: Buffer): Promise<Array<{ contrast: number; inkPixels: number; text: string }>> {
  return page.evaluate(async ({ base64, targetKey }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, image.width, image.height).data;
    const targets = Array.from(document.querySelectorAll(`[data-node-id="${targetKey}"]`));
    const texts = targets.flatMap((target) => target.matches("text") ? [target] : Array.from(target.querySelectorAll("text")));
    return texts.map(readTextContrast);

    function readTextContrast(text: Element): { contrast: number; inkPixels: number; text: string } {
      const contrasts = readTextPixels(text.getBoundingClientRect(), readRasterTextBackground(text));
      return { contrast: Math.max(...contrasts), inkPixels: contrasts.length, text: readTextContent(text) };
    }

    function readRasterTextBackground(text: Element): number[] {
      const shape = text.closest("g.person-man")?.querySelector("rect");
      return shape ? readShapeBackground(shape) : readCanvasBackground();
    }

    function readCanvasBackground(): number[] {
      const root = document.querySelector("[data-testid='theme-root']")!;
      return readColor(getComputedStyle(root).getPropertyValue("--bg-base"));
    }

    function readShapeBackground(shape: Element): number[] {
      const bounds = shape.getBoundingClientRect();
      return readPixel(bounds.left + 5, bounds.top + 5);
    }

    function readTextContent(text: Element): string {
      return text.textContent?.trim() ?? "";
    }

    function readTextPixels(bounds: DOMRect, background: number[]): number[] {
      const scale = image.width / document.documentElement.clientWidth;
      const area = {
        top: Math.max(0, Math.floor((bounds.top + window.scrollY) * scale)),
        left: Math.max(0, Math.floor(bounds.left * scale)),
        bottom: Math.min(image.height, Math.ceil((bounds.bottom + window.scrollY) * scale)),
        right: Math.min(image.width, Math.ceil(bounds.right * scale))
      };
      return Array.from({ length: area.bottom - area.top }, (_, row) => readTextPixelRow(area, row, background)).flat();
    }

    function readTextPixelRow(area: { left: number; top: number; right: number }, row: number, background: number[]): number[] {
      return Array.from({ length: area.right - area.left }, (_, column) =>
        readRasterPixelContrast(area.left + column, area.top + row, background)).filter(isRasterContrast);
    }

    function isRasterContrast(value: number | undefined): value is number {
      return value !== undefined;
    }

    function readRasterPixelContrast(x: number, y: number, background: number[]): number | undefined {
      const foreground = pixelAt(x, y);
      return maxChannelDistance(foreground, background) > 20 ? ratio(foreground, background) : undefined;
    }

    function readPixel(x: number, y: number): number[] {
      const scale = image.width / document.documentElement.clientWidth;
      return pixelAt(Math.round(x * scale), Math.round((y + window.scrollY) * scale));
    }

    function pixelAt(x: number, y: number): number[] {
      const offset = (y * image.width + x) * 4;
      return [imageData[offset]!, imageData[offset + 1]!, imageData[offset + 2]!];
    }

    function readColor(color: string): number[] {
      const hex = color.trim().match(/^#([\da-f]{6})$/iu)?.[1];
      return hex === undefined ? readRgbColor(color) : readHexColor(hex);
    }

    function readHexColor(hex: string): number[] {
      return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    }

    function readRgbColor(color: string): number[] {
      const channels = color.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
      return channels === undefined ? [250, 250, 250] : channels;
    }

    function maxChannelDistance(first: number[], second: number[]): number {
      return Math.max(...first.map((channel, index) => Math.abs(channel - second[index]!)));
    }

    function ratio(first: number[], second: number[]): number {
      const levels = [luminance(first), luminance(second)].sort((left, right) => right - left);
      return Number(((levels[0]! + 0.05) / (levels[1]! + 0.05)).toFixed(2));
    }

    function luminance(rgb: number[]): number {
      const channels = rgb.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    }
  }, { targetKey: key, base64: screenshot.toString("base64") });
}

async function rewindVariantSteps(page: Page, count: number): Promise<void> {
  for (let step = 0; step < count; step += 1) { await page.getByTestId("previous-button").click(); }
}

async function assertC4DeploymentRegression(page: Page, artifactPath: string): Promise<void> {
  const svg = page.getByTestId("diagram-container").locator("svg");
  const rendered = await svg.evaluate(readDeploymentMappings, [["a", "cloud"], ["b", undefined], ["c", "region"], ["d", "host"]]);
  const mappings = rendered.map(({ alias, mapped, scopeBounds, targetBounds }) => ({ alias, mapped, insideScope: scopeBounds === null || isWithinBounds(scopeBounds, targetBounds) }));
  expect(mappings).toEqual(["a", "b", "c", "d"].map((alias) => ({ alias, mapped: true, insideScope: true })));
  await expect(svg.locator('[data-node-id="system-first"]')).toHaveCount(1);
  await expect(svg.locator('text[data-node-id="relationship-1"]')).toHaveText("Reads [cache]");
  const measurements: Array<Record<string, unknown>> = [];
  await captureDeploymentTheme({ page, artifactPath, measurements, theme: "light" });
  await captureDeploymentTheme({ page, artifactPath, measurements, theme: "dark" });
  await writeFile(resolve(artifactPath, "variant-7-computed-style-measurements.json"), JSON.stringify(measurements, null, 2));
}

function readDeploymentMappings(root: SVGSVGElement, scopes: Array<[string, string | undefined]>): Array<{ alias: string; mapped: boolean; scopeBounds: DOMRect | null; targetBounds: DOMRect }> {
  return scopes.map(([alias, scopeId]) => {
    const target = root.querySelector(`[data-node-id="container-${alias}"]`)!;
    const scope = root.querySelector(`[data-node-id="deployment-${scopeId}"] rect`);
    return { alias, mapped: target !== null, scopeBounds: scope?.getBoundingClientRect() ?? null, targetBounds: target.getBoundingClientRect() };
  });
}

function isWithinBounds(scope: DOMRect, target: DOMRect): boolean {
  return isWithinHorizontalBounds(scope, target) && isWithinVerticalBounds(scope, target);
}

function isWithinHorizontalBounds(scope: DOMRect, target: DOMRect): boolean {
  return scope.left <= target.left && scope.right >= target.right;
}

function isWithinVerticalBounds(scope: DOMRect, target: DOMRect): boolean {
  return scope.top <= target.top && scope.bottom >= target.bottom;
}

async function captureDeploymentTheme(input: { page: Page; artifactPath: string; measurements: Array<Record<string, unknown>>; theme: "light" | "dark" }): Promise<void> {
  await setC4Theme(input.page, input.theme);
  if (input.theme === "dark") { await rewindDeploymentSteps(input.page); }
  await captureDeploymentSteps(input);
}

async function captureDeploymentSteps(input: { page: Page; artifactPath: string; measurements: Array<Record<string, unknown>>; theme: "light" | "dark" }): Promise<void> {
  for (const [index, key] of ["container-a", "system-first", "relationship-1"].entries()) {
    if (index > 0) { await input.page.getByTestId("next-button").click(); }
    await captureDeploymentFocus({ ...input, key });
  }
}

async function rewindDeploymentSteps(page: Page): Promise<void> {
  await page.getByTestId("previous-button").click();
  await page.getByTestId("previous-button").click();
}

async function captureDeploymentFocus(input: { page: Page; artifactPath: string; key: string; measurements: Array<Record<string, unknown>>; theme: "light" | "dark" }): Promise<void> {
  await expectFocused(input.page, input.key, { theme: input.theme, targetCount: readDeploymentTargetCount(input.key) });
  await input.page.getByRole("button", { name: "Fit diagram to view" }).click();
  const semantic = readDeploymentSemantic(input.key);
  await waitForC4Legibility(input.page, input.key, input.theme);
  const measurement = await readMeasurement(input.page, { key: input.key, semantic, theme: input.theme });
  input.measurements.push(measurement);
  await writeFile(resolve(input.artifactPath, "variant-7-computed-style-measurements.json"), JSON.stringify(input.measurements, null, 2));
  assertC4Legibility(measurement);
  await input.page.screenshot({ path: resolve(input.artifactPath, `variant-7-${input.key}-${input.theme}.png`), fullPage: true });
}

function readDeploymentTargetCount(key: string): number {
  return key === "relationship-1" ? 2 : 1;
}

function readDeploymentSemantic(key: string): string {
  if (key === "relationship-1") { return "relationship"; }
  return key === "container-a" ? "container" : "system";
}

async function assertC4IdentityVariant(svg: Locator, index: number): Promise<void> {
  if (index === 5) { await assertDuplicateC4Identities(svg); }
  if (index === 6) { await assertC4PrefixIdentities(svg); }
}

async function assertC4PrefixIdentities(svg: Locator): Promise<void> {
  const rendered = await svg.evaluate((root) => ["a", "b", "ext"].map((id) => {
    const target = root.querySelector(`[data-node-id="system-${id}"]`);
    return target === null ? null : { id: target.getAttribute("data-node-id"), text: target.textContent?.replace(/\s+/gu, " ").trim() };
  }));
  expect(rendered).toEqual([
    { id: "system-a", text: "<<system>>SameDescription" },
    { id: "system-b", text: "<<system>>SameDescription" },
    { id: "system-ext", text: "<<external_system>>SameDescription" }
  ]);
}

async function assertC4PrefixFocusBothThemes(page: Page, artifactPath: string): Promise<void> {
  const measurements: Array<Record<string, unknown>> = [];
  for (const theme of ["light", "dark"] as const) {
    await setC4Theme(page, theme);
    if (theme === "dark") { await rewindC4Prefix(page); }
    await captureC4PrefixKeys({ page, artifactPath, measurements, theme });
  }
  await writeFile(resolve(artifactPath, "variant-6-computed-style-measurements.json"), JSON.stringify(measurements, null, 2));
}

async function rewindC4Prefix(page: Page): Promise<void> {
  for (let step = 0; step < 3; step += 1) { await page.getByTestId("previous-button").click(); }
}

async function captureC4PrefixKeys(input: { page: Page; artifactPath: string; measurements: Array<Record<string, unknown>>; theme: "light" | "dark" }): Promise<void> {
  for (const [index, key] of ["system-a", "system-b", "system-ext", "relationship-1"].entries()) {
    if (index > 0) { await input.page.getByTestId("next-button").click(); }
    await captureC4PrefixKey({ ...input, key });
  }
}

async function captureC4PrefixKey(input: { page: Page; artifactPath: string; key: string; measurements: Array<Record<string, unknown>>; theme: "light" | "dark" }): Promise<void> {
  await expectFocused(input.page, input.key, { theme: input.theme });
  await input.page.getByRole("button", { name: "Fit diagram to view" }).click();
  await waitForC4Legibility(input.page, input.key, input.theme);
  const measurement = await readMeasurement(input.page, { key: input.key, semantic: readC4Semantic(input.key), theme: input.theme });
  assertC4Legibility(measurement);
  input.measurements.push(measurement);
  await input.page.screenshot({ path: resolve(input.artifactPath, `variant-6-${input.key}-${input.theme}.png`), fullPage: true });
}

function readC4Semantic(key: string): string {
  return C4_SEMANTICS[key.slice(0, key.indexOf("-"))] ?? "system";
}

async function waitForC4Legibility(page: Page, key: string, theme: string): Promise<void> {
  await expect.poll(async () => {
    const measurement = await readMeasurement(page, { key, semantic: readC4Semantic(key), theme });
    return (measurement.effectiveOpacity as number) >= 0.9 &&
      (measurement.textContrast as number) >= 4.5 && (measurement.figureContrast as number) >= 3;
  }).toBe(true);
}

async function setC4Theme(page: Page, theme: "light" | "dark"): Promise<void> {
  const themeRoot = page.getByTestId("theme-root");
  if (await themeRoot.getAttribute("data-theme") !== theme) { await page.getByTestId("theme-toggle").click(); }
  await expect.poll(() => readC4ThemeState(page)).toEqual(readC4ExpectedTheme(theme));
}

function readC4ExpectedTheme(theme: "light" | "dark"): { theme: string; background: string; toggle: string } {
  if (theme === "light") { return { theme, background: "#fafafa", toggle: "Dark mode" }; }
  return { theme, background: "#0e1116", toggle: "Light mode" };
}

async function readC4ThemeState(page: Page): Promise<{ theme: string | null; background: string; toggle: string }> {
  return page.evaluate(() => {
    const themeRoot = document.querySelector<HTMLElement>("[data-testid='theme-root']")!;
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='theme-toggle']")!;
    return {
      theme: themeRoot.getAttribute("data-theme"),
      background: getComputedStyle(themeRoot).getPropertyValue("--bg-base").trim(),
      toggle: toggle.textContent?.trim() ?? ""
    };
  });
}

async function assertDuplicateC4Identities(svg: Locator): Promise<void> {
  const members = await svg.evaluate((root, pairs: string[][]) => pairs.map(([boundary, member, other]) => {
    const rect = root.querySelector(`[data-node-id="boundary-${boundary}"] rect`)!.getBoundingClientRect();
    const system = root.querySelector(`[data-node-id="system-${member}"]`)!.getBoundingClientRect();
    const otherSystem = root.querySelector(`[data-node-id="system-${other}"]`)!.getBoundingClientRect();
    const contains = (inner: DOMRect) => Math.min(inner.left - rect.left, rect.right - inner.right, inner.top - rect.top, rect.bottom - inner.bottom) >= 0;
    return { containsMember: contains(system), excludesOther: !contains(otherSystem) };
  }), [["one", "a", "b"], ["two", "b", "a"]]);
  expect(members).toEqual([{ containsMember: true, excludesOther: true }, { containsMember: true, excludesOther: true }]);
}

async function assertC4TargetCounts(relationship: Locator, labels: Locator, index: number): Promise<void> {
  if (index === 0) {
    await expect(relationship).toHaveCount(4);
    await expect(labels).toHaveCount(3);
  } else {
    await expect(relationship).toHaveCount(3);
    await expect(labels).toHaveCount(2);
  }
}

async function assertC4BreakLabels(svg: Locator, labels: Locator): Promise<void> {
  await expect(labels.filter({ hasText: "Uses" })).toHaveCount(1);
  await expect(labels.filter({ hasText: "Database" })).toHaveCount(1);
  await expect(labels.filter({ hasText: "[TLS]" })).toHaveCount(1);
  await expect(svg.locator('[data-node-id="system-app"]')).toHaveCount(1);
  const boundarySizes = await svg.evaluate((root) => ["boundary-outer", "boundary-inner"].map((key) => {
    const rect = root.querySelector(`[data-node-id="${key}"] rect`)!;
    const { width, height } = rect.getBoundingClientRect();
    return width * height;
  }));
  expect(boundarySizes[0]).toBeGreaterThan(boundarySizes[1]!);
}

async function assertC4PlainLabels(labels: Locator, label: string, technology: string): Promise<void> {
  await expect(labels.filter({ hasText: label })).toHaveCount(1);
  await expect(labels.filter({ hasText: technology })).toHaveCount(1);
}

async function captureFocus(page: Page, input: { artifactPath: string; index: number; key: string; measurements: Array<Record<string, unknown>>; semantic: string; theme: string }): Promise<void> {
  if (input.index > 0) {
    await page.getByTestId("next-button").click();
    await expectNotFocused(page, FOCI[input.index - 1]![1]);
  }
  await expectFocused(page, input.key, { theme: input.theme });
  await page.getByRole("button", { name: "Fit diagram to view" }).click();
  await waitForC4Legibility(page, input.key, input.theme);
  const measurement = await readMeasurement(page, { key: input.key, semantic: input.semantic, theme: input.theme });
  input.measurements.push(measurement);
  await writeFile(resolve(input.artifactPath, "computed-style-measurements.json"), JSON.stringify(input.measurements, null, 2));
  await page.screenshot({ path: resolve(input.artifactPath, `c4-${input.semantic}-${input.theme}.png`), fullPage: true });
  assertC4Legibility(measurement);
}

function assertC4Legibility(measurement: Record<string, unknown>): void {
  expect(measurement.textContrast, `${measurement.semantic} text contrast in ${measurement.theme}`).toBeGreaterThanOrEqual(4.5);
  expect(measurement.figureContrast, `${measurement.semantic} figure contrast in ${measurement.theme}`).toBeGreaterThanOrEqual(3);
  expect(measurement.effectiveOpacity, `${measurement.semantic} effective opacity in ${measurement.theme}`).toBeGreaterThanOrEqual(0.9);
  if (measurement.semantic === "relationship" || measurement.semantic === "deployment") {
    assertNoTextStroke(measurement);
  }
}

function assertNoTextStroke(measurement: Record<string, unknown>): void {
  for (const text of measurement.textMeasurements as Array<{ stroke: string }>) {
    expect(text.stroke, `${measurement.semantic} text stroke in ${measurement.theme}`).toBe("none");
  }
}

async function expectFocused(page: Page, key: string, input: { theme: string; targetCount?: number }): Promise<void> {
  const targets = page.locator(`[data-testid="diagram-container"] [data-node-id="${key}"]`);
  const targetCount = input.targetCount ?? readFocusTargetCount(key);
  await expect(targets).toHaveCount(targetCount);
  await expect.poll(() => targets.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-focus-state"))))
    .toEqual(Array.from({ length: targetCount }, () => "focused"));
  await expect.poll(() => readFocusCue(targets.first(), key)).toBe(readExpectedFocusCue(key, input.theme));
}

function readFocusTargetCount(key: string): number {
  return /^relationship-/.test(key) ? 3 : 1;
}

async function expectNotFocused(page: Page, key: string): Promise<void> {
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${key}"]`).first())
    .toHaveAttribute("data-focus-state", "dimmed");
}

async function readFocusCue(target: Locator, key: string): Promise<string | null> {
  const cueSelector = readFocusCueSelector(key);
  if (cueSelector === null) { return readDropShadowCue(target); }
  return target.evaluate((element, selector) => {
    const shape = element.matches(selector) ? element : element.querySelector(selector);
    return shape === null ? null : getComputedStyle(shape).stroke;
  }, cueSelector);
}

async function readDropShadowCue(target: Locator): Promise<string | null> {
  const filter = await target.evaluate((element) => getComputedStyle(element).filter);
  return filter.includes("drop-shadow") ? "drop-shadow" : null;
}

function readFocusCueSelector(key: string): string | null {
  if (/^relationship-/.test(key)) { return "path, line"; }
  return /^(container|boundary|deployment)-/.test(key) ? "rect" : null;
}

function readExpectedFocusCue(key: string, theme: string): string {
  const cues: Record<string, Record<string, string>> = {
    relationship: { light: "rgb(29, 78, 216)", dark: "rgb(147, 197, 253)" },
    container: { light: "rgb(11, 18, 32)", dark: "rgb(255, 255, 255)" },
    boundary: { light: "rgb(59, 130, 246)", dark: "rgb(59, 130, 246)" },
    deployment: { light: "rgb(59, 130, 246)", dark: "rgb(59, 130, 246)" },
  };
  return cues[key.split("-")[0]]?.[theme] ?? "drop-shadow";
}

async function rewind(page: Page): Promise<void> {
  for (let step = 0; step < FOCI.length - 2; step += 1) {
    await page.getByTestId("previous-button").click();
  }
}

async function readMeasurement(page: Page, input: { key: string; semantic: string; theme: string }): Promise<Record<string, unknown>> {
  const target = page.locator(`[data-testid="diagram-container"] [data-node-id="${input.key}"]`).first();
  return target.evaluate((element, data) => {
    const targets = Array.from(document.querySelectorAll(`[data-node-id="${data.key}"]`));
    const descendants = targets.flatMap(readTargetDescendants);
    const styles = descendants.map((child) => {
      const style = getComputedStyle(child);
      return { color: style.color, fill: style.fill, fillOpacity: style.fillOpacity, opacity: style.opacity, stroke: style.stroke, strokeOpacity: style.strokeOpacity, filter: style.filter };
    });
    const root = document.querySelector("[data-testid='theme-root']")!;
    const canvas = resolveCssColor(getComputedStyle(root).getPropertyValue("--bg-base").trim());
    const textTargets = readC4TextTargets(targets, element);
    const figureTarget = readC4FigureTarget(element);
    const textMeasurements = textTargets.map((textTarget) => readTextMeasurement(textTarget, canvas));
    const figureStyle = getComputedStyle(figureTarget);
    const labelBackground = readFirstTextBackground(textMeasurements, canvas);
    const figureColor = readComputedFigureColor(figureStyle);
    const figureOpacity = figureStyle.stroke !== "none" ? Number(figureStyle.strokeOpacity) : Number(figureStyle.fillOpacity);
    const figureColors = resolveSvgColors({ color: figureColor, source: figureTarget, backdrop: canvas, paintOpacity: figureOpacity });
    const effectiveOpacity = Math.min(...targets.flatMap((target) => [target, ...Array.from(target.querySelectorAll("*"))]
      .map(readEffectiveOpacity)));
    return {
      ...data,
      background: labelBackground,
      computed: styles,
      textMeasurements,
      effectiveOpacity,
      figureFill: figureStyle.fill,
      figureStroke: figureStyle.stroke,
      figureContrast: Math.min(...figureColors.map((color) => contrastRatio(color, labelBackground))),
      textContrast: Math.min(...textMeasurements.map(({ contrast }) => contrast))
    };

    function readEffectiveOpacity(child: Element): number {
      let opacity = 1;
      let current: Element | null = child;
      while (current !== null) {
        opacity *= Number(getComputedStyle(current).opacity);
        current = current.parentElement;
      }
      return opacity;
    }

    function readTargetDescendants(target: Element): Element[] {
      return [target, ...Array.from(target.querySelectorAll("*"))];
    }

    function contrastRatio(first: number[], second: number[]): number {
      const levels = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return Number(((levels[0]! + 0.05) / (levels[1]! + 0.05)).toFixed(2));
    }

    function resolveCssColor(color: string): number[] {
      return parseColor(color)!;
    }

    function resolveSvgColors(input: { color: string; source: Element; backdrop: number[]; paintOpacity?: number }): number[][] {
      const { color, source, backdrop, paintOpacity = 1 } = input;
      const stops = readGradientStops(color, source);
      return (stops.length > 0 ? stops : [color]).map((value) => composite(parseColor(value)!, backdrop, readEffectiveOpacity(source) * paintOpacity));
    }

    function readGradientStops(color: string, source: Element): string[] {
      const id = readGradientId(color);
      if (id === undefined) { return []; }
      const gradient = source.ownerDocument.getElementById(id);
      if (gradient === null) { return []; }
      return readStopColors(gradient);
    }

    function readGradientId(color: string): string | undefined {
      return color.match(/^url\(#(.+)\)$/u)?.[1];
    }

    function readStopColors(gradient: Element): string[] {
      return Array.from(gradient.querySelectorAll("stop"), (stop) => getComputedStyle(stop).stopColor);
    }

    function parseColor(color: string): number[] | null {
      return readHexColor(color) ?? readRgbColor(color);
    }

    function readHexColor(color: string): number[] | null {
      const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/iu)?.[1];
      if (hex === undefined) { return null; }
      return readHexChannels(expandShortHex(hex));
    }

    function expandShortHex(hex: string): string {
      return hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
    }

    function readHexChannels(hex: string): number[] {
      return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)).concat(1);
    }

    function readRgbColor(color: string): number[] | null {
      const channels = color.match(/[\d.]+/gu)?.map(Number);
      if (!hasRgbChannels(channels)) { return null; }
      return readRgbChannels(channels);
    }

    function hasRgbChannels(channels: number[] | undefined): channels is number[] {
      return channels !== undefined && channels.length >= 3;
    }

    function readRgbChannels(channels: number[]): number[] {
      return [channels[0]!, channels[1]!, channels[2]!, channels[3] ?? 1];
    }

    function composite(foregroundColor: number[], backgroundColor: number[], opacity: number): number[] {
      const alpha = foregroundColor[3]! * opacity;
      return foregroundColor.slice(0, 3).map((channel, index) => channel * alpha + backgroundColor[index]! * (1 - alpha));
    }

    function readTextMeasurement(text: Element, canvasColor: number[]): {
      text: string; fill: string; stroke: string; opacity: number; fillOpacity: number; background: number[]; contrast: number; opacityChain: Record<string, unknown>[];
      bounds: { x: number; y: number; width: number; height: number }; focusState: string | null;
    } {
      const style = getComputedStyle(text);
      const background = readTextBackground(text, canvasColor);
      const fillOpacity = Number(style.fillOpacity);
      const foregrounds = resolveSvgColors({ color: style.fill, source: text, backdrop: background, paintOpacity: fillOpacity });
      return {
        text: normalizeText(text),
        fill: style.fill,
        stroke: style.stroke,
        opacity: readEffectiveOpacity(text),
        fillOpacity,
        background,
        opacityChain: readOpacityChain(text),
        bounds: readTextBounds(text),
        focusState: text.getAttribute("data-focus-state"),
        contrast: Math.min(...foregrounds.map((color) => contrastRatio(color, background)))
      };
    }

    function readTextBounds(text: Element): { x: number; y: number; width: number; height: number } {
      const { x, y, width, height } = text.getBoundingClientRect();
      return { x, y, width, height };
    }

    function readOpacityChain(text: Element): Record<string, unknown>[] {
      const chain: Record<string, unknown>[] = [];
      let current: Element | null = text;
      while (current !== null) {
        const style = getComputedStyle(current);
        chain.push({ tag: current.tagName, class: current.getAttribute("class"), opacity: style.opacity, fillOpacity: style.fillOpacity, strokeOpacity: style.strokeOpacity, filter: style.filter, mixBlendMode: style.mixBlendMode });
        current = current.parentElement;
      }
      return chain;
    }

    function readTextBackground(text: Element, canvasColor: number[]): number[] {
      const rect = text.closest("g")?.querySelector("rect");
      if (hasNoTextShapeBackground(rect)) { return canvasColor; }
      const style = getComputedStyle(rect);
      return resolveSvgColors({ color: style.fill, source: rect, backdrop: canvasColor, paintOpacity: Number(style.fillOpacity) })[0]!;
    }

    function hasNoTextShapeBackground(rect: Element | null | undefined): boolean {
      return rect === null || rect === undefined || getComputedStyle(rect).fill === "none";
    }

    function normalizeText(text: Element): string {
      return text.textContent?.replace(/\s+/gu, " ").trim() ?? "";
    }

    function luminance(rgb: number[]): number {
      const channels = rgb.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    }

    function readC4TextTargets(relatedTargets: Element[], focusedTarget: Element): Element[] {
      const explicitText = relatedTargets.filter((target) => ["text", "foreignobject"].includes(target.tagName.toLowerCase()));
      return explicitText.length > 0 ? explicitText : Array.from(focusedTarget.querySelectorAll("text, foreignObject"));
    }

    function readFirstTextBackground(texts: Array<{ background: number[] }>, canvasColor: number[]): number[] {
      return texts.length === 0 ? canvasColor : texts[0]!.background;
    }

    function readComputedFigureColor(style: CSSStyleDeclaration): string {
      return style.stroke === "none" ? style.fill : style.stroke;
    }

    function readC4FigureTarget(focusedTarget: Element): Element {
      if (focusedTarget.matches("path, line")) {
        return focusedTarget;
      }
      return focusedTarget.querySelector("rect, path, line") ?? focusedTarget;
    }

  }, input);
}
