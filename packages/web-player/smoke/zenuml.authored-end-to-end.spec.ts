import { expect, test, type Page } from "@playwright/test";

import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

test("authored ZenUML diagrams render and navigate semantic focus in both themes", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour-theme", "dark");
  });
  const port = await resolveSmokeServerPort({
    worktreePath: `${process.cwd()}-${testInfo.workerIndex}`
  });
  const server = await startDevServer({ args: ["./examples/zenuml/checkout-zenuml.tour.yaml"], port });

  try {
    await page.goto(server.baseUrl);
    await expectZenUmlVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await expectFocused(page, "actor-customer");
    await expect(page.locator('[data-testid="diagram-container"] svg text').first()).toBeVisible();
    const darkActorFill = await readActorFill(page);

    await page.getByTestId("next-button").click();
    await expectFocused(page, "block-while-cart-has-items");
    await page.getByTestId("next-button").click();
    await expectFocused(page, "interaction-while-cart-has-items-order-service-submit");
    await page.getByTestId("previous-button").click();
    await expectFocused(page, "block-while-cart-has-items");

    await page.getByTestId("theme-toggle").click();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "light");
    await expectZenUmlVisible(page);
    await expectFocused(page, "block-while-cart-has-items");
    await expect.poll(() => readActorFill(page)).not.toBe(darkActorFill);
    await page.getByTestId("theme-toggle").click();
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    await expectZenUmlVisible(page);
  } finally {
    await server.stop();
  }
});

async function expectFocused(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${id}"]`).first())
    .toHaveAttribute("data-focus-state", "focused");
}

async function expectZenUmlVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="diagram-container"] svg').first()).toBeVisible();
}

async function readActorFill(page: Page): Promise<string> {
  return page.locator('[data-testid="diagram-container"] [data-node-id="actor-customer"] rect')
    .evaluate((element) => getComputedStyle(element).fill);
}
