import { expect, test } from "@playwright/test";
import { expectBrowseSearchEmpty, expectBrowseSearchMatch, openBrowse } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("interactive directory selection matches examples-only startup", async ({ page }) => {
  const server = await startDevServer({
    port: 4178,
    promptInputs: ["2", "./examples", "n", "", ""]
  });

  try {
    await openBrowse(page, `${server.baseUrl}/checkout-refund-flow`);

    await expect(page.getByTestId("preview-target-notice")).toHaveCount(0);
    await expect(page.getByTestId("diagnostics-trigger")).toBeVisible();
    await expect(page.getByTestId("diagnostics-count")).toHaveText("0");
    await expectBrowseSearchEmpty(page, "alpha");
    await expectBrowseSearchEmpty(page, "beta");
    await expectBrowseSearchMatch(page, "release", "Release Pipeline");
    await expectBrowseSearchMatch(page, "refund", "Refund Flow");
  } finally {
    await server.stop();
  }
});
