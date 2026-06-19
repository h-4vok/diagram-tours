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
    const diagnosticsGroup = page.getByTestId("diagnostics-group");
    const invalidTourGroup = diagnosticsGroup.filter({
      hasText: "packages/parser/test/fixtures/discovery/invalid-tour/invalid.tour.yaml"
    });
    const brokenTourGroup = diagnosticsGroup.filter({
      hasText: "packages/parser/test/fixtures/invalid-only/broken.tour.yaml"
    });
    const invalidTourItems = invalidTourGroup.getByTestId("diagnostics-item");
    const brokenTourItems = brokenTourGroup.getByTestId("diagnostics-item");

    await expect(diagnosticsGroup).toHaveCount(2);
    await expect(invalidTourGroup).toHaveCount(1);
    await expect(invalidTourGroup.getByTestId("diagnostics-group-count")).toHaveText("2 issues");
    await expect(invalidTourItems).toHaveCount(2);
    await expect(invalidTourItems.nth(0)).toContainText(
      'step 1 focus references unknown Mermaid node id "missing_node"'
    );
    await expect(invalidTourItems.nth(0)).toContainText(
      "packages/parser/test/fixtures/discovery/invalid-tour/invalid.tour.yaml:6:10"
    );
    await expect(invalidTourItems.nth(1)).toContainText(
      'step 1 text references unknown Mermaid node id "missing_node"'
    );
    await expect(invalidTourItems.nth(1)).toContainText(
      "packages/parser/test/fixtures/discovery/invalid-tour/invalid.tour.yaml:7:12"
    );
    await expect(brokenTourGroup).toHaveCount(1);
    await expect(brokenTourGroup.getByTestId("diagnostics-group-count")).toHaveText("2 issues");
    await expect(brokenTourItems).toHaveCount(2);
    await expect(brokenTourItems.nth(0)).toContainText(
      'step 1 focus references unknown Mermaid node id "ghost"'
    );
    await expect(brokenTourItems.nth(0)).toContainText(
      "packages/parser/test/fixtures/invalid-only/broken.tour.yaml:6:10"
    );
    await expect(brokenTourItems.nth(1)).toContainText(
      'step 1 text references unknown Mermaid node id "ghost"'
    );
    await expect(brokenTourItems.nth(1)).toContainText(
      "packages/parser/test/fixtures/invalid-only/broken.tour.yaml:7:12"
    );
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
