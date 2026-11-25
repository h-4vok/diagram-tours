import { expect, test } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("duplicate Mermaid edge IDs stay focused by endpoints and label order", async ({ page }, testInfo) => {
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({
    args: ["./packages/web-player/test/fixtures/decision-tree/render-id-collision.tour.yaml"],
    port
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    const diagram = page.locator('[data-testid="diagram-container"]');
    const edges = diagram.locator('.flowchart-link[data-id="L_C_D_0"]');
    const labels = diagram.locator('.edgeLabel[data-diagram-element-kind="transition"]');
    const yesEdge = diagram.locator('.flowchart-link[data-diagram-element-id="transition-A-to-B-yes"]');
    const noEdge = diagram.locator('.flowchart-link[data-diagram-element-id="transition-C-to-D-no"]');

    await expect(edges).toHaveCount(2);
    await expect(labels).toHaveCount(2);
    await expect(labels.nth(0)).toContainText("Yes");
    await expect(labels.nth(1)).toContainText("No");
    await expect(yesEdge).toHaveAttribute("data-focus-state", "focused");
    await expect(noEdge).toHaveAttribute("data-focus-state", "dimmed");
    await expect(yesEdge).toHaveAttribute("data-connector-source-id", "A");
    await expect(yesEdge).toHaveAttribute("data-connector-target-id", "B");
    await expect(noEdge).toHaveAttribute("data-connector-source-id", "C");
    await expect(noEdge).toHaveAttribute("data-connector-target-id", "D");
    await expect(labels.nth(0)).toHaveAttribute("data-focus-state", "focused");
    await expect(labels.nth(1)).toHaveAttribute("data-focus-state", "dimmed");

    await page.getByTestId("next-button").click();
    await expect(yesEdge).toHaveAttribute("data-focus-state", "dimmed");
    await expect(noEdge).toHaveAttribute("data-focus-state", "focused");
    await expect(labels.nth(0)).toHaveAttribute("data-focus-state", "dimmed");
    await expect(labels.nth(1)).toHaveAttribute("data-focus-state", "focused");
  } finally {
    await server.stop();
  }
});
