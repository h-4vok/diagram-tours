import { expect, test } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("a labeled branch does not capture an unlabeled edge with a duplicate render ID", async ({ page }, testInfo) => {
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({
    args: ["./packages/web-player/test/fixtures/decision-tree/render-id-collision-unlabeled.tour.yaml"],
    port
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    const diagram = page.locator('[data-testid="diagram-container"]');
    const labeledEdge = diagram.locator('.flowchart-link[data-diagram-element-id="transition-A-to-B-yes"]');
    const unlabeledEdge = diagram.locator('.flowchart-link[data-diagram-element-id="transition-C-to-D-unlabeled"]');

    await expect(diagram.locator('.flowchart-link[data-id="L_C_D_0"]')).toHaveCount(2);
    await expect(labeledEdge).toHaveAttribute("data-focus-state", "focused");
    await expect(labeledEdge).toHaveAttribute("data-connector-source-id", "A");
    await expect(labeledEdge).toHaveAttribute("data-connector-target-id", "B");
    await expect(unlabeledEdge).toHaveAttribute("data-connector-state", "context");
    await expect(unlabeledEdge).toHaveAttribute("data-diagram-element-label", "C → D");
    await expect(unlabeledEdge).toHaveAttribute("data-connector-source-id", "C");
    await expect(unlabeledEdge).toHaveAttribute("data-connector-target-id", "D");
  } finally {
    await server.stop();
  }
});
