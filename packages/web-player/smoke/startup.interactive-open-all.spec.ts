import { test } from "@playwright/test";
import { expectBrowseSearchMatch, openBrowse } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("interactive open-all matches repo-wide startup", async ({ page }) => {
  const server = await startDevServer({
    port: 4177,
    promptInputs: ["1", "n", "", ""]
  });

  try {
    await openBrowse(page, `${server.baseUrl}/checkout-payment-flow`);

    await expectBrowseSearchMatch(page, "alpha", "Alpha Tour");
    await expectBrowseSearchMatch(page, "beta", "Beta Tour");
    await expectBrowseSearchMatch(page, "release", "Release Pipeline");
  } finally {
    await server.stop();
  }
});
