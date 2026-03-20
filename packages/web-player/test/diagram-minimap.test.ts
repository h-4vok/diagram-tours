import { describe, expect, it } from "vitest";

import {
  createDiagramMinimapGeometry,
  createMinimapCenterScrollPosition,
  createMinimapViewportScrollPosition,
  readDiagramMinimapMetrics,
  readDiagramMinimapNodeRects
} from "../src/lib/diagram-minimap";

describe("diagram minimap helpers", () => {
  it("scales the content bounds, viewport rect, and focused nodes into minimap space", () => {
    expect(
      createDiagramMinimapGeometry({
        nodeRects: [
          { height: 70, left: 180, top: 260, width: 90 },
          { height: 80, left: 420, top: 260, width: 120 }
        ],
        focusedNodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        metrics: createMetrics(),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      bounds: { height: 160, left: 0, top: 0, width: 197.33 },
      nodeRects: [
        { height: 9.33, left: 24, top: 34.67, width: 12 },
        { height: 10.67, left: 56, top: 34.67, width: 16 }
      ],
      focusRects: [{ height: 10.67, left: 56, top: 34.67, width: 16 }],
      viewportRect: { height: 53.33, left: 20, top: 12, width: 80 }
    });
  });

  it("returns null when metrics or minimap size are not stable", () => {
    expect(
      createDiagramMinimapGeometry({
        nodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        focusedNodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        metrics: createMetrics({ contentWidth: 0 }),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toBeNull();

    expect(
      createDiagramMinimapGeometry({
        nodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        focusedNodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        metrics: createMetrics(),
        minimapSize: { maxHeight: 0, maxWidth: 220 }
      })
    ).toBeNull();
  });

  it("ignores invalid focused rects and clamps oversized viewport positions", () => {
    expect(
      createDiagramMinimapGeometry({
        nodeRects: [{ height: 80, left: 320, top: 260, width: 120 }],
        focusedNodeRects: [
          { height: 80, left: Number.NaN, top: 260, width: 120 },
          { height: 200, left: 1100, top: 800, width: 240 }
        ],
        metrics: createMetrics({ scrollLeft: 2000, scrollTop: 1400 }),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      bounds: { height: 160, left: 0, top: 0, width: 197.33 },
      nodeRects: [{ height: 10.67, left: 42.67, top: 34.67, width: 16 }],
      focusRects: [{ height: 26.67, left: 146.67, top: 106.67, width: 32 }],
      viewportRect: { height: 53.33, left: 117.33, top: 106.67, width: 80 }
    });
  });

  it("maps minimap clicks to centered and clamped diagram scroll positions", () => {
    expect(
      createMinimapCenterScrollPosition({
        metrics: createMetrics(),
        minimapPoint: { x: 98.67, y: 80 },
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      scrollLeft: 440,
      scrollTop: 400
    });

    expect(
      createMinimapCenterScrollPosition({
        metrics: createMetrics(),
        minimapPoint: { x: 999, y: 999 },
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      scrollLeft: 880,
      scrollTop: 800
    });

    expect(
      createMinimapCenterScrollPosition({
        metrics: createMetrics(),
        minimapPoint: { x: -20, y: -10 },
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      scrollLeft: 0,
      scrollTop: 0
    });

    expect(
      createMinimapCenterScrollPosition({
        metrics: createMetrics({ viewportHeight: 0 }),
        minimapPoint: { x: 98.67, y: 80 },
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toBeNull();
  });

  it("maps dragged viewport origins back into content-space scroll positions", () => {
    expect(
      createMinimapViewportScrollPosition({
        metrics: createMetrics(),
        minimapSize: { maxHeight: 160, maxWidth: 220 },
        viewportOrigin: { x: 60, y: 40 }
      })
    ).toEqual({
      scrollLeft: 450,
      scrollTop: 300
    });

    expect(
      createMinimapViewportScrollPosition({
        metrics: createMetrics(),
        minimapSize: { maxHeight: 160, maxWidth: 220 },
        viewportOrigin: { x: 400, y: 400 }
      })
    ).toEqual({
      scrollLeft: 880,
      scrollTop: 800
    });

    expect(
      createMinimapViewportScrollPosition({
        metrics: createMetrics({ contentHeight: 0 }),
        minimapSize: { maxHeight: 160, maxWidth: 220 },
        viewportOrigin: { x: 40, y: 30 }
      })
    ).toBeNull();
  });

  it("clamps negative and oversized minimap rects inside the minimap bounds", () => {
    expect(
      createDiagramMinimapGeometry({
        nodeRects: [
          { height: 50, left: -40, top: -20, width: -10 },
          { height: 1600, left: 1300, top: 1100, width: 4000 }
        ],
        focusedNodeRects: [
          { height: 50, left: -40, top: -20, width: -10 },
          { height: 1600, left: 1300, top: 1100, width: 4000 }
        ],
        metrics: createMetrics({ scrollLeft: -100, scrollTop: -120 }),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      bounds: { height: 160, left: 0, top: 0, width: 197.33 },
      nodeRects: [{ height: 160, left: 0, top: 0, width: 197.33 }],
      focusRects: [{ height: 160, left: 0, top: 0, width: 197.33 }],
      viewportRect: { height: 53.33, left: 0, top: 0, width: 80 }
    });
  });

  it("reads content metrics and focused node rects from the rendered stage", () => {
    const fixture = createFixture();

    setStageMarkup(
      fixture,
      '<div data-node-id="api_gateway"></div><div data-node-id="validation_service"></div>'
    );
    mockRect(fixture.content, { height: 1200, left: 40, top: 30, width: 1480 });
    mockNodeRect(fixture, "api_gateway", { height: 90, left: 420, top: 300, width: 120 });
    mockNodeRect(fixture, "validation_service", { height: 80, left: 640, top: 420, width: 140 });

    expect(
      readDiagramMinimapMetrics({
        container: fixture.container,
        content: fixture.content
      })
    ).toEqual({
      contentHeight: 1200,
      contentWidth: 1480,
      scrollLeft: 150,
      scrollTop: 90,
      viewportHeight: 400,
      viewportWidth: 600
    });

    expect(
      readDiagramMinimapNodeRects({
        content: fixture.content,
        focusedNodeIds: ["api_gateway", "validation_service", "missing"]
      })
    ).toEqual([
      { height: 90, left: 380, top: 270, width: 120 },
      { height: 80, left: 600, top: 390, width: 140 }
    ]);
  });

  it("falls back to client extents and sanitizes invalid scroll numbers when reading metrics", () => {
    const fixture = createFixture({
      clientHeight: 980,
      clientWidth: 1500,
      scrollHeight: 0,
      scrollLeft: Number.NaN,
      scrollTop: Number.NaN,
      scrollWidth: 0
    });

    expect(
      readDiagramMinimapMetrics({
        container: fixture.container,
        content: fixture.content
      })
    ).toEqual({
      contentHeight: 980,
      contentWidth: 1500,
      scrollLeft: 0,
      scrollTop: 0,
      viewportHeight: 400,
      viewportWidth: 600
    });
  });

  it("reads focused rects from the legacy focusedElementIds path and tolerates content without selectors", () => {
    const element = createElementStub();
    mockRect(element, { height: 60, left: 200, top: 120, width: 80 });

    const content = {
      getBoundingClientRect: () => createDomRect({ height: 600, left: 20, top: 10, width: 800 }),
      querySelector: (selector: string) => readLegacyElement(selector, element)
    } as unknown as HTMLElement;

    expect(
      readDiagramMinimapNodeRects({
        content,
        focusedElementIds: ["api_gateway"]
      })
    ).toEqual([{ height: 60, left: 180, top: 110, width: 80 }]);

    expect(
      readDiagramMinimapNodeRects({
        content: {
          getBoundingClientRect: () => createDomRect({ height: 0, left: 0, top: 0, width: 0 }),
          querySelector: () => null
        } as unknown as HTMLElement,
        focusedElementIds: ["missing"]
      })
    ).toEqual([]);

    expect(
      readDiagramMinimapNodeRects({
        content,
        focusedNodeIds: undefined
      })
    ).toEqual([]);
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
  }>
): {
  contentHeight: number;
  contentWidth: number;
  scrollLeft: number;
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
} {
  return {
    contentHeight: readMetric(input, "contentHeight", 1200),
    contentWidth: readMetric(input, "contentWidth", 1480),
    scrollLeft: readMetric(input, "scrollLeft", 150),
    scrollTop: readMetric(input, "scrollTop", 90),
    viewportHeight: readMetric(input, "viewportHeight", 400),
    viewportWidth: readMetric(input, "viewportWidth", 600)
  };
}

function createFixture(input?: {
  clientHeight?: number;
  clientWidth?: number;
  scrollHeight?: number;
  scrollLeft?: number;
  scrollTop?: number;
  scrollWidth?: number;
}): {
  container: HTMLElement;
  content: HTMLElement;
} {
  const nodeMap = new Map<string, Element>();
  const content = createElementStub({
    clientHeight: readFixtureValue(input, "clientHeight", 1200),
    clientWidth: readFixtureValue(input, "clientWidth", 1480),
    rect: { height: 1200, left: 0, top: 0, width: 1480 },
    scrollHeight: readFixtureValue(input, "scrollHeight", 1200),
    scrollWidth: readFixtureValue(input, "scrollWidth", 1480)
  });
  const container = createElementStub({
    clientHeight: 400,
    clientWidth: 600,
    rect: { height: 400, left: 0, top: 0, width: 600 },
    scrollHeight: 400,
    scrollLeft: readFixtureValue(input, "scrollLeft", 150),
    scrollTop: readFixtureValue(input, "scrollTop", 90),
    scrollWidth: 600
  });

  Object.defineProperty(content, "querySelector", {
    value: (selector: string) => readMappedNode(nodeMap, selector),
    writable: true
  });
  Object.assign(content, { __nodeMap: nodeMap });

  return {
    container: container as HTMLElement,
    content: content as HTMLElement
  };
}

function setStageMarkup(
  fixture: {
    content: HTMLElement;
  },
  markup: string
): void {
  const nodeMap = readNodeMap(fixture.content);
  const matches = [...markup.matchAll(/data-node-id="([^"]+)"/g)];

  nodeMap.clear();
  matches.forEach((match) => {
    nodeMap.set(`[data-node-id="${match[1]}"]`, createElementStub());
  });
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

function mockRect(element: Element, input: RectInput): void {
  element.getBoundingClientRect = () => createDomRect(input);
}

function createElementStub(input?: {
  clientHeight?: number;
  clientWidth?: number;
  rect?: RectInput;
  scrollHeight?: number;
  scrollLeft?: number;
  scrollTop?: number;
  scrollWidth?: number;
}): Element {
  return {
    clientHeight: readElementStubValue(input, "clientHeight", 0),
    clientWidth: readElementStubValue(input, "clientWidth", 0),
    getBoundingClientRect: () => createDomRect(readElementRect(input)),
    querySelector: () => null,
    scrollHeight: readElementStubValue(input, "scrollHeight", 0),
    scrollLeft: readElementStubValue(input, "scrollLeft", 0),
    scrollTop: readElementStubValue(input, "scrollTop", 0),
    scrollWidth: readElementStubValue(input, "scrollWidth", 0)
  } as unknown as Element;
}

function readNodeMap(content: HTMLElement): Map<string, Element> {
  return (content as HTMLElement & { __nodeMap: Map<string, Element> }).__nodeMap;
}

function readMappedNode(nodeMap: Map<string, Element>, selector: string): Element | null {
  return nodeMap.get(selector) ?? nodeMap.get(extractNodeSelector(selector)) ?? null;
}

function extractNodeSelector(selector: string): string {
  const nodeId = selector.match(/data-node-id="([^"]+)"/u)?.[1];

  return nodeId === undefined ? selector : `[data-node-id="${nodeId}"]`;
}

function readLegacyElement(selector: string, element: Element): Element | null {
  return selector.includes('data-diagram-element-id="api_gateway"') ? element : null;
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

interface RectInput {
  height: number;
  left: number;
  top: number;
  width: number;
}

function readMetric(
  input: Partial<{
    contentHeight: number;
    contentWidth: number;
    scrollLeft: number;
    scrollTop: number;
    viewportHeight: number;
    viewportWidth: number;
  }> | undefined,
  key: "contentHeight" | "contentWidth" | "scrollLeft" | "scrollTop" | "viewportHeight" | "viewportWidth",
  fallback: number
): number {
  return input?.[key] ?? fallback;
}

function readFixtureValue(
  input:
    | {
        clientHeight?: number;
        clientWidth?: number;
        scrollHeight?: number;
        scrollLeft?: number;
        scrollTop?: number;
        scrollWidth?: number;
      }
    | undefined,
  key: "clientHeight" | "clientWidth" | "scrollHeight" | "scrollLeft" | "scrollTop" | "scrollWidth",
  fallback: number
): number {
  return input?.[key] ?? fallback;
}

function readElementStubValue(
  input:
    | {
        clientHeight?: number;
        clientWidth?: number;
        rect?: RectInput;
        scrollHeight?: number;
        scrollLeft?: number;
        scrollTop?: number;
        scrollWidth?: number;
      }
    | undefined,
  key: "clientHeight" | "clientWidth" | "scrollHeight" | "scrollLeft" | "scrollTop" | "scrollWidth",
  fallback: number
): number {
  return input?.[key] ?? fallback;
}

function readElementRect(
  input:
    | {
        rect?: RectInput;
      }
    | undefined
): RectInput {
  return input?.rect ?? { height: 0, left: 0, top: 0, width: 0 };
}
