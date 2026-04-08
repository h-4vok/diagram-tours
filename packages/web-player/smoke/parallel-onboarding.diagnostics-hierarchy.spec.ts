import { expect, test } from "@playwright/test";
import { startDevServer } from "./dev-server";

test("issues popover presents a readable diagnostics hierarchy", async ({ page }) => {
  test.slow();
  const docsSlug = "docs/authoring-guide/start-with-stable-mermaid-ids";

  const server = await startDevServer({
    port: 4181,
    promptInputs: ["1", "n", "", ""]
  });

  try {
    await page.goto(`${server.baseUrl}/${docsSlug}?step=1`);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
    await expect(page).toHaveURL(new RegExp(`/${docsSlug.replaceAll("/", "\\/")}\\?step=1$`));

    await expect(page.getByTestId("diagnostics-trigger")).toBeVisible();
    await page.getByTestId("diagnostics-trigger").evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    await expect(page.getByTestId("diagnostics-panel")).toBeVisible();
    await expect(page.getByTestId("diagnostics-item").first()).toContainText(".tour.yaml");
    await expect(page.getByTestId("diagnostics-item").first()).toContainText("unknown Mermaid node id");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(new RegExp(`/${docsSlug.replaceAll("/", "\\/")}\\?step=1$`));
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("diagnostics-panel")).toBeHidden();
    await expect(page.getByTestId("theme-root")).toHaveAttribute(
      "data-active-interaction-context",
      "diagram"
    );

    const canGoNext = await page.getByTestId("next-button").isEnabled();

    if (canGoNext) {
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(new RegExp(`/${docsSlug.replaceAll("/", "\\/")}\\?step=2$`));
    } else {
      await expect(page.getByTestId("next-button")).toBeDisabled();
    }
  } finally {
    await server.stop();
  }
});
