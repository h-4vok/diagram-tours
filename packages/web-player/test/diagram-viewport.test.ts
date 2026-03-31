import { describe, expect, it } from "vitest";

import {
  createOverviewScrollPosition,
  createViewportInstruction,
  focusDiagramViewport
} from "../src/lib/diagram-viewport";
import { createFocusGroup } from "../src/lib/focus-group";

describe("diagram viewport helpers", () => {
  it("computes a bounded scroll target for a single focused node", () => {
    expect(
      createViewportInstruction({
        focusedNodeRects: [createNodeRect({ height: 40, left: 420, top: 250, width: 80 })],
        metrics: createMetrics()
      })
    ).toEqual({
      mode: "focus",
      scrollLeft: 160,
      scrollTop: 118
    });
  });

  it("computes a combined scroll target for multiple focused nodes", () => {
    const forwardInstruction = createViewportInstruction({
      focusedNodeRects: [
        createNodeRect({ height: 40, left: 140, top: 180, width: 80 }),
        createNodeRect({ height: 50, left: 380, top: 260, width: 100 })
      ],
      metrics: createMetrics()
    });
    const reversedInstruction = createViewportInstruction({
      focusedNodeRects: [
        createNodeRect({ height: 50, left: 380, top: 260, width: 100 }),
        createNodeRect({ height: 40, left: 140, top: 180, width: 80 })
      ],
      metrics: createMetrics()
    });

    expect(forwardInstruction).toEqual({
      mode: "focus",
      scrollLeft: 10,
      scrollTop: 93
    });
    expect(reversedInstruction).toEqual(forwardInstruction);
  });

  it("returns a neutral viewport for empty focus and preserves on unstable measurements", () => {
    expect(createViewportInstruction({ focusedNodeRects: [], metrics: createMetrics() })).toEqual({
      mode: "neutral",
      scrollLeft: 0,
      scrollTop: 0
    });

    expect(
      createViewportInstruction({
        focusedNodeRects: [createNodeRect({ height: 40, left: 200, top: 120, width: 0 })],
        metrics: createMetrics()
      })
    ).toEqual({
      mode: "preserve"
    });
  });

  it("creates a centered overview scroll position for zoom-to-fit", () => {
    expect(createOverviewScrollPosition(createMetrics())).toEqual({
      scrollLeft: 160,
      scrollTop: 160
    });

    expect(createOverviewScrollPosition(createMetrics({ contentWidth: 0 }))).toBeNull();
  });

  it("preserves the viewport when focus bounds or metrics are invalid", () => {
    expect(
      createViewportInstruction({
        focusedNodeRects: [createNodeRect({ height: 40, left: Number.NaN, top: 120, width: 40 })],
        metrics: createMetrics()
      })
    ).toEqual({
      mode: "preserve"
    });

    expect(
      createViewportInstruction({
        focusedNodeRects: [createNodeRect({ height: 40, left: 40, top: 40, width: 40 })],
        metrics: createMetrics({ contentHeight: 0 })
      })
    ).toEqual({
      mode: "preserve"
    });
  });

  it("clamps focus targets to the available scroll range", () => {
    expect(
      createViewportInstruction({
        focusedNodeRects: [createNodeRect({ height: 40, left: 10, top: 10, width: 40 })],
        metrics: createMetrics()
      })
    ).toEqual({
      mode: "focus",
      scrollLeft: 0,
      scrollTop: 0
    });

    expect(
      createViewportInstruction({
        focusedNodeRects: [createNodeRect({ height: 80, left: 5000, top: 4000, width: 80 })],
        metrics: createMetrics()
      })
    ).toEqual({
      mode: "focus",
      scrollLeft: 320,
      scrollTop: 320
    });
  });

  it("applies a centered scroll target for a padded content stage", () => {
    const fixture = createViewportFixture();

    setStageMarkup(fixture, '<svg></svg><div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });
    mockNodeRect(fixture, "focus", { height: 80, left: 590, top: 430, width: 100 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 340,
      scrollTop: 318
    });
  });

  it("preserves the current viewport when focus measurements are missing or unstable", () => {
    const fixture = createViewportFixture();

    assignScrollPosition(fixture.container, { scrollLeft: 18, scrollTop: 24 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["missing"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 18,
      scrollTop: 24
    });

    setStageMarkup(fixture, '<svg></svg><div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });
    mockNodeRect(fixture, "focus", { height: 0, left: 200, top: 200, width: 40 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 18,
      scrollTop: 24
    });
  });

  it("does not drift when re-centering the same step repeatedly", () => {
    const fixture = createViewportFixture();

    setStageMarkup(fixture, '<svg></svg><div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });
    mockNodeRect(fixture, "focus", { height: 80, left: 590, top: 430, width: 100 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 340,
      scrollTop: 318
    });
  });

  it("keeps the current viewport when the svg is not ready yet", () => {
    const fixture = createViewportFixture();

    assignScrollPosition(fixture.container, { scrollLeft: 30, scrollTop: 18 });
    setStageMarkup(fixture, '<div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockNodeRect(fixture, "focus", { height: 80, left: 590, top: 430, width: 100 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 30,
      scrollTop: 18
    });
  });

  it("preserves the current viewport when the svg is ready but the focused node is missing", () => {
    const fixture = createViewportFixture();

    assignScrollPosition(fixture.container, { scrollLeft: 30, scrollTop: 18 });
    setStageMarkup(fixture, "<svg></svg>");
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["missing"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 30,
      scrollTop: 18
    });
  });

  it("falls back to zero when previous scroll values are invalid and neutral focus is requested", () => {
    const fixture = createViewportFixture();

    mockInvalidScrollPosition(fixture.container);

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup([])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 0,
      scrollTop: 0
    });
  });

  it("writes scroll positions directly when scrollTo is unavailable", () => {
    const fixture = createViewportFixture();

    disableScrollTo(fixture.container);
    setStageMarkup(fixture, '<svg></svg><div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });
    mockNodeRect(fixture, "focus", { height: 80, left: 590, top: 430, width: 100 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 340,
      scrollTop: 318
    });
  });

  it("returns to the neutral origin only when the target difference is meaningful", () => {
    const fixture = createViewportFixture();

    assignScrollPosition(fixture.container, { scrollLeft: 2, scrollTop: 3 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup([])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 2,
      scrollTop: 3
    });

    assignScrollPosition(fixture.container, { scrollLeft: 20, scrollTop: 24 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup([])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 0,
      scrollTop: 0
    });
  });

  it("clamps computed scroll targets to the available scroll range of the stage", () => {
    const fixture = createViewportFixture({
      contentHeight: 540,
      contentWidth: 660
    });

    setStageMarkup(fixture, '<svg></svg><div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 540, left: 0, top: 0, width: 660 });
    mockElementRect(fixture, "svg", { height: 300, left: 80, top: 80, width: 500 });
    mockNodeRect(fixture, "focus", { height: 60, left: 620, top: 500, width: 80 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 60,
      scrollTop: 140
    });
  });

  it("uses the stage client size when scroll extents are not populated", () => {
    const fixture = createViewportFixture({
      contentClientHeight: 960,
      contentClientWidth: 1180,
      contentHeight: 0,
      contentWidth: 0
    });

    setStageMarkup(fixture, '<svg></svg><div data-node-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });
    mockNodeRect(fixture, "focus", { height: 80, left: 590, top: 430, width: 100 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 340,
      scrollTop: 318
    });
  });

  it("preserves the current viewport when selector helpers cannot find any diagram elements", () => {
    const container = document.createElement("div");
    const content = {
      getBoundingClientRect: () => createDomRect({ height: 960, left: 0, top: 0, width: 1180 })
    } as HTMLElement;
    Object.defineProperty(content, "querySelector", {
      value: () => null,
      writable: true
    });

    Object.defineProperties(container, {
      clientHeight: { value: 400, writable: true },
      clientWidth: { value: 600, writable: true },
      scrollHeight: { value: 960, writable: true },
      scrollLeft: { value: 22, writable: true },
      scrollTop: { value: 18, writable: true },
      scrollWidth: { value: 1180, writable: true }
    });

    focusDiagramViewport({
      container,
      content,
      focusGroup: createFocusGroup(["missing"])
    });

    expect(readScrollPosition(container)).toEqual({
      scrollLeft: 22,
      scrollTop: 18
    });
  });

  it("falls back to querySelector when querySelectorAll is unavailable", () => {
    const fixture = createViewportFixture();

    setStageMarkup(fixture, '<svg></svg><div data-diagram-element-id="focus"></div>');
    mockStageRect(fixture, { height: 960, left: 0, top: 0, width: 1180 });
    mockElementRect(fixture, "svg", { height: 720, left: 130, top: 120, width: 920 });
    mockRect(
      fixture.content.querySelector('[data-diagram-element-id="focus"]') as Element,
      { height: 80, left: 590, top: 430, width: 100 }
    );
    Object.defineProperty(fixture.content, "querySelectorAll", {
      value: undefined,
      writable: true
    });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 340,
      scrollTop: 318
    });

    assignScrollPosition(fixture.container, { scrollLeft: 21, scrollTop: 19 });

    focusDiagramViewport({
      container: fixture.container,
      content: fixture.content,
      focusGroup: createFocusGroup(["missing"])
    });

    expect(readScrollPosition(fixture.container)).toEqual({
      scrollLeft: 21,
      scrollTop: 19
    });
  });
});

function createViewportFixture(input?: {
  contentClientHeight?: number;
  contentClientWidth?: number;
  contentHeight?: number;
  contentWidth?: number;
}): {
  container: HTMLElement;
  content: HTMLElement;
} {
  const container = document.createElement("div");
  const content = document.createElement("div");

  Object.defineProperties(container, {
    clientHeight: { value: 400, writable: true },
    clientWidth: { value: 600, writable: true }
  });
  applyContentDimensions(content, input);

  assignScrollPosition(container, { scrollLeft: 0, scrollTop: 0 });
  container.scrollTo = createScrollToStub(container);
  container.append(content);

  return { container, content };
}

function setStageMarkup(
  fixture: {
    content: HTMLElement;
  },
  markup: string
): void {
  fixture.content.innerHTML = markup;
}

function mockStageRect(
  fixture: {
    content: HTMLElement;
  },
  input: RectInput
): void {
  mockRect(fixture.content, input);
}

function mockElementRect(
  fixture: {
    content: HTMLElement;
  },
  selector: string,
  input: RectInput
): void {
  mockRect(fixture.content.querySelector(selector) as Element, input);
}

function mockNodeRect(
  fixture: {
    content: HTMLElement;
  },
  nodeId: string,
  input: RectInput
): void {
  mockRect(fixture.content.querySelector(`[data-node-id="${nodeId}"]`) as Element, input);
}

function readScrollPosition(container: HTMLElement): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: Number(container.scrollLeft),
    scrollTop: Number(container.scrollTop)
  };
}

function mockInvalidScrollPosition(container: HTMLElement): void {
  Object.defineProperties(container, {
    scrollLeft: { value: Number.NaN, writable: true },
    scrollTop: { value: Number.NaN, writable: true }
  });
}

function createNodeRect(input: RectInput): {
  height: number;
  left: number;
  top: number;
  width: number;
} {
  return input;
}

function mockRect(element: Element, input: RectInput): void {
  element.getBoundingClientRect = () => createDomRect(input);
}

function createDomRect(input: RectInput): DOMRect {
  return {
    bottom: input.top + input.height,
    height: input.height,
    left: input.left,
    right: input.left + input.width,
    top: input.top,
    width: input.width
  } as DOMRect;
}

function createScrollToStub(container: HTMLElement): typeof container.scrollTo {
  return ((options: ScrollToOptions | number, top?: number) => {
    assignScrollPosition(container, toScrollPosition(container, options, top));
  }) as typeof container.scrollTo;
}

function assignScrollPosition(
  container: HTMLElement,
  input: {
    scrollLeft: number;
    scrollTop: number;
  }
): void {
  container.scrollLeft = input.scrollLeft;
  container.scrollTop = input.scrollTop;
}

function disableScrollTo(container: HTMLElement): void {
  Object.defineProperty(container, "scrollTo", {
    value: undefined,
    writable: true
  });
}

function toScrollPosition(
  container: HTMLElement,
  options: ScrollToOptions | number,
  top?: number
): {
  scrollLeft: number;
  scrollTop: number;
} {
  return typeof options === "number"
    ? toNumericScrollPosition(options, top)
    : toObjectScrollPosition(container, options);
}

interface RectInput {
  height: number;
  left: number;
  top: number;
  width: number;
}

function createMetrics(input?: Partial<{
  contentHeight: number;
  contentWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}>): {
  contentHeight: number;
  contentWidth: number;
  viewportHeight: number;
  viewportWidth: number;
} {
  return {
    contentHeight: resolveMetric(input, "contentHeight", 720),
    contentWidth: resolveMetric(input, "contentWidth", 920),
    viewportHeight: resolveMetric(input, "viewportHeight", 400),
    viewportWidth: resolveMetric(input, "viewportWidth", 600)
  };
}

function resolveMetric(
  input: Partial<{
    contentHeight: number;
    contentWidth: number;
    viewportHeight: number;
    viewportWidth: number;
  }> | undefined,
  key: "contentHeight" | "contentWidth" | "viewportHeight" | "viewportWidth",
  fallback: number
): number {
  return input?.[key] ?? fallback;
}

function applyContentDimensions(
  content: HTMLElement,
  input?: {
    contentClientHeight?: number;
    contentClientWidth?: number;
    contentHeight?: number;
    contentWidth?: number;
  }
): void {
  Object.defineProperties(content, {
    clientHeight: { value: resolveContentClientHeight(input), writable: true },
    clientWidth: { value: resolveContentClientWidth(input), writable: true },
    scrollHeight: { value: resolveContentHeight(input), writable: true },
    scrollWidth: { value: resolveContentWidth(input), writable: true }
  });
}

function resolveContentClientHeight(input?: {
  contentClientHeight?: number;
  contentHeight?: number;
}): number {
  return input?.contentClientHeight ?? resolveContentHeight(input);
}

function resolveContentClientWidth(input?: {
  contentClientWidth?: number;
  contentWidth?: number;
}): number {
  return input?.contentClientWidth ?? resolveContentWidth(input);
}

function resolveContentHeight(input?: { contentHeight?: number }): number {
  return input?.contentHeight ?? 960;
}

function resolveContentWidth(input?: { contentWidth?: number }): number {
  return input?.contentWidth ?? 1180;
}

function toNumericScrollPosition(left: number, top?: number): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: left,
    scrollTop: top ?? 0
  };
}

function toObjectScrollPosition(
  container: HTMLElement,
  options: ScrollToOptions
): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: options.left ?? container.scrollLeft,
    scrollTop: options.top ?? container.scrollTop
  };
}
