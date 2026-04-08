import { expect, test } from "@playwright/test";
import { expectSingleTourBrowse } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("interactive startup skips the prompt when a target is explicit", async ({ page }) => {
  const server = await startDevServer({
    args: ["./examples/payments-platform-overview.tour.yaml"],
    port: 4180
  });

  try {
    await page.goto(server.baseUrl);
    await page.getByTestId("search-hint-trigger").click();
    await expect(page.getByTestId("browse-panel")).toBeVisible();

    await expectSingleTourBrowse(page, {
      expectedTitle: "Payments Platform Overview",
      filename: "payments-platform-overview.tour.yaml",
      unexpectedTitle: "Payment Flow"
    });
    expect(server.output).not.toContain("Choose what to open:");
    expect(server.output).not.toContain("Select an option:");
  } finally {
    await server.stop();
  }
});
