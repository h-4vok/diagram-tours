import { expect, test, type Page } from "@playwright/test";

import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

test("authored state diagrams focus states and transitions through the tour", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour-theme", "dark");
  });

  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-${testInfo.workerIndex}` });
  const server = await startDevServer({ args: ["./examples/state/review-lifecycle.tour.yaml"], port });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await expectFocusedElement(page, "state-draft");
    await expect(page.locator('[data-testid="diagram-container"] svg a[title="Draft details"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="diagram-container"] .statediagram-note')).toContainText(
      "Reviewer notes stay visible context"
    );

    const darkStateFill = await readStateFill(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await expectDiagramVisible(page);
    await expect.poll(() => readStateFill(page)).not.toBe(darkStateFill);

    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/review-lifecycle\?step=2$/);
    await expectFocusedElement(page, "state-still");
    await expectFocusedElement(page, "state-moving");
    await expectFocusedElement(page, "state-decision");
    await expectFocusedElement(page, "state-queue-a-shared");
    await expect(
      page.locator('[data-testid="diagram-container"] [data-node-id="state-queue-a-shared"]')
    ).toHaveCount(1);
    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/review-lifecycle\?step=3$/);
    await expectFocusedElement(page, "transition-state-draft-to-state-in-review-submit-complete");
    await expectFocusedTransition(page, "transition-state-draft-to-state-in-review-submit-complete");
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabel > .label[data-node-id="transition-state-draft-to-state-in-review-submit-complete"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await page.getByTestId("previous-button").click();
    await expect(page).toHaveURL(/\/review-lifecycle\?step=2$/);
    await expectFocusedElement(page, "state-still");
    await page.getByTestId("previous-button").click();
    await expect(page).toHaveURL(/\/review-lifecycle\?step=1$/);
    await expectFocusedElement(page, "state-draft");

    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/review-lifecycle\?step=4$/);
    await expectFocusedTransition(page, "transition-state-draft-to-state-draft-edit", 3);
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabel > .label[data-node-id="transition-state-draft-to-state-draft-edit"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await expect(
      page.locator('[data-testid="diagram-container"] [data-node-id="transition-state-draft-to-state-draft-initial-edit"]')
    ).toHaveCount(0);
    await expect(page.locator('[data-testid="diagram-container"] .note-edge[data-focus-state]')).toHaveCount(0);
    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/review-lifecycle\?step=5$/);
    await expectFocusedTransition(page, "transition-state-draft-to-state-in-review-retry");
    await expect(
      page.locator('[data-testid="diagram-container"] path[data-node-id="transition-state-draft-to-state-in-review-submit-complete"][data-focus-state="dimmed"]')
    ).toHaveCount(1);
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabel > .label[data-node-id="transition-state-draft-to-state-in-review-retry"]')
    ).toHaveAttribute("data-focus-state", "focused");

    await page.goto(`${server.baseUrl}/review-lifecycle?step=8`);
    await expectFocusedTransition(page, "transition-state-in-review-reviewing-to-state-in-review-reviewing-retry", 3);
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabel > .label[data-node-id="transition-state-in-review-reviewing-to-state-in-review-reviewing-retry"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=9`);
    await expectFocusedElement(page, "state-in-review-review-fork");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=10`);
    await expectFocusedElement(page, "state-in-review-review-join");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=11`);
    await expect(page.getByTestId("step-text-container")).toContainText("pseudostate");
    await expectFocusedElement(page, "state-in-review-review-decision");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=12`);
    await expectFocusedElement(page, "transition-state-in-review-review-decision-to-state-in-review-approved-changes-accepted");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=14`);
    await expectFocusedTransition(page, "transition-state-in-review-to-state-published-merge");
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabel > .label[data-node-id="transition-state-in-review-to-state-published-merge"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=15`);
    await expectFocusedTransition(page, "transition-state-in-review-to-state-in-review-reopen", 3);
    await expect(
      page.locator('[data-testid="diagram-container"] .edgeLabel > .label[data-node-id="transition-state-in-review-to-state-in-review-reopen"]')
    ).toHaveAttribute("data-focus-state", "focused");
    await page.goto(`${server.baseUrl}/review-lifecycle?step=11`);
    await expectFocusedElement(page, "state-in-review-review-decision");
  } finally {
    await server.stop();
  }
});

async function expectFocusedElement(page: Page, elementId: string): Promise<void> {
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${elementId}"]`).first()).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
}

async function expectFocusedTransition(page: Page, elementId: string, pathCount = 1): Promise<void> {
  await expect(
    page.locator(`[data-testid="diagram-container"] path[data-node-id="${elementId}"][data-focus-state="focused"]`)
  ).toHaveCount(pathCount);
}

async function readStateFill(page: Page): Promise<string> {
  return page
    .locator('[data-testid="diagram-container"] [data-node-id="state-in-review-reviewing"] rect.basic')
    .evaluate((element) => getComputedStyle(element).fill);
}
