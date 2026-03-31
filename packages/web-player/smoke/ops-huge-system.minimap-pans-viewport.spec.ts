import { expect, test } from "@playwright/test";
import { expectDiagramVisible, readDiagramScrollPosition } from "./smoke-test-helpers";

test("clicking the minimap pans the main diagram viewport", async ({ page }) => {
  await page.goto("/ops-huge-system");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-surface")).toBeVisible();

  const previousScroll = await readDiagramScrollPosition(page);
  const minimapBox = await page.getByTestId("minimap-surface").boundingBox();

  assertLayoutBox(minimapBox);
  await page.getByTestId("minimap-surface").click({
    position: {
      x: minimapBox.width - 10,
      y: minimapBox.height - 10
    }
  });

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
