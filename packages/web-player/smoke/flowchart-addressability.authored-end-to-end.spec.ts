import { expect, test, type Page } from "@playwright/test";

import { expectDiagramVisible, expectFocusedNodeToStayAwayFromCanvasOrigin } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("authored flowchart addressability stays usable end to end", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour-theme", "dark");
  });

  const server = await startDevServer({
    args: ["./examples/flowchart/flowchart-addressability.tour.yaml"],
    port: 4195
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text-container")).toContainText("Inbound Intake feeds");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="decision"]')).toHaveAttribute(
      "data-step-target",
      "true"
    );

    await expectFocusedNodeToStayAwayFromCanvasOrigin(page, "decision");
    await page.getByTestId("next-button").click();

    await expect(page).toHaveURL(/\/flowchart-addressability\?step=2$/);
    await expect(page.getByTestId("step-text-container")).toContainText("bare endpoints like archive");
    await expectFocusedNodeToStayAwayFromCanvasOrigin(page, "archive");
    await expectStepTargets(page, ["archive", "manual_review", "queue", "worker", "done"]);
    await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(5);

    await page.getByTestId("next-button").click();

    await expect(page).toHaveURL(/\/flowchart-addressability\?step=3$/);
    await expect(page.getByTestId("step-text-container")).toContainText("stays fully navigable in the browser");
    await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="focused"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="diagram-container"] [data-focus-state="dimmed"]')).toHaveCount(0);
    await expectStepTargets(page, ["intake", "decision", "archive", "manual_review", "queue", "worker", "done"]);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");

    await page.getByTestId("theme-toggle").click();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await expect(page.getByTestId("step-text-container")).toBeVisible();
  } finally {
    await server.stop();
  }
});

async function expectStepTargets(page: Page, nodeIds: string[]): Promise<void> {
  await Promise.all(
    nodeIds.map((nodeId) =>
      expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${nodeId}"]`)).toHaveAttribute(
        "data-step-target",
        "true"
      )
    )
  );
}
