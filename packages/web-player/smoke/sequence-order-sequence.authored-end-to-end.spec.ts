import { expect, test, type Page } from "@playwright/test";

import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("authored sequence diagrams preserve context and navigate semantic focus", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour-theme", "dark");
  });

  const server = await startDevServer({
    args: ["./examples/sequence/sequence-order-sequence.tour.yaml"],
    port: 4196
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text-container")).toContainText("starts an order");
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await expectFocusedElement(page, "customer");

    const actorMenuLink = page
      .locator('[data-testid="diagram-container"] .actorPopupMenu a')
      .filter({ hasText: "API runbook" });
    await expect(actorMenuLink).toHaveText("API runbook");
    await expect(actorMenuLink).toHaveAttribute("xlink:href", "https://example.test/checkout");
    await expect(
      page.locator('[data-testid="diagram-container"] .noteText').filter({ hasText: "starts a new order" })
    ).toBeVisible();

    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/sequence-order-sequence\?step=2$/);
    await expect(page.getByTestId("step-text-container")).toContainText("opens the exchange");
    await expectFocusedElement(page, "submit_order");
    await expect(
      page.locator('[data-testid="diagram-container"] .messageText[data-node-id="submit_order"]')
    ).toHaveText("Submit order");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="customer"]').first()).toHaveAttribute(
      "data-focus-state",
      "dimmed"
    );

    const darkMessageColor = await readSequenceContextMessageColor(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await expectDiagramVisible(page);
    const lightMessageColor = await readSequenceContextMessageColor(page);
    expect(lightMessageColor).not.toBe(darkMessageColor);

    await page.getByTestId("next-button").click();
    await expect(page).toHaveURL(/\/sequence-order-sequence\?step=3$/);
    await expectFocusedElement(page, "reserve_inventory");
    await expectFocusedElement(page, "inventory_reserved");

    await page.getByTestId("previous-button").click();
    await expect(page).toHaveURL(/\/sequence-order-sequence\?step=2$/);
    await expectFocusedElement(page, "submit_order");
  } finally {
    await server.stop();
  }
});

async function expectFocusedElement(page: Page, elementId: string): Promise<void> {
  await expect(
    page.locator(`[data-testid="diagram-container"] [data-node-id="${elementId}"]`).first()
  ).toHaveAttribute("data-focus-state", "focused");
}

async function readSequenceContextMessageColor(page: Page): Promise<string> {
  return page
    .locator('[data-testid="diagram-container"] .messageText:not([data-node-id])')
    .first()
    .evaluate((element) => getComputedStyle(element).fill);
}
