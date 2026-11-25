import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("authored decision tree focuses labeled yes and no branches", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("diagram-tour-theme") === null) {
      window.localStorage.setItem("diagram-tour-theme", "dark");
    }
  });
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/decision-tree/eligibility-flowchart.tour.yaml"], port });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    const darkColors = await readFlowchartColors(page);
    await page.getByTestId("theme-toggle").click();
    await page.reload();
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    const lightColors = await readFlowchartColors(page);
    expect(lightColors.fill).not.toBe(darkColors.fill);
    expect(lightColors.label).not.toBe(darkColors.label);
    await page.locator('[data-testid="diagram-container"] [data-node-id="eligibility"]').hover();
    await expect(page.locator(".mermaidTooltip")).toContainText("Eligibility rules");
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await expectFocusedTransition(page, "transition-eligibility-to-approved-yes", "Yes");
    await page.getByTestId("previous-button").click();
    await expect(page).toHaveURL(/\/eligibility-flowchart\?step=2$/);
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="eligibility"]')).toHaveAttribute(
      "data-focus-state",
      "focused"
    );
    await page.getByTestId("next-button").click();
    await expectFocusedTransition(page, "transition-eligibility-to-approved-yes", "Yes");
    await page.getByTestId("next-button").click();
    await expectFocusedTransition(page, "transition-eligibility-to-documents-no", "No");
    await page.getByTestId("next-button").click();
    await expectFocusedTransition(page, "transition-documents-to-manual_review-yes", "Yes");
    await page.getByTestId("next-button").click();
    await expectFocusedTransition(page, "transition-documents-to-rejected-no", "No");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="rejected"]')).toHaveAttribute(
      "data-focus-state",
      "dimmed"
    );
  } finally {
    await server.stop();
  }
});

async function expectFocusedTransition(page: Page, id: string, label: string): Promise<void> {
  const diagram = page.locator('[data-testid="diagram-container"]');
  await expect(diagram.locator(`.flowchart-link[data-diagram-element-id="${id}"]`)).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
  await expect(diagram.locator(`.edgeLabel[data-diagram-element-id="${id}"]`)).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
  await expect(diagram.locator(`.edgeLabel[data-diagram-element-id="${id}"]`)).toContainText(label);
}

async function readFlowchartColors(page: Page): Promise<{ fill: string; label: string }> {
  const node = page.locator('[data-testid="diagram-container"] [data-node-id="eligibility"]');

  return {
    fill: await node.locator("rect").evaluate((element) => getComputedStyle(element).fill),
    label: await node.locator(".nodeLabel").evaluate((element) => getComputedStyle(element).color)
  };
}
