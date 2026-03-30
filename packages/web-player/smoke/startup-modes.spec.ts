import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";

test.describe("startup modes", () => {
  test.setTimeout(120_000);

  test("repo-wide startup exposes repo-only tours in browse @core", async ({ page }) => {
    const server = await startDevServer({
      port: 4174,
      promptInputs: ["1", "n", "", ""]
    });

    try {
      await openBrowse(page, `${server.baseUrl}/checkout-payment-flow`);

      await expectRepoWideBrowse(page);
      expect(server.output).toContain(server.baseUrl);
    } finally {
      await server.stop();
    }
  });

  test("explicit examples directory keeps browse scoped to shipped examples @core", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples"],
      port: 4175
    });

    try {
      await openBrowse(page, `${server.baseUrl}/checkout-payment-flow`);

      await expectExamplesBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("explicit single-file startup limits browse to one tour @core", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples/checkout-payment-flow.tour.yaml"],
      port: 4176
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expectSingleTourBrowse(page, {
        expectedTitle: "Payment Flow",
        filename: "checkout-payment-flow.tour.yaml",
        unexpectedTitle: "Refund Flow"
      });
    } finally {
      await server.stop();
    }
  });

  test("interactive open-all matches repo-wide startup @extended", async ({
    page
  }) => {
    const server = await startDevServer({
      port: 4177,
      promptInputs: ["1", "n", "", ""]
    });

    try {
      await openBrowse(page, `${server.baseUrl}/checkout-payment-flow`);

      await expectRepoWideBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("interactive directory selection matches examples-only startup @extended", async ({ page }) => {
    const server = await startDevServer({
      port: 4178,
      promptInputs: ["2", "./examples", "n", "", ""]
    });

    try {
      await openBrowse(page, `${server.baseUrl}/checkout-refund-flow`);

      await expectExamplesBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("interactive file selection matches single-file startup @extended", async ({ page }) => {
    const server = await startDevServer({
      port: 4179,
      promptInputs: ["3", "./examples/checkout-payment-flow.tour.yaml", "n", "", ""]
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expectSingleTourBrowse(page, {
        expectedTitle: "Payment Flow",
        filename: "checkout-payment-flow.tour.yaml",
        unexpectedTitle: "Refund Flow"
      });
    } finally {
      await server.stop();
    }
  });

  test("interactive startup skips the prompt when a target is explicit @extended", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples/checkout-refund-flow.tour.yaml"],
      port: 4180
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expectSingleTourBrowse(page, {
        expectedTitle: "Refund Flow",
        filename: "checkout-refund-flow.tour.yaml",
        unexpectedTitle: "Payment Flow"
      });
      expect(server.output).not.toContain("Choose what to open:");
      expect(server.output).not.toContain("Select an option:");
    } finally {
      await server.stop();
    }
  });

  test("explicit diagram startup generates a fallback tour preview @core", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples/checkout-payment-flow.mmd"],
      port: 4182
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expect(page.getByTestId("preview-target-notice")).toContainText("checkout-payment-flow.mmd");
      await expect(readBrowsePanel(page).getByText("Checkout Payment Flow", { exact: true })).toBeVisible();
      await expect(page.getByTestId("step-text")).toContainText("Overview of Checkout Payment Flow.");
    } finally {
      await server.stop();
    }
  });

  test("explicit markdown startup generates multiple fallback entries from one file @extended", async ({ page }) => {
    const server = await startDevServer({
      args: ["./fixtures/markdown/checklist.md"],
      port: 4184
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expect(page.getByTestId("preview-target-notice")).toContainText("checklist.md");
      await expect(readBrowsePanel(page).getByText("Overview", { exact: true })).toBeVisible();
      await expect(readBrowsePanel(page).getByText("Details", { exact: true })).toBeVisible();
      await expect(page.getByTestId("step-text")).toContainText("Overview of Overview.");
    } finally {
      await server.stop();
    }
  });
});

async function openBrowse(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("browse-trigger").click();
  await expect(page.getByTestId("browse-panel")).toBeVisible();
}

async function expectRepoWideBrowse(page: Page): Promise<void> {
  await expect(page.getByTestId("preview-target-notice")).toHaveCount(0);
  await expectBrowseSearchMatch(page, "alpha", "Alpha Tour");
  await expectBrowseSearchMatch(page, "beta", "Beta Tour");
  await expectBrowseSearchMatch(page, "release", "Release Pipeline");
}

async function expectExamplesBrowse(page: Page): Promise<void> {
  await expect(page.getByTestId("preview-target-notice")).toHaveCount(0);
  await expect(page.getByTestId("diagnostics-trigger")).toHaveCount(0);
  await expectBrowseSearchEmpty(page, "alpha");
  await expectBrowseSearchEmpty(page, "beta");
  await expectBrowseSearchMatch(page, "release", "Release Pipeline");
  await expectBrowseSearchMatch(page, "refund", "Refund Flow");
}

async function expectSingleTourBrowse(
  page: Page,
  options: {
    expectedTitle: string;
    filename: string;
    unexpectedTitle: string;
  }
): Promise<void> {
  await expect(page.getByTestId("preview-target-notice")).toContainText(options.filename);
  await expect(readBrowsePanel(page).getByText(options.expectedTitle, { exact: true })).toBeVisible();
  await expect(readBrowsePanel(page).getByText(options.unexpectedTitle, { exact: true })).toHaveCount(0);
}

async function expectBrowseSearchMatch(page: Page, query: string, label: string): Promise<void> {
  await page.getByTestId("browse-search-input").fill(query);
  await expect(readBrowsePanel(page).getByText(label, { exact: true })).toBeVisible();
}

async function expectBrowseSearchEmpty(page: Page, query: string): Promise<void> {
  await page.getByTestId("browse-search-input").fill(query);
  await expect(page.getByTestId("browse-empty-state")).toContainText(`No tours match "${query}".`);
}

function readBrowsePanel(page: Page) {
  return page.getByTestId("browse-panel");
}
