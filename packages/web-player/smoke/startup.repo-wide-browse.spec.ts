import { expect, test } from "@playwright/test";
import { expectBrowseSearchMatch, openBrowse } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("repo-wide startup exposes repo-only tours in browse", async ({ page }) => {
  const server = await startDevServer({
    port: 4174,
    promptInputs: ["1", "n", "", ""]
  });

  try {
    await openBrowse(page, `${server.baseUrl}/checkout-payment-flow`);

    await expect(page.getByTestId("preview-target-notice")).toHaveCount(0);
    await expect(server.output).toContain(server.baseUrl);
    await expectBrowseSearchMatch(page, "alpha", "Alpha Tour");
    await expectBrowseSearchMatch(page, "beta", "Beta Tour");
    await expectBrowseSearchMatch(page, "platform", "Payments Platform Overview");
  } finally {
    await server.stop();
  }
});
