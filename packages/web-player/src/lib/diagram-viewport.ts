import type { FocusGroup } from "$lib/focus-group";

const MIN_OFFSET_DELTA = 8;
const MAX_PAN_RATIO = 0.2;
const PAN_X_PROPERTY = "--diagram-pan-x";
const PAN_Y_PROPERTY = "--diagram-pan-y";
const ZERO_OFFSET = {
  offsetX: 0,
  offsetY: 0
};

export interface DiagramNodeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DiagramViewportMetrics {
  viewportHeight: number;
  viewportWidth: number;
}

export type DiagramViewportInstruction =
  | { mode: "focus"; offsetX: number; offsetY: number }
  | { mode: "neutral"; offsetX: number; offsetY: number }
  | { mode: "preserve" };

export function createViewportInstruction(input: {
  focusedNodeRects: DiagramNodeRect[];
  metrics: DiagramViewportMetrics;
}): DiagramViewportInstruction {
  if (input.focusedNodeRects.length === 0) {
    return {
      mode: "neutral",
      offsetX: 0,
      offsetY: 0
    };
  }

  return createFocusInstruction(input);
}

export function focusDiagramViewport(input: {
  container: HTMLElement;
  focusGroup: FocusGroup;
}): void {
  const previousOffset = readPanOffset(input.container);

  if (shouldPreserveWithoutMeasurement(input)) {
    return;
  }

  const focusedNodeRects = measureNodeRects(input.container, input.focusGroup.nodeIds, previousOffset);

  if (shouldPreserveCurrentViewport(input.focusGroup, focusedNodeRects)) {
    return;
  }

  applyViewportInstruction({
    container: input.container,
    instruction: createViewportInstruction({
      focusedNodeRects,
      metrics: {
        viewportHeight: input.container.clientHeight,
        viewportWidth: input.container.clientWidth
      }
    }),
    previousOffset
  });
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
  const maxOffsetX = Math.round(input.metrics.viewportWidth * MAX_PAN_RATIO);
  const maxOffsetY = Math.round(input.metrics.viewportHeight * MAX_PAN_RATIO);

  return {
    mode: "focus",
    offsetX: clampPanOffset(
      input.metrics.viewportWidth / 2 - (bounds.left + bounds.width / 2),
      maxOffsetX
    ),
    offsetY: clampPanOffset(
      input.metrics.viewportHeight / 2 - (bounds.top + bounds.height / 2),
      maxOffsetY
    )
  };
}

function shouldPreserveWithoutMeasurement(input: {
  container: HTMLElement;
  focusGroup: FocusGroup;
}): boolean {
  return input.focusGroup.mode !== "empty" && !isRenderableSvgReady(input.container);
}

function shouldPreserveCurrentViewport(
  focusGroup: FocusGroup,
  focusedNodeRects: DiagramNodeRect[]
): boolean {
  return focusGroup.mode !== "empty" && focusedNodeRects.length === 0;
}

function applyViewportInstruction(input: {
  container: HTMLElement;
  instruction: DiagramViewportInstruction;
  previousOffset: { offsetX: number; offsetY: number };
}): void {
  const nextOffset = resolveNextOffset(input.instruction, input.previousOffset);

  writePanOffset(input.container, nextOffset);
}

function resolveNextOffset(
  instruction: DiagramViewportInstruction,
  previousOffset: { offsetX: number; offsetY: number }
): { offsetX: number; offsetY: number } {
  if (instruction.mode === "preserve") {
    return previousOffset;
  }

  if (!shouldMoveViewport(previousOffset, instruction)) {
    return previousOffset;
  }

  return instruction;
}

function readNodeRects(container: HTMLElement, focusedNodeIds: string[]): DiagramNodeRect[] {
  const containerRect = container.getBoundingClientRect();

  return focusedNodeIds
    .map((nodeId) => container.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`))
    .flatMap((element) => (element === null ? [] : [toNodeRect(containerRect, element)]));
}

function measureNodeRects(
  container: HTMLElement,
  focusedNodeIds: string[],
  previousOffset: { offsetX: number; offsetY: number }
): DiagramNodeRect[] {
  writePanOffset(container, ZERO_OFFSET);

  try {
    return readNodeRects(container, focusedNodeIds);
  } finally {
    writePanOffset(container, previousOffset);
  }
}

function toNodeRect(containerRect: DOMRect, element: HTMLElement): DiagramNodeRect {
  const elementRect = element.getBoundingClientRect();

  return {
    left: elementRect.left - containerRect.left,
    top: elementRect.top - containerRect.top,
    width: elementRect.width,
    height: elementRect.height
  };
}

function hasStableMetrics(metrics: DiagramViewportMetrics): boolean {
  return isFinitePositive(metrics.viewportWidth) && isFinitePositive(metrics.viewportHeight);
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

function clampPanOffset(offset: number, maxOffset: number): number {
  if (offset < -maxOffset) {
    return -maxOffset;
  }

  if (offset > maxOffset) {
    return maxOffset;
  }

  return Math.round(offset);
}

function readPanOffset(container: HTMLElement): {
  offsetX: number;
  offsetY: number;
} {
  return {
    offsetX: readOffsetValue(container, PAN_X_PROPERTY),
    offsetY: readOffsetValue(container, PAN_Y_PROPERTY)
  };
}

function readOffsetValue(container: HTMLElement, propertyName: string): number {
  const value = container.style.getPropertyValue(propertyName);
  const parsedValue = value.length === 0 ? 0 : Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function shouldMoveViewport(
  previousOffset: { offsetX: number; offsetY: number },
  instruction: Extract<DiagramViewportInstruction, { mode: "focus" | "neutral" }>
): boolean {
  return (
    Math.abs(previousOffset.offsetX - instruction.offsetX) >= MIN_OFFSET_DELTA ||
    Math.abs(previousOffset.offsetY - instruction.offsetY) >= MIN_OFFSET_DELTA
  );
}

function writePanOffset(
  container: HTMLElement,
  offset: {
    offsetX: number;
    offsetY: number;
  }
): void {
  container.style.setProperty(PAN_X_PROPERTY, `${offset.offsetX}px`);
  container.style.setProperty(PAN_Y_PROPERTY, `${offset.offsetY}px`);
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
