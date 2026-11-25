import { expect, test, type Page } from "@playwright/test";
import { loadResolvedTour } from "@diagram-tour/parser";
import { fileURLToPath } from "node:url";

import { startDevServer } from "./dev-server";

const ZENUML_TOUR_PATH = fileURLToPath(new URL("../../../examples/zenuml/checkout-zenuml.tour.yaml", import.meta.url));

test("authored ZenUML diagrams render and navigate semantic focus in both themes", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("diagram-tour-theme", "dark");
  });
  const server = await startDevServer({ args: ["./examples/zenuml/checkout-zenuml.tour.yaml"], port: 4197 });

  try {
    await page.goto(server.baseUrl);
    await expectZenUmlVisible(page);
    await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "dark");
    const resolvedTour = await loadResolvedTour(ZENUML_TOUR_PATH);
    await expectFirstZenUmlFocus(page, resolvedTour.diagram.elements);
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

async function expectFirstZenUmlFocus(
  page: Page,
  resolvedElements: Awaited<ReturnType<typeof loadResolvedTour>>["diagram"]["elements"]
): Promise<void> {
  const svgState = await page.locator('[data-testid="diagram-container"] svg').first().evaluate((svg) => ({
    role: svg.getAttribute("aria-roledescription"),
    text: Array.from(svg.querySelectorAll("text, foreignObject"), (element) => ({
      tag: element.tagName,
      id: element.getAttribute("id"),
      class: element.getAttribute("class"),
      groupClass: element.closest("g")?.getAttribute("class"),
      value: (element.textContent || "").replace(/\s+/gu, " ").trim()
    })),
    targets: Array.from(svg.querySelectorAll("[data-node-id]"), (element) => ({
      id: element.getAttribute("data-node-id"),
      label: element.getAttribute("data-node-label")
    }))
  }));

  await expect(
    page.locator('[data-testid="diagram-container"] [data-node-id="actor-customer"]').first(),
    `Resolved parser elements: ${JSON.stringify(resolvedElements)}; rendered ZenUML SVG: ${JSON.stringify(svgState)}`
  ).toHaveAttribute("data-focus-state", "focused");
}

async function expectZenUmlVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="diagram-container"] svg').first()).toBeVisible();
}

async function readActorFill(page: Page): Promise<string> {
  return page.locator('[data-testid="diagram-container"] [data-node-id="actor-customer"] rect')
    .evaluate((element) => getComputedStyle(element).fill);
}
