import type { FocusGroup } from "$lib/focus-group";

const MIN_OFFSET_DELTA = 8;
const MAX_PAN_RATIO = 0.2;
const PAN_X_PROPERTY = "--diagram-pan-x";
const PAN_Y_PROPERTY = "--diagram-pan-y";

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
  const focusedNodeRects = readNodeRects(input.container, input.focusGroup.nodeIds);

  writePanOffset(input.container, {
    offsetX: 0,
    offsetY: 0
  });

  if (shouldPreserveCurrentViewport(input.focusGroup, focusedNodeRects)) {
    writePanOffset(input.container, previousOffset);

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
  return metrics.viewportWidth > 0 && metrics.viewportHeight > 0;
}

function hasStableNodeRects(rects: DiagramNodeRect[]): boolean {
  return rects.every((rect) => rect.width > 0 && rect.height > 0);
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

  return value.length === 0 ? 0 : Number.parseInt(value, 10);
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
