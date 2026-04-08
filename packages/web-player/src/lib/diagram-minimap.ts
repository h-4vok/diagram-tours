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

export interface DiagramMinimapConnectorSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DiagramMinimapArrowhead {
  angle: number;
  x: number;
  y: number;
}

export interface DiagramMinimapConnector {
  arrowhead: DiagramMinimapArrowhead | null;
  segments: DiagramMinimapConnectorSegment[];
}

export interface DiagramMinimapGeometry {
  bounds: DiagramMinimapRect;
  connectors: DiagramMinimapConnector[];
  nodeRects: DiagramMinimapRect[];
  focusRects: DiagramMinimapRect[];
  viewportRect: DiagramMinimapRect;
}

export function createDiagramMinimapGeometry(input: {
  connectors?: DiagramMinimapConnector[];
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
    connectors: (input.connectors ?? [])
      .map((connector) => scaleConnector(connector, scale, bounds))
      .filter((connector) => connector.segments.length > 0),
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

export function readDiagramMinimapConnectors(input: {
  content: HTMLElement;
}): DiagramMinimapConnector[] {
  const contentRect = input.content.getBoundingClientRect();

  return readConnectorElements(input.content)
    .map((element) => toConnector(contentRect, element))
    .filter((connector): connector is DiagramMinimapConnector => connector !== null);
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

function scaleConnector(
  connector: DiagramMinimapConnector,
  scale: number,
  bounds: DiagramMinimapRect
): DiagramMinimapConnector {
  const segments = connector.segments
    .map((segment) => scaleConnectorSegment(segment, scale, bounds))
    .filter((segment) => segment !== null);

  return {
    arrowhead: scaleArrowhead(connector.arrowhead, scale, bounds),
    segments
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

function readConnectorElements(content: HTMLElement): SVGElement[] {
  const selectors = [
    ".flowchart-link",
    ".messageLine0",
    ".messageLine1",
    ".messageLine"
  ];

  return selectors.flatMap((selector) =>
    Array.from(content.querySelectorAll<SVGElement>(selector)).filter(
      (element, index, collection) =>
        element.dataset.diagramElementAuxiliary !== "true" && collection.indexOf(element) === index
    )
  );
}

function toConnector(contentRect: DOMRect, element: SVGElement): DiagramMinimapConnector | null {
  const segments = readConnectorSegments(contentRect, element);

  if (segments.length === 0) {
    return null;
  }

  return {
    arrowhead: createArrowhead(segments[segments.length - 1]),
    segments
  };
}

function readConnectorSegments(
  contentRect: DOMRect,
  element: SVGElement
): DiagramMinimapConnectorSegment[] {
  const sampledSegments = readSampledConnectorSegments(contentRect, element);

  if (sampledSegments.length > 0) {
    return sampledSegments;
  }

  return readStraightConnectorSegments(contentRect, element);
}

function readSampledConnectorSegments(
  contentRect: DOMRect,
  element: SVGElement
): DiagramMinimapConnectorSegment[] {
  if (!hasSampledGeometryApi(element)) {
    return [];
  }

  const totalLength = sanitizeFiniteValue(element.getTotalLength());

  if (totalLength <= 0) {
    return [];
  }

  const stepCount = Math.max(1, Math.ceil(totalLength / 24));
  const points = Array.from({ length: stepCount + 1 }, (_, index) =>
    toRelativePoint(contentRect, element, element.getPointAtLength((totalLength * index) / stepCount))
  );

  return toConnectorSegmentsFromPoints(points);
}

function readStraightConnectorSegments(
  contentRect: DOMRect,
  element: SVGElement
): DiagramMinimapConnectorSegment[] {
  if (isSvgLineElement(element)) {
    return toConnectorSegmentsFromPoints([
      readLinePoint({ contentRect, element, xAttribute: "x1", yAttribute: "y1" }),
      readLinePoint({ contentRect, element, xAttribute: "x2", yAttribute: "y2" })
    ]);
  }

  if (isSvgPolylineElement(element)) {
    return toConnectorSegmentsFromPoints(
      Array.from(element.points).map((point) => toRelativePoint(contentRect, element, point))
    );
  }

  return [];
}

function hasSampledGeometryApi(
  element: SVGElement
): element is SVGElement & {
  getPointAtLength: (distance: number) => DOMPoint;
  getTotalLength: () => number;
} {
  const sampledElement = element as SVGElement & {
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  };

  return (
    typeof sampledElement.getTotalLength === "function" &&
    typeof sampledElement.getPointAtLength === "function"
  );
}

function isSvgLineElement(element: SVGElement): element is SVGLineElement {
  return typeof SVGLineElement !== "undefined" && element instanceof SVGLineElement;
}

function isSvgPolylineElement(element: SVGElement): element is SVGPolylineElement {
  return typeof SVGPolylineElement !== "undefined" && element instanceof SVGPolylineElement;
}

function toRelativePoint(
  contentRect: DOMRect,
  element: SVGElement,
  point: { x: number; y: number }
): { x: number; y: number } {
  const svgProjection = readSvgProjection(contentRect, element);

  return {
    x: svgProjection.x + point.x * svgProjection.scaleX,
    y: svgProjection.y + point.y * svgProjection.scaleY
  };
}

function readLinePoint(input: {
  contentRect: DOMRect;
  element: SVGLineElement;
  xAttribute: "x1" | "x2";
  yAttribute: "y1" | "y2";
}): { x: number; y: number } {
  const svgProjection = readSvgProjection(input.contentRect, input.element);

  return {
    x: svgProjection.x + readScaledCoordinate(input.element[input.xAttribute].baseVal.value, svgProjection.scaleX),
    y: svgProjection.y + readScaledCoordinate(input.element[input.yAttribute].baseVal.value, svgProjection.scaleY)
  };
}

function readScaledCoordinate(value: number, scale: number): number {
  return sanitizeFiniteValue(value) * scale;
}

function readSvgProjection(
  contentRect: DOMRect,
  element: SVGElement
): { scaleX: number; scaleY: number; x: number; y: number } {
  const svg = readProjectionSvg(element);

  if (svg === null) {
    return createDefaultSvgProjection();
  }

  const svgRect = svg.getBoundingClientRect();
  const svgDataset = readSvgDataset(svg);

  return {
    scaleX: readSvgAxisScale(svgDataset.intrinsicWidth, svgRect.width),
    scaleY: readSvgAxisScale(svgDataset.intrinsicHeight, svgRect.height),
    x: svgRect.left - contentRect.left,
    y: svgRect.top - contentRect.top
  };
}

function createDefaultSvgProjection(): { scaleX: number; scaleY: number; x: number; y: number } {
  return { scaleX: 1, scaleY: 1, x: 0, y: 0 };
}

function readProjectionSvg(element: SVGElement): SVGSVGElement | null {
  const svg = element.ownerSVGElement ?? null;

  return hasProjectionSvgRect(svg) ? svg : null;
}

function hasProjectionSvgRect(svg: SVGSVGElement | null): svg is SVGSVGElement {
  return svg !== null && typeof svg.getBoundingClientRect === "function";
}

function readSvgDataset(svg: SVGSVGElement): DOMStringMap {
  return "dataset" in svg ? svg.dataset : {};
}

function readSvgAxisScale(intrinsicSize: string | undefined, renderedSize: number): number {
  const intrinsicValue = sanitizeFiniteValue(Number(intrinsicSize));

  if (intrinsicValue <= 0) {
    return 1;
  }

  const renderedValue = sanitizeFiniteValue(renderedSize);

  return renderedValue <= 0 ? 1 : renderedValue / intrinsicValue;
}

function toConnectorSegmentsFromPoints(points: Array<{ x: number; y: number }>): DiagramMinimapConnectorSegment[] {
  return points.slice(1).flatMap((point, index) => {
    const previousPoint = points[index];

    return isValidConnectorSegment(previousPoint, point)
      ? [{ x1: previousPoint.x, y1: previousPoint.y, x2: point.x, y2: point.y }]
      : [];
  });
}

function isValidConnectorSegment(
  start: { x: number; y: number },
  end: { x: number; y: number }
): boolean {
  return [start.x, start.y, end.x, end.y].every(Number.isFinite);
}

function createArrowhead(
  segment: DiagramMinimapConnectorSegment
): DiagramMinimapArrowhead {
  return {
    angle: roundToPixel((Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * 180) / Math.PI),
    x: segment.x2,
    y: segment.y2
  };
}

function scaleConnectorSegment(
  segment: DiagramMinimapConnectorSegment,
  scale: number,
  bounds: DiagramMinimapRect
): DiagramMinimapConnectorSegment | null {
  if (!hasFiniteConnectorSegment(segment)) {
    return null;
  }

  const scaled = {
    x1: clampCoordinate(roundToPixel(segment.x1 * scale), bounds.width),
    y1: clampCoordinate(roundToPixel(segment.y1 * scale), bounds.height),
    x2: clampCoordinate(roundToPixel(segment.x2 * scale), bounds.width),
    y2: clampCoordinate(roundToPixel(segment.y2 * scale), bounds.height)
  };

  return isCollapsedConnectorSegment(scaled) ? null : scaled;
}

function hasFiniteConnectorSegment(segment: DiagramMinimapConnectorSegment): boolean {
  return [segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite);
}

function scaleArrowhead(
  arrowhead: DiagramMinimapArrowhead | null,
  scale: number,
  bounds: DiagramMinimapRect
): DiagramMinimapArrowhead | null {
  if (arrowhead === null) {
    return null;
  }

  return {
    angle: arrowhead.angle,
    x: clampCoordinate(roundToPixel(arrowhead.x * scale), bounds.width),
    y: clampCoordinate(roundToPixel(arrowhead.y * scale), bounds.height)
  };
}

function isCollapsedConnectorSegment(segment: DiagramMinimapConnectorSegment): boolean {
  return segment.x1 === segment.x2 && segment.y1 === segment.y2;
}

function clampCoordinate(value: number, maxValue: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > maxValue) {
    return roundToPixel(maxValue);
  }

  return roundToPixel(value);
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
