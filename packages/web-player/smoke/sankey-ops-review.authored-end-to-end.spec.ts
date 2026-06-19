import { expect, test } from "@playwright/test";

import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("authored sankey tour stays usable end to end", async ({ page }) => {
  const server = await startDevServer({
    args: ["./examples/sankey/sankey-ops-review.tour.yaml"],
    port: 4197
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text-container")).toContainText("Overview of how one candidate funnel starts");
    await expect(
      page.locator('[data-testid="diagram-container"] .nodes .node[data-node-id="Applications"]')
    ).not.toHaveAttribute("data-focus-state", "focused");

    await page.getByTestId("next-button").click();

    await expect(page).toHaveURL(/\/sankey-ops-review\?step=2$/);
    await expect(page.getByTestId("step-text-container")).toContainText("Recruiter Screen");
    await expect(
      page.locator('[data-testid="diagram-container"] .nodes .node[data-node-id="Applications"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await expect(
      page.locator('[data-testid="diagram-container"] .nodes .node[data-node-id="Recruiter Screen"]')
    ).toHaveAttribute("data-focus-state", "focused");

    const themeRoot = page.getByTestId("theme-root");
    const beforeToggle = await themeRoot.getAttribute("data-theme");

    await page.getByTestId("theme-toggle").click();
    await expect(themeRoot).toHaveAttribute("data-theme", beforeToggle === "dark" ? "light" : "dark");
    await expect(page.getByTestId("step-text-container")).toBeVisible();
  } finally {
    await server.stop();
  }
});
