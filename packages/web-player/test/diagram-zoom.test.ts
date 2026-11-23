import { describe, expect, it } from "vitest";

import {
  applySvgZoom,
  canZoomIn,
  canZoomOut,
  createCenteredContentScrollPosition,
  createContentZoomToFitScale,
  createNextZoomScale,
  createPreservedZoomScrollPosition,
  createZoomToFitScale,
  DEFAULT_ZOOM_SCALE,
  formatZoomPercentage,
} from "../src/lib/diagram-zoom";

describe("diagram zoom helpers", () => {
  it("starts at a 100 percent zoom level", () => {
    expect(DEFAULT_ZOOM_SCALE).toBe(1);
    expect(formatZoomPercentage(DEFAULT_ZOOM_SCALE)).toBe("100%");
  });

  it("clamps zoom changes to the supported range", () => {
    expect(createNextZoomScale(1, "in")).toBe(1.25);
    expect(createNextZoomScale(1, "out")).toBe(0.75);
    expect(createNextZoomScale(2, "in")).toBe(2);
    expect(createNextZoomScale(0.5, "out")).toBe(0.5);
    expect(createNextZoomScale(1.25, "reset")).toBe(1);
  });

  it("reports whether zoom controls should stay enabled", () => {
    expect(canZoomIn(1)).toBe(true);
    expect(canZoomIn(2)).toBe(false);
    expect(canZoomOut(1)).toBe(true);
    expect(canZoomOut(0.5)).toBe(false);
  });

  it("preserves the current viewport center across zoom changes", () => {
    expect(
      createPreservedZoomScrollPosition({
        nextMetrics: createMetrics({
          contentHeight: 1280,
          contentWidth: 1600,
        }),
        previousMetrics: createMetrics({
          scrollLeft: 100,
          scrollTop: 50,
        }),
      }),
    ).toEqual({
      scrollLeft: 280,
      scrollTop: 170,
    });
  });

  it("clamps preserved scroll positions when the computed target falls outside the stage", () => {
    expect(
      createPreservedZoomScrollPosition({
        nextMetrics: createMetrics({
          contentHeight: 600,
          contentWidth: 800,
        }),
        previousMetrics: createMetrics({
          scrollLeft: Number.NaN,
          scrollTop: 9999,
        }),
      }),
    ).toEqual({
      scrollLeft: 0,
      scrollTop: 300,
    });
  });

  it("creates a zoom scale that fits the viewport within the supported bounds", () => {
    expect(
      createZoomToFitScale({
        currentScale: 1,
        metrics: createMetrics({
          contentHeight: 1000,
          contentWidth: 2000,
          viewportHeight: 500,
          viewportWidth: 600,
        }),
      }),
    ).toBe(0.5);

    expect(
      createZoomToFitScale({
        currentScale: 1.5,
        metrics: createMetrics({
          contentHeight: 600,
          contentWidth: 800,
          viewportHeight: 1200,
          viewportWidth: 1600,
        }),
      }),
    ).toBe(2);
  });

  it("returns null when fit metrics are unstable", () => {
    expect(
      createZoomToFitScale({
        currentScale: 1,
        metrics: createMetrics({
          contentHeight: 0,
        }),
      }),
    ).toBeNull();
  });

  it("returns null when zoom preservation metrics are unstable", () => {
    expect(
      createPreservedZoomScrollPosition({
        nextMetrics: createMetrics(),
        previousMetrics: createMetrics({
          contentWidth: 0,
        }),
      }),
    ).toBeNull();
  });

  it("creates a fit scale from real content bounds instead of the stage size", () => {
    expect(
      createContentZoomToFitScale({
        bounds: {
          height: 120,
          left: 180,
          top: 140,
          width: 320,
        },
        svgHeight: 640,
        svgWidth: 960,
        viewportHeight: 480,
        viewportWidth: 720,
      }),
    ).toBe(2);
  });

  it("creates a fit scale that can zoom out for large diagrams", () => {
    expect(
      createContentZoomToFitScale({
        bounds: {
          height: 560,
          left: 0,
          top: 0,
          width: 1400,
        },
        svgHeight: 640,
        svgWidth: 1600,
        viewportHeight: 480,
        viewportWidth: 720,
      }),
    ).toBe(0.5);
  });

  it("returns null when real-content fit inputs are unstable", () => {
    expect(
      createContentZoomToFitScale({
        bounds: {
          height: 0,
          left: 0,
          top: 0,
          width: 400,
        },
        svgHeight: 640,
        svgWidth: 960,
        viewportHeight: 480,
        viewportWidth: 720,
      }),
    ).toBeNull();
  });

  it("returns null when clamped real-content bounds collapse outside the svg", () => {
    expect(
      createContentZoomToFitScale({
        bounds: {
          height: 80,
          left: 980,
          top: 120,
          width: 120,
        },
        svgHeight: 640,
        svgWidth: 960,
        viewportHeight: 480,
        viewportWidth: 720,
      }),
    ).toBeNull();
  });

  it("clamps negative real-content bounds back into the svg before fitting", () => {
    expect(
      createContentZoomToFitScale({
        bounds: {
          height: 100,
          left: -20,
          top: -10,
          width: 200,
        },
        svgHeight: 640,
        svgWidth: 960,
        viewportHeight: 480,
        viewportWidth: 720,
      }),
    ).toBe(2);
  });

  it("recenters the viewport on real content bounds", () => {
    expect(
      createCenteredContentScrollPosition({
        bounds: {
          height: 84,
          left: 150,
          top: 290,
          width: 1098,
        },
        metrics: createMetrics({
          contentHeight: 920,
          contentWidth: 1320,
          viewportHeight: 480,
          viewportWidth: 720,
        }),
      }),
    ).toEqual({
      scrollLeft: 339,
      scrollTop: 92,
    });
  });

  it("returns null when centered-content scroll inputs are unstable", () => {
    expect(
      createCenteredContentScrollPosition({
        bounds: {
          height: 84,
          left: 150,
          top: 290,
          width: 0,
        },
        metrics: createMetrics(),
      }),
    ).toBeNull();
  });

  it("applies zoom using intrinsic svg dimensions", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.dataset.intrinsicWidth = "960";
    svg.dataset.intrinsicHeight = "640";

    expect(applySvgZoom(svg, 1.25)).toBe(true);
    expect(svg.getAttribute("width")).toBe("1200");
    expect(svg.getAttribute("height")).toBe("800");
    expect(svg.dataset.zoomScale).toBe("1.25");
  });

  it("falls back to width and height attributes when intrinsic dataset values are missing", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.setAttribute("width", "960");
    svg.setAttribute("height", "640");

    expect(applySvgZoom(svg, 5)).toBe(true);
    expect(svg.getAttribute("width")).toBe("1920");
    expect(svg.getAttribute("height")).toBe("1280");
    expect(svg.dataset.zoomScale).toBe("2");
  });

  it("formats out-of-range zoom percentages using the supported bounds", () => {
    expect(formatZoomPercentage(5)).toBe("200%");
    expect(formatZoomPercentage(0.1)).toBe("50%");
  });

  it("does not apply zoom when intrinsic svg dimensions are missing", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    expect(applySvgZoom(svg, 1.25)).toBe(false);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("height")).toBeNull();
  });

  it("does not apply zoom when only one intrinsic svg dimension is available", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.dataset.intrinsicWidth = "960";

    expect(applySvgZoom(svg, 1.25)).toBe(false);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("height")).toBeNull();
  });
});

function createMetrics(
  input?: Partial<{
    contentHeight: number;
    contentWidth: number;
    scrollLeft: number;
    scrollTop: number;
    viewportHeight: number;
    viewportWidth: number;
  }>,
): {
  contentHeight: number;
  contentWidth: number;
  scrollLeft: number;
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
} {
  return {
    contentHeight: resolveMetric(input, "contentHeight", 800),
    contentWidth: resolveMetric(input, "contentWidth", 1000),
    scrollLeft: resolveMetric(input, "scrollLeft", 0),
    scrollTop: resolveMetric(input, "scrollTop", 0),
    viewportHeight: resolveMetric(input, "viewportHeight", 300),
    viewportWidth: resolveMetric(input, "viewportWidth", 400),
  };
}

function resolveMetric(
  input:
    | Partial<{
        contentHeight: number;
        contentWidth: number;
        scrollLeft: number;
        scrollTop: number;
        viewportHeight: number;
        viewportWidth: number;
      }>
    | undefined,
  key:
    | "contentHeight"
    | "contentWidth"
    | "scrollLeft"
    | "scrollTop"
    | "viewportHeight"
    | "viewportWidth",
  fallback: number,
): number {
  return input?.[key] ?? fallback;
}
