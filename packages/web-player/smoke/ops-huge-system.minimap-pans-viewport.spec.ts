import { expect, test } from "@playwright/test";
import { expectDiagramVisible, readDiagramScrollPosition } from "./smoke-test-helpers";

test("clicking the minimap pans the main diagram viewport", async ({ page }) => {
  await page.goto("/ops-huge-system");
  await expectDiagramVisible(page);
  const minimapSurface = page.getByTestId("minimap-surface");
  const minimapViewportRect = page.getByTestId("minimap-viewport-rect");

  await expect(minimapSurface).toBeVisible();
  await expect(minimapViewportRect).toBeVisible();

  const previousScroll = await readDiagramScrollPosition(page);
  const minimapBox = await minimapSurface.boundingBox();
  const viewportRectBox = await minimapViewportRect.boundingBox();

  assertLayoutBox(minimapBox);
  assertLayoutBox(viewportRectBox);
  const clickPoint = readMinimapSurfaceClickPoint(minimapBox, viewportRectBox);
  await page.mouse.click(clickPoint.x, clickPoint.y);

  await expect.poll(async () => readDiagramScrollPosition(page), { timeout: 10_000 }).not.toEqual(
    previousScroll
  );
});

function readMinimapSurfaceClickPoint(
  minimapBox: {
    height: number;
    width: number;
    x: number;
    y: number;
  },
  viewportRectBox: {
    height: number;
    width: number;
    x: number;
    y: number;
  }
): { x: number; y: number } {
  return {
    x: readPanAxisPoint({
      axisEnd: minimapBox.x + minimapBox.width,
      axisStart: minimapBox.x,
      rectEnd: viewportRectBox.x + viewportRectBox.width,
      rectStart: viewportRectBox.x
    }),
    y: readPanAxisPoint({
      axisEnd: minimapBox.y + minimapBox.height,
      axisStart: minimapBox.y,
      rectEnd: viewportRectBox.y + viewportRectBox.height,
      rectStart: viewportRectBox.y
    })
  };
}

function readPanAxisPoint(input: {
  axisEnd: number;
  axisStart: number;
  rectEnd: number;
  rectStart: number;
}): number {
  return hasLeadingPanSpace(input)
    ? readAxisMidpoint(input.axisStart, input.rectStart)
    : readAxisMidpoint(input.rectEnd, input.axisEnd);
}

function hasLeadingPanSpace(input: {
  axisEnd: number;
  axisStart: number;
  rectEnd: number;
  rectStart: number;
}): boolean {
  return input.rectStart - input.axisStart > input.axisEnd - input.rectEnd;
}

function readAxisMidpoint(start: number, end: number): number {
  return start + (end - start) / 2;
}

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
