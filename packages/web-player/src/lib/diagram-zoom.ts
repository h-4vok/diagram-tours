import type { DiagramMinimapMetrics } from "$lib/diagram-minimap";

export const DEFAULT_ZOOM_SCALE = 1;
export const MIN_ZOOM_SCALE = 0.5;
export const MAX_ZOOM_SCALE = 2;
export const ZOOM_SCALE_STEP = 0.25;

export function canZoomIn(scale: number): boolean {
  return scale < MAX_ZOOM_SCALE;
}

export function canZoomOut(scale: number): boolean {
  return scale > MIN_ZOOM_SCALE;
}

export function createNextZoomScale(scale: number, direction: "in" | "out" | "reset"): number {
  if (direction === "reset") {
    return DEFAULT_ZOOM_SCALE;
  }

  const delta = direction === "in" ? ZOOM_SCALE_STEP : -ZOOM_SCALE_STEP;

  return clampZoomScale(scale + delta);
}

export function formatZoomPercentage(scale: number): string {
  return `${Math.round(clampZoomScale(scale) * 100)}%`;
}

export function createPreservedZoomScrollPosition(input: {
  nextMetrics: DiagramMinimapMetrics;
  previousMetrics: DiagramMinimapMetrics;
}): {
  scrollLeft: number;
  scrollTop: number;
} | null {
  if (!hasStableMetrics(input.previousMetrics) || !hasStableMetrics(input.nextMetrics)) {
    return null;
  }

  const centerRatios = readViewportCenterRatios(input.previousMetrics);

  return {
    scrollLeft: clampScrollTarget(
      centerRatios.x * input.nextMetrics.contentWidth - input.nextMetrics.viewportWidth / 2,
      input.nextMetrics.contentWidth - input.nextMetrics.viewportWidth
    ),
    scrollTop: clampScrollTarget(
      centerRatios.y * input.nextMetrics.contentHeight - input.nextMetrics.viewportHeight / 2,
      input.nextMetrics.contentHeight - input.nextMetrics.viewportHeight
    )
  };
}

export function applySvgZoom(svg: SVGSVGElement, scale: number): boolean {
  const intrinsicSize = readIntrinsicSvgSize(svg);

  if (intrinsicSize === null) {
    return false;
  }

  const normalizedScale = clampZoomScale(scale);

  svg.setAttribute("width", String(roundToPixel(intrinsicSize.width * normalizedScale)));
  svg.setAttribute("height", String(roundToPixel(intrinsicSize.height * normalizedScale)));
  svg.dataset.zoomScale = String(normalizedScale);

  return true;
}

function clampZoomScale(scale: number): number {
  if (scale < MIN_ZOOM_SCALE) {
    return MIN_ZOOM_SCALE;
  }

  if (scale > MAX_ZOOM_SCALE) {
    return MAX_ZOOM_SCALE;
  }

  return roundToQuarterStep(scale);
}

function roundToQuarterStep(scale: number): number {
  return Math.round(scale / ZOOM_SCALE_STEP) * ZOOM_SCALE_STEP;
}

function readIntrinsicSvgSize(svg: SVGSVGElement): { height: number; width: number } | null {
  const width = readIntrinsicSvgDimension(svg, "width");

  if (width === null) {
    return null;
  }

  const height = readIntrinsicSvgDimension(svg, "height");

  return height === null ? null : { height, width };
}

function readViewportCenterRatios(metrics: DiagramMinimapMetrics): { x: number; y: number } {
  return {
    x: readViewportCenterRatio(metrics.scrollLeft, metrics.viewportWidth, metrics.contentWidth),
    y: readViewportCenterRatio(metrics.scrollTop, metrics.viewportHeight, metrics.contentHeight)
  };
}

function readIntrinsicSvgDimension(
  svg: SVGSVGElement,
  axis: "height" | "width"
): number | null {
  return readPositiveFiniteNumber(readSvgDimensionValue(svg, axis));
}

function readSvgDimensionValue(svg: SVGSVGElement, axis: "height" | "width"): string | null {
  return readSvgDatasetDimension(svg, axis) ?? readSvgAttributeDimension(svg, axis);
}

function readSvgDatasetDimension(svg: SVGSVGElement, axis: "height" | "width"): string | undefined {
  return axis === "height" ? svg.dataset.intrinsicHeight : svg.dataset.intrinsicWidth;
}

function readSvgAttributeDimension(svg: SVGSVGElement, axis: "height" | "width"): string | null {
  return axis === "height" ? svg.getAttribute("height") : svg.getAttribute("width");
}

function readPositiveFiniteNumber(value: string | null): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasStableMetrics(metrics: DiagramMinimapMetrics): boolean {
  return hasStableContent(metrics) && hasStableViewport(metrics);
}

function hasStableContent(metrics: DiagramMinimapMetrics): boolean {
  return isFinitePositive(metrics.contentWidth) && isFinitePositive(metrics.contentHeight);
}

function hasStableViewport(metrics: DiagramMinimapMetrics): boolean {
  return isFinitePositive(metrics.viewportWidth) && isFinitePositive(metrics.viewportHeight);
}

function readViewportCenterRatio(scroll: number, viewport: number, content: number): number {
  return (sanitizeFiniteValue(scroll) + viewport / 2) / content;
}

function clampScrollTarget(target: number, maxScroll: number): number {
  const sanitizedMaxScroll = Math.max(0, sanitizeFiniteValue(maxScroll));
  const sanitizedTarget = sanitizeFiniteValue(target);

  if (sanitizedTarget < 0) {
    return 0;
  }

  if (sanitizedTarget > sanitizedMaxScroll) {
    return sanitizedMaxScroll;
  }

  return Math.round(sanitizedTarget);
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function sanitizeFiniteValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function roundToPixel(value: number): number {
  return Math.round(value * 100) / 100;
}
