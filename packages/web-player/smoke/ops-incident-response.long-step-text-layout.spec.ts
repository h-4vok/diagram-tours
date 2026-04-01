import { expect, test } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";

test("long step text does not break the usable diagram area", async ({ page }) => {
  await page.goto("/ops-incident-response?step=4");

  await expectDiagramVisible(page);

  const stepTextBox = await page.getByTestId("step-text-container").boundingBox();
  const diagramBox = await page.getByTestId("diagram-container").boundingBox();
  const overlayBox = await page.getByTestId("teleprompter").boundingBox();

  assertLayoutBox(stepTextBox);
  assertLayoutBox(diagramBox);
  assertLayoutBox(overlayBox);
  expect(diagramBox.height).toBeGreaterThan(300);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(diagramBox.y + diagramBox.height);
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(diagramBox.x + diagramBox.width);
});

function assertLayoutBox(input: {
  height: number;
  width: number;
  x: number;
  y: number;
} | null): asserts input is {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  expect(input).not.toBeNull();
}
