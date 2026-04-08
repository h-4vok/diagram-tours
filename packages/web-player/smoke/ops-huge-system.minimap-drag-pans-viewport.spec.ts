import { expect, test, type Page } from "@playwright/test";
import { expectDiagramVisible, readDiagramScrollPosition } from "./smoke-test-helpers";

test("dragging the minimap viewport rectangle pans the main diagram viewport", async ({ page }) => {
  await page.goto("/ops-huge-system");
  await expectDiagramVisible(page);
  await expect(page.getByTestId("minimap-viewport-rect")).toBeVisible();
  await expectMinimapEdgesToStayInsideSurface(page);

  await page.getByTestId("zoom-fit-button").click();
  await expectMinimapEdgesToStayInsideSurface(page);

  await page.getByTestId("zoom-in-button").click();
  await expectMinimapEdgesToStayInsideSurface(page);

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

async function expectMinimapEdgesToStayInsideSurface(page: Page): Promise<void> {
  const surface = page.getByTestId("minimap-surface");
  const edgeMarkers = page.getByTestId("minimap-edge-marker");

  await expect
    .poll(async () => {
      const surfaceRect = await surface.boundingBox();
      const markerRects = await edgeMarkers.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();

          return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
        })
      );

      return hasStableMinimapEdgeBounds(surfaceRect, markerRects);
    })
    .toBe(true);
}

function hasStableMinimapEdgeBounds(
  surfaceRect: { height: number; width: number; x: number; y: number } | null,
  markerRects: Array<{ bottom: number; left: number; right: number; top: number }>
): boolean {
  return surfaceRect !== null && markerRects.length > 0 && markerRects.every((rect) => isMarkerInsideSurface(surfaceRect, rect));
}

function isMarkerInsideSurface(
  surfaceRect: { height: number; width: number; x: number; y: number },
  markerRect: { bottom: number; left: number; right: number; top: number }
): boolean {
  return isMarkerInsideSurfaceX(surfaceRect, markerRect) && isMarkerInsideSurfaceY(surfaceRect, markerRect);
}

function isMarkerInsideSurfaceX(
  surfaceRect: { height: number; width: number; x: number; y: number },
  markerRect: { bottom: number; left: number; right: number; top: number }
): boolean {
  return markerRect.left >= surfaceRect.x - 2 && markerRect.right <= surfaceRect.x + surfaceRect.width + 2;
}

function isMarkerInsideSurfaceY(
  surfaceRect: { height: number; width: number; x: number; y: number },
  markerRect: { bottom: number; left: number; right: number; top: number }
): boolean {
  return markerRect.top >= surfaceRect.y - 2 && markerRect.bottom <= surfaceRect.y + surfaceRect.height + 2;
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
