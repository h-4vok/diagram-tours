import { expect, test, type Locator } from "@playwright/test";
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
  await dispatchMinimapPointerDown(minimapSurface, clickPoint);

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
      rectStart: viewportRectBox.x
    }),
    y: readPanAxisPoint({
      axisEnd: minimapBox.y + minimapBox.height,
      axisStart: minimapBox.y,
      rectStart: viewportRectBox.y
    })
  };
}

function readPanAxisPoint(input: {
  axisEnd: number;
  axisStart: number;
  rectStart: number;
}): number {
  const inset = 12;

  return hasLeadingPanSpace(input.axisStart, input.rectStart, inset)
    ? input.axisStart + inset
    : input.axisEnd - inset;
}

function hasLeadingPanSpace(axisStart: number, rectStart: number, inset: number): boolean {
  return rectStart - axisStart > inset;
}

async function dispatchMinimapPointerDown(
  minimapSurface: Locator,
  clickPoint: { x: number; y: number }
): Promise<void> {
  await minimapSurface.evaluate((element, point) => {
    const rect = element.getBoundingClientRect();

    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse"
      })
    );

    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX: Math.min(Math.max(point.x, rect.left), rect.right),
        clientY: Math.min(Math.max(point.y, rect.top), rect.bottom),
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
  }, clickPoint);
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
