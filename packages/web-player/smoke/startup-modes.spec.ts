import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";

test.describe("startup modes", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("repo-wide startup exposes repo-only tours in browse", async ({ page }) => {
    const server = await startDevServer({
      port: 4174,
      script: "dev"
    });

    try {
      await openBrowse(page, `${server.baseUrl}/payment-flow`);

      await expectRepoWideBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("explicit examples directory keeps browse scoped to shipped examples", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples"],
      port: 4175,
      script: "dev"
    });

    try {
      await openBrowse(page, `${server.baseUrl}/payment-flow`);

      await expectExamplesBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("explicit single-file startup limits browse to one tour", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples/payment-flow/payment-flow.tour.yaml"],
      port: 4176,
      script: "dev"
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expectSingleTourBrowse(page, {
        expectedTitle: "Payment Flow",
        filename: "payment-flow.tour.yaml",
        unexpectedTitle: "Refund Flow"
      });
    } finally {
      await server.stop();
    }
  });

  test("interactive open-all matches repo-wide startup", async ({
    page
  }) => {
    const server = await startDevServer({
      port: 4177,
      promptInputs: ["1"],
      script: "dev:interactive"
    });

    try {
      await openBrowse(page, `${server.baseUrl}/payment-flow`);

      await expectRepoWideBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("interactive directory selection matches examples-only startup", async ({ page }) => {
    const server = await startDevServer({
      port: 4178,
      promptInputs: ["2", "./examples"],
      script: "dev:interactive"
    });

    try {
      await openBrowse(page, `${server.baseUrl}/refund-flow`);

      await expectExamplesBrowse(page);
    } finally {
      await server.stop();
    }
  });

  test("interactive file selection matches single-file startup", async ({ page }) => {
    const server = await startDevServer({
      port: 4179,
      promptInputs: ["3", "./examples/payment-flow/payment-flow.tour.yaml"],
      script: "dev:interactive"
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expectSingleTourBrowse(page, {
        expectedTitle: "Payment Flow",
        filename: "payment-flow.tour.yaml",
        unexpectedTitle: "Refund Flow"
      });
    } finally {
      await server.stop();
    }
  });

  test("interactive startup skips the prompt when a target is explicit", async ({ page }) => {
    const server = await startDevServer({
      args: ["./examples/refund-flow/refund-flow.tour.yaml"],
      port: 4180,
      script: "dev:interactive"
    });

    try {
      await openBrowse(page, server.baseUrl);

      await expectSingleTourBrowse(page, {
        expectedTitle: "Refund Flow",
        filename: "refund-flow.tour.yaml",
        unexpectedTitle: "Payment Flow"
      });
      expect(server.output).not.toContain("Choose what to preview:");
      expect(server.output).not.toContain("Select an option:");
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
