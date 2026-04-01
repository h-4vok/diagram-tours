import { expect, test } from "@playwright/test";
import { startDevServer } from "./dev-server";

test("issues popover presents a readable diagnostics hierarchy", async ({ page }) => {
  test.slow();

  const server = await startDevServer({
    port: 4181,
    promptInputs: ["1", "n", "", ""]
  });

  try {
    await page.goto(`${server.baseUrl}/parallel-onboarding`);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");

    await expect(page.getByTestId("diagnostics-trigger")).toBeVisible();
    await page.getByTestId("diagnostics-trigger").evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    await expect(page.getByTestId("diagnostics-panel")).toBeVisible();
    await expect(page.getByTestId("diagnostics-item").first()).toContainText(".tour.yaml");
    await expect(page.getByTestId("diagnostics-item").first()).toContainText("unknown Mermaid node id");
  } finally {
    await server.stop();
  }
});
