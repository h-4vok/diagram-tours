import { expect, test } from "@playwright/test";
import { expectBrowseOpen, readBrowsePanel } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("explicit markdown startup generates multiple fallback entries from one file", async ({ page }) => {
  const server = await startDevServer({
    args: ["./fixtures/markdown/checklist.md"],
    port: 4184
  });

  try {
    await expectBrowseOpen(page, server.baseUrl);

    await expect(page.getByTestId("preview-target-notice")).toContainText("checklist.md");
    await expect(readBrowsePanel(page).getByText("Overview", { exact: true })).toBeVisible();
    await expect(readBrowsePanel(page).getByText("Details", { exact: true })).toBeVisible();
    await expect(page.getByTestId("step-text")).toContainText("Overview of Overview.");
  } finally {
    await server.stop();
  }
});
