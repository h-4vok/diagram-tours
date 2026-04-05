import { expect, test } from "@playwright/test";
import { expectDiagramVisible, readDiagramScrollPosition } from "./smoke-test-helpers";

test("clicking the minimap pans the main diagram viewport", async ({ page }) => {
  await page.goto("/ops-huge-system");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-surface")).toBeVisible();
  await expect(page.getByTestId("minimap-viewport-rect")).toBeVisible();

  const previousScroll = await readDiagramScrollPosition(page);
  const minimapBox = await page.getByTestId("minimap-surface").boundingBox();
  const viewportRectBox = await page.getByTestId("minimap-viewport-rect").boundingBox();

  assertLayoutBox(minimapBox);
  assertLayoutBox(viewportRectBox);
  const clickPoint = readMinimapSurfaceClickPoint(minimapBox, viewportRectBox);
  await page.mouse.click(clickPoint.x, clickPoint.y);

  await expect.poll(async () => readDiagramScrollPosition(page)).not.toEqual(previousScroll);
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
  const inset = 12;
  const candidates = [
    { x: minimapBox.x + inset, y: minimapBox.y + inset },
    { x: minimapBox.x + minimapBox.width - inset, y: minimapBox.y + inset },
    { x: minimapBox.x + inset, y: minimapBox.y + minimapBox.height - inset },
    {
      x: minimapBox.x + minimapBox.width - inset,
      y: minimapBox.y + minimapBox.height - inset
    }
  ];

  for (const candidate of candidates) {
    if (!isInsideViewportRect(candidate, viewportRectBox)) {
      return candidate;
    }
  }

  return candidates[0];
}

function isInsideViewportRect(
  point: { x: number; y: number },
  viewportRectBox: {
    height: number;
    width: number;
    x: number;
    y: number;
  }
): boolean {
  return (
    isInsideViewportAxis(point.x, viewportRectBox.x, viewportRectBox.width) &&
    isInsideViewportAxis(point.y, viewportRectBox.y, viewportRectBox.height)
  );
}

function isInsideViewportAxis(value: number, origin: number, size: number): boolean {
  return value >= origin && value <= origin + size;
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
