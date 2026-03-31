import type { FocusGroup } from "$lib/focus-group";

const MIN_SCROLL_DELTA = 8;
const VIEWPORT_FOCUS_X_RATIO = 0.5;
const VIEWPORT_FOCUS_Y_RATIO = 0.38;

export interface DiagramNodeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DiagramViewportMetrics {
  contentHeight: number;
  contentWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}

export type DiagramViewportInstruction =
  | { mode: "focus"; scrollLeft: number; scrollTop: number }
  | { mode: "neutral"; scrollLeft: number; scrollTop: number }
  | { mode: "preserve" };

export function createViewportInstruction(input: {
  focusedNodeRects: DiagramNodeRect[];
  metrics: DiagramViewportMetrics;
}): DiagramViewportInstruction {
  if (input.focusedNodeRects.length === 0) {
    return {
      mode: "neutral",
      scrollLeft: 0,
      scrollTop: 0
    };
  }

  return createFocusInstruction(input);
}

export function focusDiagramViewport(input: {
  behavior?: ScrollBehavior;
  container: HTMLElement;
  content: HTMLElement;
  focusGroup: FocusGroup;
}): void {
  const previousPosition = readScrollPosition(input.container);

  if (shouldPreserveWithoutMeasurement(input)) {
    return;
  }

  const instruction = readViewportInstruction(input);

  if (instruction === null) {
    return;
  }

  applyViewportInstruction({
    behavior: input.behavior,
    container: input.container,
    instruction,
    previousPosition
  });
}

function readViewportInstruction(input: {
  container: HTMLElement;
  content: HTMLElement;
  focusGroup: FocusGroup;
}): DiagramViewportInstruction | null {
  const focusedNodeRects = readElementRects(input.content, input.focusGroup.elementIds);

  if (shouldPreserveCurrentViewport(input.focusGroup, focusedNodeRects)) {
    return null;
  }

  return createViewportInstruction({
    focusedNodeRects,
    metrics: readViewportMetrics({
      container: input.container,
      content: input.content
    })
  });
}

export function createOverviewScrollPosition(
  metrics: DiagramViewportMetrics
): { scrollLeft: number; scrollTop: number } | null {
  if (!hasStableMetrics(metrics)) {
    return null;
  }

  return {
    scrollLeft: clampScrollTarget(
      (metrics.contentWidth - metrics.viewportWidth) / 2,
      metrics.contentWidth - metrics.viewportWidth
    ),
    scrollTop: clampScrollTarget(
      (metrics.contentHeight - metrics.viewportHeight) / 2,
      metrics.contentHeight - metrics.viewportHeight
    )
  };
}

function createFocusInstruction(input: {
  focusedNodeRects: DiagramNodeRect[];
  metrics: DiagramViewportMetrics;
}): DiagramViewportInstruction {
  if (!hasStableMetrics(input.metrics) || !hasStableNodeRects(input.focusedNodeRects)) {
    return {
      mode: "preserve"
    };
  }

  const bounds = mergeNodeRects(input.focusedNodeRects);

  return {
    mode: "focus",
    scrollLeft: clampScrollTarget(
      bounds.left + bounds.width / 2 - input.metrics.viewportWidth * VIEWPORT_FOCUS_X_RATIO,
      input.metrics.contentWidth - input.metrics.viewportWidth
    ),
    scrollTop: clampScrollTarget(
      bounds.top + bounds.height / 2 - input.metrics.viewportHeight * VIEWPORT_FOCUS_Y_RATIO,
      input.metrics.contentHeight - input.metrics.viewportHeight
    )
  };
}

function shouldPreserveWithoutMeasurement(input: {
  container: HTMLElement;
  content: HTMLElement;
  focusGroup: FocusGroup;
}): boolean {
  return input.focusGroup.mode !== "empty" && !isRenderableSvgReady(input.content);
}

function shouldPreserveCurrentViewport(
  focusGroup: FocusGroup,
  focusedNodeRects: DiagramNodeRect[]
): boolean {
  return focusGroup.mode !== "empty" && focusedNodeRects.length === 0;
}

function applyViewportInstruction(input: {
  behavior?: ScrollBehavior;
  container: HTMLElement;
  instruction: DiagramViewportInstruction;
  previousPosition: { scrollLeft: number; scrollTop: number };
}): void {
  const nextPosition = resolveNextScrollPosition(input.instruction, input.previousPosition);

  writeScrollPosition(input.container, nextPosition, input.behavior);
}

function resolveNextScrollPosition(
  instruction: DiagramViewportInstruction,
  previousPosition: { scrollLeft: number; scrollTop: number }
): { scrollLeft: number; scrollTop: number } {
  if (instruction.mode === "preserve") {
    return previousPosition;
  }

  if (!shouldMoveViewport(previousPosition, instruction)) {
    return previousPosition;
  }

  return instruction;
}

function readElementRects(content: HTMLElement, focusedElementIds: string[]): DiagramNodeRect[] {
  const contentRect = content.getBoundingClientRect();

  return focusedElementIds.flatMap((elementId) =>
    readMatchingDiagramElements(content, elementId).map((element) => toNodeRect(contentRect, element))
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

function toNodeRect(contentRect: DOMRect, element: HTMLElement): DiagramNodeRect {
  const elementRect = element.getBoundingClientRect();

  return {
    left: elementRect.left - contentRect.left,
    top: elementRect.top - contentRect.top,
    width: elementRect.width,
    height: elementRect.height
  };
}

function readViewportMetrics(input: {
  container: HTMLElement;
  content: HTMLElement;
}): DiagramViewportMetrics {
  return {
    contentHeight: readContentExtent(input.content, "height"),
    contentWidth: readContentExtent(input.content, "width"),
    viewportHeight: sanitizeFiniteValue(input.container.clientHeight),
    viewportWidth: sanitizeFiniteValue(input.container.clientWidth)
  };
}

function hasStableMetrics(metrics: DiagramViewportMetrics): boolean {
  return hasStableViewportMetrics(metrics) && hasStableContentMetrics(metrics);
}

function hasStableNodeRects(rects: DiagramNodeRect[]): boolean {
  return rects.every((rect) => isValidRect(rect));
}

function mergeNodeRects(rects: DiagramNodeRect[]): DiagramNodeRect {
  return rects.reduce((bounds, rect) => {
    const right = Math.max(bounds.left + bounds.width, rect.left + rect.width);
    const bottom = Math.max(bounds.top + bounds.height, rect.top + rect.height);
    const left = Math.min(bounds.left, rect.left);
    const top = Math.min(bounds.top, rect.top);

    return {
      left,
      top,
      width: right - left,
      height: bottom - top
    };
  });
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

function readScrollPosition(container: HTMLElement): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: sanitizeFiniteValue(container.scrollLeft),
    scrollTop: sanitizeFiniteValue(container.scrollTop)
  };
}

function shouldMoveViewport(
  previousPosition: { scrollLeft: number; scrollTop: number },
  instruction: Extract<DiagramViewportInstruction, { mode: "focus" | "neutral" }>
): boolean {
  return (
    Math.abs(previousPosition.scrollLeft - instruction.scrollLeft) >= MIN_SCROLL_DELTA ||
    Math.abs(previousPosition.scrollTop - instruction.scrollTop) >= MIN_SCROLL_DELTA
  );
}

function writeScrollPosition(
  container: HTMLElement,
  position: {
    scrollLeft: number;
    scrollTop: number;
  },
  behavior: ScrollBehavior = "smooth"
): void {
  if (typeof container.scrollTo === "function") {
    container.scrollTo({
      behavior,
      left: position.scrollLeft,
      top: position.scrollTop
    });

    return;
  }

  container.scrollLeft = position.scrollLeft;
  container.scrollTop = position.scrollTop;
}

function isRenderableSvgReady(container: HTMLElement): boolean {
  const svg = container.querySelector<HTMLElement>("svg");

  if (svg === null) {
    return false;
  }

  const rect = svg.getBoundingClientRect();

  return isFinitePositive(rect.width) && isFinitePositive(rect.height);
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidRect(rect: DiagramNodeRect): boolean {
  return hasFiniteOrigin(rect) && hasFiniteSize(rect);
}

function hasFiniteOrigin(rect: DiagramNodeRect): boolean {
  return Number.isFinite(rect.left) && Number.isFinite(rect.top);
}

function hasFiniteSize(rect: DiagramNodeRect): boolean {
  return isFinitePositive(rect.width) && isFinitePositive(rect.height);
}

function sanitizeFiniteValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function hasStableViewportMetrics(metrics: DiagramViewportMetrics): boolean {
  return isFinitePositive(metrics.viewportWidth) && isFinitePositive(metrics.viewportHeight);
}

function hasStableContentMetrics(metrics: DiagramViewportMetrics): boolean {
  return isFinitePositive(metrics.contentWidth) && isFinitePositive(metrics.contentHeight);
}

function readContentExtent(
  content: HTMLElement,
  axis: "height" | "width"
): number {
  return sanitizeFiniteValue(readStageExtent(content, axis) || readStageClientExtent(content, axis));
}

function readStageExtent(content: HTMLElement, axis: "height" | "width"): number {
  return axis === "height" ? content.scrollHeight : content.scrollWidth;
}

function readStageClientExtent(content: HTMLElement, axis: "height" | "width"): number {
  return axis === "height" ? content.clientHeight : content.clientWidth;
}
