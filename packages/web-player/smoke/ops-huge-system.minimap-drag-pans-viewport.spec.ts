import { expect, test } from "@playwright/test";
import { expectDiagramVisible, readDiagramScrollPosition } from "./smoke-test-helpers";

test("dragging the minimap viewport rectangle pans the main diagram viewport", async ({ page }) => {
  await page.goto("/ops-huge-system");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-viewport-rect")).toBeVisible();

  const previousScroll = await readDiagramScrollPosition(page);
  const viewportRectBox = await page.getByTestId("minimap-viewport-rect").boundingBox();

  assertLayoutBox(viewportRectBox);
  await page.mouse.move(
    viewportRectBox.x + viewportRectBox.width / 2,
    viewportRectBox.y + viewportRectBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    viewportRectBox.x + viewportRectBox.width / 2 + 36,
    viewportRectBox.y + viewportRectBox.height / 2 + 24,
    {
      steps: 4
    }
  );
  await page.mouse.up();

  await expect.poll(async () => readDiagramScrollPosition(page)).not.toEqual(previousScroll);
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
