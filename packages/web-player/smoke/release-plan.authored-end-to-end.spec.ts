import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("authored mindmaps focus root and nested topics without hiding the tree", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("diagram-tour-theme") === null) {
      window.localStorage.setItem("diagram-tour-theme", "dark");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/mindmap/release-plan.tour.yaml"], port });

  try {
    await page.goto(server.baseUrl);
    await verifyMindmapLoaded(page);
    await verifyThemeRendering(page);
    await verifyMindmapNavigation(page);
  } finally {
    await server.stop();
  }
});

async function verifyMindmapLoaded(page: Page): Promise<void> {
  await expectDiagramVisible(page);
  await expect(page.locator('[data-testid="diagram-container"] .mindmap-node')).toHaveCount(8);
  await expect(page.locator('[data-testid="diagram-container"] .mindmap-node title')).toHaveCount(0);
  await expect(page.locator('[data-testid="diagram-container"] .mindmap-node .nodeLabel p')).toHaveText([
    "Release plan",
    "Customer research",
    "Interviews",
    "Validate demand",
    "Design the solution",
    "Prototype",
    "Measure adoption",
    "Publish findings"
  ]);
  await expectFocusedTopic(page, "plan");
  await expect(page.locator('[data-testid="diagram-container"] [data-node-id="research"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diagram-container"] .edge')).toHaveCount(7);
  await expect(page.locator('[data-testid="diagram-container"] .edge[data-focus-state]')).toHaveCount(0);
}

async function verifyThemeRendering(page: Page): Promise<void> {
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
  const darkColors = await readTopicColors(page);
  await page.getByTestId("theme-toggle").click();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
  const lightColors = await readTopicColors(page);
  expect(lightColors.fill).not.toBe(darkColors.fill);
  expect(lightColors.label).not.toBe(darkColors.label);
}

async function verifyMindmapNavigation(page: Page): Promise<void> {
  await page.getByTestId("next-button").click();
  await expect(page).toHaveURL(/\/release-plan\?step=2$/);
  await expectFocusedTopic(page, "research");
  await page.goto(page.url().replace("step=2", "step=4"));
  await expectFocusedTopic(page, "validation");
  await expect(page.locator('[data-testid="diagram-container"] .edge')).toHaveCount(7);
  await page.getByTestId("previous-button").click();
  await expect(page).toHaveURL(/\/release-plan\?step=3$/);
  await expectFocusedTopic(page, "mindmap-plan-research-interviews");
}

async function expectFocusedTopic(page: Page, id: string): Promise<void> {
  await expect(
    page.locator(`[data-testid="diagram-container"] .mindmap-node[data-node-id="${id}"]`)
  ).toHaveAttribute("data-focus-state", "focused");
}

async function readTopicColors(page: Page): Promise<{ fill: string; label: string }> {
  const root = page.locator('[data-testid="diagram-container"] .mindmap-node[data-node-id="plan"]');

  return {
    fill: await root.locator("circle").evaluate((element) => getComputedStyle(element).fill),
    label: await root.locator(".nodeLabel p").evaluate((element) => getComputedStyle(element).color)
  };
}
