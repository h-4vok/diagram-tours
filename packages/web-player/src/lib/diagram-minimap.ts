export interface DiagramMinimapNodeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DiagramMinimapMetrics {
  contentHeight: number;
  contentWidth: number;
  scrollLeft: number;
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
}

export interface DiagramMinimapSize {
  maxHeight: number;
  maxWidth: number;
}

export interface DiagramMinimapRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DiagramMinimapGeometry {
  bounds: DiagramMinimapRect;
  nodeRects: DiagramMinimapRect[];
  focusRects: DiagramMinimapRect[];
  viewportRect: DiagramMinimapRect;
}

export function createDiagramMinimapGeometry(input: {
  nodeRects: DiagramMinimapNodeRect[];
  focusedNodeRects: DiagramMinimapNodeRect[];
  metrics: DiagramMinimapMetrics;
  minimapSize: DiagramMinimapSize;
}): DiagramMinimapGeometry | null {
  const scale = readMinimapScale(input.metrics, input.minimapSize);

  if (scale === null) {
    return null;
  }

  const bounds = createBoundsRect(input.metrics, scale);

  return {
    bounds,
    nodeRects: input.nodeRects.filter(isValidNodeRect).map((rect) => scaleNodeRect(rect, scale, bounds)),
    focusRects: input.focusedNodeRects
      .filter(isValidNodeRect)
      .map((rect) => scaleNodeRect(rect, scale, bounds)),
    viewportRect: createViewportRect(input.metrics, scale, bounds)
  };
}

export function createMinimapCenterScrollPosition(input: {
  metrics: DiagramMinimapMetrics;
  minimapPoint: { x: number; y: number };
  minimapSize: DiagramMinimapSize;
}): {
  scrollLeft: number;
  scrollTop: number;
} | null {
  const scale = readMinimapScale(input.metrics, input.minimapSize);

  if (scale === null) {
    return null;
  }

  return createScrollPosition({
    metrics: input.metrics,
    nextLeft: input.minimapPoint.x / scale - input.metrics.viewportWidth / 2,
    nextTop: input.minimapPoint.y / scale - input.metrics.viewportHeight / 2
  });
}

export function createMinimapViewportScrollPosition(input: {
  metrics: DiagramMinimapMetrics;
  minimapSize: DiagramMinimapSize;
  viewportOrigin: { x: number; y: number };
}): {
  scrollLeft: number;
  scrollTop: number;
} | null {
  const scale = readMinimapScale(input.metrics, input.minimapSize);

  if (scale === null) {
    return null;
  }

  return createScrollPosition({
    metrics: input.metrics,
    nextLeft: input.viewportOrigin.x / scale,
    nextTop: input.viewportOrigin.y / scale
  });
}

export function readDiagramMinimapMetrics(input: {
  container: HTMLElement;
  content: HTMLElement;
}): DiagramMinimapMetrics {
  return {
    contentHeight: readExtent(input.content, "height"),
    contentWidth: readExtent(input.content, "width"),
    scrollLeft: sanitizeFiniteValue(input.container.scrollLeft),
    scrollTop: sanitizeFiniteValue(input.container.scrollTop),
    viewportHeight: sanitizeFiniteValue(input.container.clientHeight),
    viewportWidth: sanitizeFiniteValue(input.container.clientWidth)
  };
}

export function readDiagramMinimapNodeRects(input: {
  content: HTMLElement;
  focusedElementIds?: string[];
  focusedNodeIds?: string[];
}): DiagramMinimapNodeRect[] {
  const contentRect = input.content.getBoundingClientRect();
  const focusedElementIds = input.focusedElementIds ?? input.focusedNodeIds ?? [];

  return focusedElementIds.flatMap((elementId) =>
    readMatchingDiagramElements(input.content, elementId).map((element) => toNodeRect(contentRect, element))
  );
}

function readMatchingDiagramElements(content: HTMLElement, elementId: string): HTMLElement[] {
  const selector = createDiagramElementSelector(elementId);

  return readMatchingDiagramElementsFromList(content, selector) ?? readSingleMatchingDiagramElement(content, elementId);
}

function createDiagramElementSelector(elementId: string): string {
  return [
    `[data-diagram-element-id="${elementId}"]:not([data-diagram-element-auxiliary="true"])`,
    `[data-node-id="${elementId}"]:not([data-diagram-element-auxiliary="true"])`
  ].join(", ");
}

function readMatchingDiagramElementsFromList(
  content: HTMLElement,
  selector: string
): HTMLElement[] | null {
  return typeof content.querySelectorAll === "function"
    ? Array.from(content.querySelectorAll<HTMLElement>(selector))
    : null;
}

function readSingleMatchingDiagramElement(content: HTMLElement, elementId: string): HTMLElement[] {
  const element =
    content.querySelector<HTMLElement>(
      `[data-diagram-element-id="${elementId}"]:not([data-diagram-element-auxiliary="true"])`
    ) ??
    content.querySelector<HTMLElement>(
      `[data-node-id="${elementId}"]:not([data-diagram-element-auxiliary="true"])`
    );

  return element === null ? [] : [element];
}

function createBoundsRect(
  metrics: DiagramMinimapMetrics,
  scale: number
): DiagramMinimapRect {
  return {
    left: 0,
    top: 0,
    width: roundToPixel(metrics.contentWidth * scale),
    height: roundToPixel(metrics.contentHeight * scale)
  };
}

function createViewportRect(
  metrics: DiagramMinimapMetrics,
  scale: number,
  bounds: DiagramMinimapRect
): DiagramMinimapRect {
  const viewportWidth = Math.min(bounds.width, roundToPixel(metrics.viewportWidth * scale));
  const viewportHeight = Math.min(bounds.height, roundToPixel(metrics.viewportHeight * scale));

  return {
    left: clampRectOrigin(roundToPixel(metrics.scrollLeft * scale), bounds.width - viewportWidth),
    top: clampRectOrigin(roundToPixel(metrics.scrollTop * scale), bounds.height - viewportHeight),
    width: viewportWidth,
    height: viewportHeight
  };
}

function scaleNodeRect(
  rect: DiagramMinimapNodeRect,
  scale: number,
  bounds: DiagramMinimapRect
): DiagramMinimapRect {
  const width = clampRectSize(roundToPixel(rect.width * scale), bounds.width);
  const height = clampRectSize(roundToPixel(rect.height * scale), bounds.height);

  return {
    left: clampRectOrigin(roundToPixel(rect.left * scale), bounds.width - width),
    top: clampRectOrigin(roundToPixel(rect.top * scale), bounds.height - height),
    width,
    height
  };
}

function createScrollPosition(input: {
  metrics: DiagramMinimapMetrics;
  nextLeft: number;
  nextTop: number;
}): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: clampScrollTarget(
      input.nextLeft,
      input.metrics.contentWidth - input.metrics.viewportWidth
    ),
    scrollTop: clampScrollTarget(
      input.nextTop,
      input.metrics.contentHeight - input.metrics.viewportHeight
    )
  };
}

function readMinimapScale(
  metrics: DiagramMinimapMetrics,
  minimapSize: DiagramMinimapSize
): number | null {
  if (!hasStableMetrics(metrics) || !hasStableMinimapSize(minimapSize)) {
    return null;
  }

  return Math.min(
    minimapSize.maxWidth / metrics.contentWidth,
    minimapSize.maxHeight / metrics.contentHeight
  );
}

function hasStableMetrics(metrics: DiagramMinimapMetrics): boolean {
  return hasStableContentMetrics(metrics) && hasStableViewportMetrics(metrics);
}

function hasStableMinimapSize(minimapSize: DiagramMinimapSize): boolean {
  return isFinitePositive(minimapSize.maxWidth) && isFinitePositive(minimapSize.maxHeight);
}

function toNodeRect(contentRect: DOMRect, element: HTMLElement): DiagramMinimapNodeRect {
  const elementRect = element.getBoundingClientRect();

  return {
    left: elementRect.left - contentRect.left,
    top: elementRect.top - contentRect.top,
    width: elementRect.width,
    height: elementRect.height
  };
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

function clampRectOrigin(value: number, maxValue: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > maxValue) {
    return roundToPixel(maxValue);
  }

  return roundToPixel(value);
}

function clampRectSize(value: number, maxValue: number): number {
  if (value > maxValue) {
    return roundToPixel(maxValue);
  }

  return roundToPixel(Math.max(0, value));
}

function isValidNodeRect(rect: DiagramMinimapNodeRect): boolean {
  return hasFiniteNodeOrigin(rect) && hasFiniteNodeSize(rect);
}

function hasStableContentMetrics(metrics: DiagramMinimapMetrics): boolean {
  return isFinitePositive(metrics.contentWidth) && isFinitePositive(metrics.contentHeight);
}

function hasStableViewportMetrics(metrics: DiagramMinimapMetrics): boolean {
  return isFinitePositive(metrics.viewportWidth) && isFinitePositive(metrics.viewportHeight);
}

function hasFiniteNodeOrigin(rect: DiagramMinimapNodeRect): boolean {
  return Number.isFinite(rect.left) && Number.isFinite(rect.top);
}

function hasFiniteNodeSize(rect: DiagramMinimapNodeRect): boolean {
  return isFinitePositive(rect.width) && isFinitePositive(rect.height);
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

function readExtent(content: HTMLElement, axis: "height" | "width"): number {
  return sanitizeFiniteValue(readScrollExtent(content, axis) || readClientExtent(content, axis));
}

function readScrollExtent(content: HTMLElement, axis: "height" | "width"): number {
  return axis === "height" ? content.scrollHeight : content.scrollWidth;
}

function readClientExtent(content: HTMLElement, axis: "height" | "width"): number {
  return axis === "height" ? content.clientHeight : content.clientWidth;
}
