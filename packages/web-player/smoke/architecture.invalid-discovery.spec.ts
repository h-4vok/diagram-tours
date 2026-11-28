import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

test("skips colliding Architecture sources and serves the valid route", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const artifactPath = resolve(process.cwd(), "../../.loopard/artifacts/issue-64");
  const fixturePath = await mkdtemp(resolve(tmpdir(), "diagram-tours-architecture-invalid-discovery-"));
  await createDiscoveryFixture(fixturePath);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("architecture-discovery-theme-seeded") !== "true") {
      window.localStorage.setItem("diagram-tour-theme", "dark");
      window.sessionStorage.setItem("architecture-discovery-theme-seeded", "true");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: [fixturePath], port });

  try {
    await assertCollectionRoutes(page, server.baseUrl);
    await assertMixedMarkdownRoutes(page, server.baseUrl, artifactPath);
    await assertSkippedDiagnostic(page, artifactPath);
    await assertEmptyGroupRenders(page, server.baseUrl, artifactPath);
    await page.goto(`${server.baseUrl}/a-valid`);
    await captureHyphenatedGroup(page, artifactPath, "dark");
    await page.getByTestId("theme-toggle").click();
    await captureHyphenatedGroup(page, artifactPath, "light");
    await page.reload();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await assertRenderedArchitecture(page);
    await assertSingleMarkdownPreview({ page, fixturePath, artifactPath, workerIndex: testInfo.workerIndex });
  } finally {
    await server.stop();
    await rm(fixturePath, { recursive: true, force: true });
  }
});

async function createDiscoveryFixture(fixturePath: string): Promise<void> {
  await mkdir(fixturePath, { recursive: true });
  await Promise.all([
    writeFile(resolve(fixturePath, "a-valid.mmd"), [
      "architecture-beta", "group aa-bb(cloud)[Group]", "service bb(database)[B] in aa-bb", "service aa(server)[A]", "service cc(server)[C]", "aa:R --> L:cc"
    ].join("\n")),
    writeFile(resolve(fixturePath, "a-valid.tour.yaml"), [
      "version: 1", "title: Valid architecture", "diagram: ./a-valid.mmd", "steps:",
      "  - focus: [group-aa-bb]", "    text: The hyphenated group renders alongside the colliding endpoint pair."
    ].join("\n")),
    writeFile(resolve(fixturePath, "z-empty-group.mmd"), "architecture-beta\ngroup aa-bb(cloud)[Empty]"),
    writeFile(resolve(fixturePath, "z-invalid.mmd"), [
      "architecture-beta", "service aa(server)[A]", "service bb(database)[B]", "aa:R --> L:bb", "aa:B --> T:bb"
    ].join("\n")),
    writeFile(resolve(fixturePath, "z-invalid-junction.mmd"), [
      "architecture-beta", "junction aa-bb", "service aa(server)[A]", "service bb(database)[B]", "aa:R --> L:bb"
    ].join("\n")),
    writeFile(resolve(fixturePath, "mixed.md"), [
      "# Mixed sources", "", "## Flowchart", "```mermaid", "flowchart LR", "  start[Start] --> finish[Finish]", "```",
      "", "## Architecture", "```mermaid", "architecture-beta", "junction aa-bb", "service aa(server)[A]", "service bb(database)[B]", "aa:R --> L:bb", "```"
    ].join("\n")),
    writeFile(resolve(fixturePath, "ok.mmd"), ["architecture-beta", "service ok(server)[Okay]"].join("\n"))
  ]);
}

async function assertSingleMarkdownPreview(input: { page: Page; fixturePath: string; artifactPath: string; workerIndex: number }): Promise<void> {
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${input.workerIndex}-single-markdown` });
  const server = await startDevServer({ args: [resolve(input.fixturePath, "mixed.md")], port });

  try {
    const response = await input.page.goto(server.baseUrl);
    expect(response?.status()).toBe(200);
    await expect(input.page).toHaveURL(`${server.baseUrl}/mixed/flowchart`);
    await assertSingleMarkdownSvg(input.page, input.artifactPath);
    await captureSingleMarkdownTheme(input.page, input.artifactPath, "dark");
    await captureSingleMarkdownTheme(input.page, input.artifactPath, "light");
  } finally {
    await server.stop();
  }
}

async function assertSingleMarkdownSvg(page: Page, artifactPath: string): Promise<void> {
  await focusSingleMarkdownStart(page);
  const svg = page.getByTestId("diagram-container").locator("svg").first();
  await expect(svg.locator("g.node").filter({ hasText: "Start" })).toHaveCount(1);
  await expect(svg.locator("path.flowchart-link")).toHaveCount(1);
  await expect(svg.locator(".architecture-services .architecture-service")).toHaveCount(0);
  await writeFile(resolve(artifactPath, "single-mixed-rendered-dom.html"), await svg.evaluate((element) => element.outerHTML));
}

async function captureSingleMarkdownTheme(page: Page, artifactPath: string, theme: "dark" | "light"): Promise<void> {
  const currentTheme = await page.getByTestId("theme-root").getAttribute("data-theme");
  if (currentTheme !== theme) { await page.getByTestId("theme-toggle").click(); }
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", theme);
  await focusSingleMarkdownStart(page);
  await page.screenshot({ path: resolve(artifactPath, `single-mixed-focus-${theme}.png`), fullPage: true });
  await page.getByTestId("diagnostics-trigger").click();
  await expect(page.getByTestId("diagnostics-count")).toHaveText("1");
  await expect(page.getByTestId("diagnostics-panel")).toContainText("mixed.md#architecture");
  await page.screenshot({ path: resolve(artifactPath, `single-mixed-diagnostic-${theme}.png`), fullPage: true });
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", theme);
}

async function focusSingleMarkdownStart(page: Page): Promise<void> {
  const stepUrl = new URL(page.url());
  stepUrl.searchParams.set("step", "2");
  await page.goto(stepUrl.href);
  const start = page.getByTestId("diagram-container").locator('svg g.node[data-node-id="start"]');
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(start).toHaveAttribute("data-focus-state", "focused");
}

async function assertCollectionRoutes(page: Page, baseUrl: string): Promise<void> {
  const rootResponse = await page.goto(baseUrl);
  expect(rootResponse?.status()).toBe(200);
  await expect(page).toHaveURL(`${baseUrl}/a-valid`);
  const routeResponse = await page.goto(`${baseUrl}/a-valid`);
  expect(routeResponse?.status()).toBe(200);
  await assertRenderedArchitecture(page);
}

async function assertRenderedArchitecture(page: Page): Promise<void> {
  const svg = page.getByTestId("diagram-container").locator("svg").first();
  await expect(svg.locator("#group-aa-bb.node-bkg")).toBeAttached();
  await expect(svg.locator("#service-aa.architecture-service")).toBeAttached();
  await expect(svg.locator('.architecture-edges path.edge[id="L_aa_cc_0"]')).toBeAttached();
  await expect(page.locator('[data-node-id="group-aa-bb"][data-focus-state="focused"]')).toHaveCount(2);
}

async function assertSkippedDiagnostic(page: Page, artifactPath: string): Promise<void> {
  await expect(page.getByTestId("diagnostics-count")).toHaveText("3");
  await page.getByTestId("diagnostics-trigger").click();
  await expect(page.getByTestId("diagnostics-panel")).toContainText("z-invalid.mmd");
  await expect(page.getByTestId("diagnostics-panel")).toContainText("connection IDs collide");
  await expect(page.getByTestId("diagnostics-panel")).toContainText("z-invalid-junction.mmd");
  await expect(page.getByTestId("diagnostics-panel")).toContainText("junction");
  await expect(page.getByTestId("diagnostics-panel")).toContainText("mixed.md#architecture");
  await captureSkippedDiagnosticTheme(page, artifactPath, "dark");
  await page.keyboard.press("Escape");
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("diagnostics-trigger").click();
  await expect(page.getByTestId("diagnostics-panel")).toBeVisible();
  await captureSkippedDiagnosticTheme(page, artifactPath, "light");
  await page.keyboard.press("Escape");
  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
}

async function assertMixedMarkdownRoutes(page: Page, baseUrl: string, artifactPath: string): Promise<void> {
  await assertMixedFlowchartRoute(page, baseUrl, artifactPath);
  await assertRawArchitectureRoute(page, baseUrl, artifactPath);
}

async function assertMixedFlowchartRoute(page: Page, baseUrl: string, artifactPath: string): Promise<void> {
  const response = await page.goto(`${baseUrl}/mixed/flowchart`);
  expect(response?.status()).toBe(200);
  const svg = page.getByTestId("diagram-container").locator("svg").first();
  const start = svg.locator("g.node").filter({ hasText: "Start" });
  await expect(start).toHaveCount(1);
  await expect(start).toHaveAttribute("data-node-id", "start");
  await page.getByTestId("next-button").click();
  await expect(start).toHaveAttribute("data-focus-state", "focused");
  await expect(start.locator("rect.label-container")).toBeAttached();
  await expect(start.locator("rect:not(.label-container)")).toBeAttached();
  await expect(svg.locator("path.flowchart-link")).toHaveCount(1);
  await writeFile(resolve(artifactPath, "mixed-flowchart-rendered-dom.html"), await svg.evaluate((element) => element.outerHTML));
  await page.screenshot({ path: resolve(artifactPath, "mixed-flowchart-dark.png"), fullPage: true });
  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: resolve(artifactPath, "mixed-flowchart-light.png"), fullPage: true });
  await page.reload();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("diagram-container").locator("svg g.node").filter({ hasText: "Start" })).toHaveAttribute("data-focus-state", "focused");
}

async function assertRawArchitectureRoute(page: Page, baseUrl: string, artifactPath: string): Promise<void> {
  const response = await page.goto(`${baseUrl}/ok`);
  expect(response?.status()).toBe(200);
  const svg = page.getByTestId("diagram-container").locator("svg").first();
  await expect(svg.locator("g#service-ok.architecture-service")).toBeAttached();
  await page.getByTestId("next-button").click();
  await expect(svg.locator('[data-node-id="service-ok"][data-focus-state="focused"]')).toHaveCount(1);
  await writeFile(resolve(artifactPath, "ok-architecture-rendered-dom.html"), await svg.evaluate((element) => element.outerHTML));
  await page.screenshot({ path: resolve(artifactPath, "ok-architecture-light.png"), fullPage: true });
  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: resolve(artifactPath, "ok-architecture-dark.png"), fullPage: true });
  await page.reload();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("diagram-container").locator('svg [data-node-id="service-ok"][data-focus-state="focused"]')).toHaveCount(1);
}

async function captureSkippedDiagnosticTheme(page: Page, artifactPath: string, theme: string): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", theme);
  await page.screenshot({ path: resolve(artifactPath, `architecture-junction-collision-diagnostic-${theme}.png`), fullPage: true });
}

async function assertEmptyGroupRenders(page: Page, baseUrl: string, artifactPath: string): Promise<void> {
  const response = await page.goto(`${baseUrl}/z-empty-group`);
  expect(response?.status()).toBe(200);
  await page.getByTestId("next-button").click();
  const group = page.locator('[data-node-id="group-aa-bb"][data-focus-state="focused"]').first();
  await expect(group).toBeVisible();
  await expect(page.getByTestId("diagram-container").locator("svg #group-aa-bb.node-bkg")).toBeAttached();
  const svg = await page.getByTestId("diagram-container").locator("svg").first().evaluate((element) => element.outerHTML);
  await writeFile(resolve(artifactPath, "architecture-empty-group-renderer-dom.html"), svg);
  await page.screenshot({ path: resolve(artifactPath, "architecture-empty-group-focused.png"), fullPage: true });
}

async function captureHyphenatedGroup(page: Page, artifactPath: string, theme: string): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", theme);
  const target = page.locator('[data-node-id="group-aa-bb"][data-focus-state="focused"]').first();
  await expect(target).toBeVisible();
  await page.screenshot({ path: resolve(artifactPath, `architecture-hyphenated-group-${theme}.png`), fullPage: true });
}
