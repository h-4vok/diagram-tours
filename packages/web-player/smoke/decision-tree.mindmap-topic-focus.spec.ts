import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("authored decision tree mindmap focuses topics and keeps hierarchy as context", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("diagram-tour-theme") === null) {
      window.localStorage.setItem("diagram-tour-theme", "dark");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/decision-tree/eligibility-mindmap.tour.yaml"], port });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    const diagram = page.locator('[data-testid="diagram-container"]');
    await expect(diagram.locator(".mindmap-node")).toHaveCount(11);
    await expect(diagram.locator('.mindmap-node[data-node-id="eligibility"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
    await expect(diagram.locator(".edge[data-focus-state]")).toHaveCount(0);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    const darkColors = await readTopicColors(page);
    await page.getByTestId("theme-toggle").click();
    await page.reload();
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    const lightColors = await readTopicColors(page);
    expect(lightColors.fill).not.toBe(darkColors.fill);
    expect(lightColors.label).not.toBe(darkColors.label);

    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/eligibility-mindmap\?step=2$/);
    await expect(diagram.locator('.mindmap-node[data-node-id="eligible"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
    await page.getByTestId("next-button").click();
    await expect(diagram.locator('.mindmap-node[data-node-id="yes"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
    await expect(diagram.locator(".edge")).toHaveCount(10);
    await expect(diagram.locator(".edge[data-focus-state]")).toHaveCount(0);
    await page.getByTestId("previous-button").click();
    await expect(page).toHaveURL(/\/eligibility-mindmap\?step=2$/);
    await expect(diagram.locator('.mindmap-node[data-node-id="eligible"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/eligibility-mindmap\?step=6$/);
    await expect(page.getByTestId("step-text-container")).toContainText("Review Documents complete? before deciding");
    await expect(diagram.locator('.mindmap-node[data-node-id="mindmap-eligibility-eligible-no-documents-complete"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
  } finally {
    await server.stop();
  }
});

async function readTopicColors(page: Page): Promise<{ fill: string; label: string }> {
  const node = page.locator('[data-testid="diagram-container"] .mindmap-node[data-node-id="eligibility"]');

  return {
    fill: await node.locator("circle").evaluate((element) => getComputedStyle(element).fill),
    label: await node.locator(".nodeLabel p").evaluate((element) => getComputedStyle(element).color)
  };
}
