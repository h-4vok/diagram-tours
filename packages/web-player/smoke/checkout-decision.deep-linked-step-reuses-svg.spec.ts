import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("deep-linked step changes reuse the same Mermaid svg", async ({ page }) => {
  await page.goto("/sequence-order-sequence?step=2");

  await expectDiagramVisible(page);

  const diagramInstanceId = await page.locator('[data-testid="diagram-container"] svg').evaluate((element) => {
    const instanceId = element.getAttribute("data-test-instance-id") ?? globalThis.crypto.randomUUID();

    element.setAttribute("data-test-instance-id", instanceId);

    return instanceId;
  });

  await page.getByTestId("next-button").click();

  await expect(page).toHaveURL(/\/sequence-order-sequence\?step=3$/);
  await expect(page.locator('[data-testid="diagram-container"] svg')).toHaveAttribute(
    "data-test-instance-id",
    diagramInstanceId
  );
});
