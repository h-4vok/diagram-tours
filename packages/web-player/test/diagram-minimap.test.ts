import { describe, expect, it } from "vitest";

import {
  createDiagramMinimapGeometry,
  createMinimapCenterScrollPosition,
  createMinimapViewportScrollPosition,
  readDiagramMinimapConnectors,
  readDiagramMinimapMetrics,
  readDiagramMinimapNodeRects
} from "../src/lib/diagram-minimap";

describe("diagram minimap helpers", () => {
  it("scales the content bounds, viewport rect, and focused nodes into minimap space", () => {
    expect(
      createDiagramMinimapGeometry({
        connectors: [
          {
            arrowhead: { angle: 0, x: 360, y: 300 },
            segments: [{ x1: 270, y1: 300, x2: 360, y2: 300 }]
          }
        ],
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
      connectors: [
        {
          arrowhead: { angle: 0, x: 48, y: 40 },
          segments: [{ x1: 36, y1: 40, x2: 48, y2: 40 }]
        }
      ],
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
        connectors: [],
        nodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        focusedNodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        metrics: createMetrics({ contentWidth: 0 }),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toBeNull();

    expect(
      createDiagramMinimapGeometry({
        connectors: [],
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
        connectors: [
          {
            arrowhead: { angle: 45, x: 1340, y: 1040 },
            segments: [
              { x1: Number.NaN, y1: 260, x2: 300, y2: 260 },
              { x1: 1160, y1: 900, x2: 1340, y2: 1040 }
            ]
          }
        ],
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
      connectors: [
        {
          arrowhead: { angle: 45, x: 178.67, y: 138.67 },
          segments: [{ x1: 154.67, y1: 120, x2: 178.67, y2: 138.67 }]
        }
      ],
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
        connectors: [
          {
            arrowhead: { angle: 180, x: 40, y: 20 },
            segments: [
              { x1: -40, y1: -20, x2: -10, y2: -5 },
              { x1: 1300, y1: 1100, x2: 5000, y2: 1900 }
            ]
          }
        ],
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
      connectors: [
        {
          arrowhead: { angle: 180, x: 5.33, y: 2.67 },
          segments: [{ x1: 173.33, y1: 146.67, x2: 197.33, y2: 160 }]
        }
      ],
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

    mockConnector(fixture, ".flowchart-link", createPathConnectorStub([
      { x: 420, y: 300 },
      { x: 600, y: 300 },
      { x: 640, y: 360 }
    ]));

    expect(
      readDiagramMinimapConnectors({
        content: fixture.content
      })
    ).toEqual([
      expect.objectContaining({
        arrowhead: { angle: 56.31, x: 640, y: 360 },
        segments: expect.arrayContaining([
          expect.objectContaining({ x1: 420, y1: 300 }),
          expect.objectContaining({ x2: 640, y2: 360 })
        ])
      })
    ]);
  });

  it("defaults connector geometry to an empty list when connectors are omitted", () => {
    expect(
      createDiagramMinimapGeometry({
        nodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        focusedNodeRects: [],
        metrics: createMetrics(),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      bounds: { height: 160, left: 0, top: 0, width: 197.33 },
      connectors: [],
      nodeRects: [{ height: 10.67, left: 56, top: 34.67, width: 16 }],
      focusRects: [],
      viewportRect: { height: 53.33, left: 20, top: 12, width: 80 }
    });
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

  it("falls back to a connector-free minimap when connector geometry is unavailable", () => {
    const fixture = createFixture();

    mockConnector(
      fixture,
      ".flowchart-link",
      {
        dataset: {},
        ownerSVGElement: readSvg(fixture.content)
      } as unknown as Element
    );

    expect(
      readDiagramMinimapConnectors({
        content: fixture.content
      })
    ).toEqual([]);
  });

  it("filters duplicate, auxiliary, and zero-length sampled connectors", () => {
    const fixture = createFixture();
    const validConnector = createPathConnectorStub([
      { x: 120, y: 80 },
      { x: 220, y: 80 }
    ]);
    const auxiliaryConnector = createPathConnectorStub([
      { x: 200, y: 120 },
      { x: 260, y: 120 }
    ]) as Element & { dataset: Record<string, string> };
    const zeroLengthConnector = {
      dataset: {},
      getPointAtLength() {
        return { x: 0, y: 0 };
      },
      getTotalLength() {
        return 0;
      },
      ownerSVGElement: readSvg(fixture.content)
    } as unknown as Element;

    auxiliaryConnector.dataset.diagramElementAuxiliary = "true";
    readConnectorMap(fixture.content).set(".flowchart-link", [
      validConnector,
      validConnector,
      auxiliaryConnector,
      zeroLengthConnector
    ]);

    expect(
      readDiagramMinimapConnectors({
        content: fixture.content
      })
    ).toEqual([
      {
        arrowhead: { angle: 0, x: 220, y: 80 },
        segments: expect.arrayContaining([{ x1: 160, y1: 80, x2: 180, y2: 80 }])
      }
    ]);
  });

  it("drops collapsed connectors and preserves null arrowheads when scaling minimap geometry", () => {
    expect(
      createDiagramMinimapGeometry({
        connectors: [
          {
            arrowhead: null,
            segments: [{ x1: 40, y1: 60, x2: 180, y2: 60 }]
          },
          {
            arrowhead: null,
            segments: [{ x1: 25, y1: 25, x2: 25, y2: 25 }]
          }
        ],
        nodeRects: [{ height: 80, left: 420, top: 260, width: 120 }],
        focusedNodeRects: [],
        metrics: createMetrics(),
        minimapSize: { maxHeight: 160, maxWidth: 220 }
      })
    ).toEqual({
      bounds: { height: 160, left: 0, top: 0, width: 197.33 },
      connectors: [
        {
          arrowhead: null,
          segments: [{ x1: 5.33, y1: 8, x2: 24, y2: 8 }]
        }
      ],
      nodeRects: [{ height: 10.67, left: 56, top: 34.67, width: 16 }],
      focusRects: [],
      viewportRect: { height: 53.33, left: 20, top: 12, width: 80 }
    });
  });

  it("reads straight SVG line connectors when line geometry is available", () => {
    const OriginalSvgLineElement = globalThis.SVGLineElement;
    class FakeSvgLineElement {}

    globalThis.SVGLineElement = FakeSvgLineElement as unknown as typeof SVGLineElement;

    try {
      const fixture = createFixture();
      const connector = Object.assign(new FakeSvgLineElement(), {
        dataset: {},
        ownerSVGElement: readSvg(fixture.content),
        x1: { baseVal: { value: 120 } },
        x2: { baseVal: { value: 260 } },
        y1: { baseVal: { value: 80 } },
        y2: { baseVal: { value: 80 } }
      }) as unknown as Element;

      mockConnector(fixture, ".flowchart-link", connector);

      expect(
        readDiagramMinimapConnectors({
          content: fixture.content
        })
      ).toEqual([
        {
          arrowhead: { angle: 0, x: 300, y: 110 },
          segments: [{ x1: 160, y1: 110, x2: 300, y2: 110 }]
        }
      ]);
    } finally {
      globalThis.SVGLineElement = OriginalSvgLineElement;
    }
  });

  it("reads polyline connectors without svg origin metadata", () => {
    const OriginalSvgPolylineElement = globalThis.SVGPolylineElement;
    class FakeSvgPolylineElement {}

    globalThis.SVGPolylineElement = FakeSvgPolylineElement as unknown as typeof SVGPolylineElement;

    try {
      const fixture = createFixture();
      const connector = Object.assign(new FakeSvgPolylineElement(), {
        dataset: {},
        points: [{ x: 12, y: 18 }, { x: 42, y: 18 }, { x: 42, y: 54 }]
      }) as unknown as Element;

      readConnectorMap(fixture.content).set(".flowchart-link", [connector]);

      expect(
        readDiagramMinimapConnectors({
          content: fixture.content
        })
      ).toEqual([
        {
          arrowhead: { angle: 90, x: 42, y: 54 },
          segments: [
            { x1: 12, y1: 18, x2: 42, y2: 18 },
            { x1: 42, y1: 18, x2: 42, y2: 54 }
          ]
        }
      ]);
    } finally {
      globalThis.SVGPolylineElement = OriginalSvgPolylineElement;
    }
  });

  it("drops invalid polyline points before building connector segments", () => {
    const OriginalSvgPolylineElement = globalThis.SVGPolylineElement;
    class FakeSvgPolylineElement {}

    globalThis.SVGPolylineElement = FakeSvgPolylineElement as unknown as typeof SVGPolylineElement;

    try {
      const fixture = createFixture();
      const connector = Object.assign(new FakeSvgPolylineElement(), {
        dataset: {},
        points: [{ x: 12, y: 18 }, { x: Number.NaN, y: 18 }, { x: 42, y: 54 }]
      }) as unknown as Element;

      readConnectorMap(fixture.content).set(".flowchart-link", [connector]);

      expect(
        readDiagramMinimapConnectors({
          content: fixture.content
        })
      ).toEqual([]);
    } finally {
      globalThis.SVGPolylineElement = OriginalSvgPolylineElement;
    }
  });

  it("ignores connector elements with partial sampled geometry APIs", () => {
    const fixture = createFixture();

    readConnectorMap(fixture.content).set(".flowchart-link", [
      {
        dataset: {},
        getTotalLength() {
          return 48;
        }
      } as unknown as Element,
      {
        dataset: {},
        getPointAtLength() {
          return { x: 24, y: 24 };
        }
      } as unknown as Element
    ]);

    expect(
      readDiagramMinimapConnectors({
        content: fixture.content
      })
    ).toEqual([]);
  });

  it("returns an empty connector list when line and polyline globals are defined but the element matches neither", () => {
    const OriginalSvgLineElement = globalThis.SVGLineElement;
    const OriginalSvgPolylineElement = globalThis.SVGPolylineElement;
    class FakeSvgLineElement {}
    class FakeSvgPolylineElement {}

    globalThis.SVGLineElement = FakeSvgLineElement as unknown as typeof SVGLineElement;
    globalThis.SVGPolylineElement = FakeSvgPolylineElement as unknown as typeof SVGPolylineElement;

    try {
      const fixture = createFixture();

      mockConnector(
        fixture,
        ".flowchart-link",
        {
          dataset: {},
          ownerSVGElement: readSvg(fixture.content)
        } as unknown as Element
      );

      expect(
        readDiagramMinimapConnectors({
          content: fixture.content
        })
      ).toEqual([]);
    } finally {
      globalThis.SVGLineElement = OriginalSvgLineElement;
      globalThis.SVGPolylineElement = OriginalSvgPolylineElement;
    }
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
  const connectorMap = new Map<string, Element[]>();
  const svg = createElementStub({
    rect: { height: 1200, left: 40, top: 30, width: 1480 }
  }) as unknown as SVGSVGElement;
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
  Object.defineProperty(content, "querySelectorAll", {
    value: (selector: string) => connectorMap.get(selector) ?? readMappedNodes(nodeMap, selector),
    writable: true
  });
  Object.assign(content, { __connectorMap: connectorMap, __nodeMap: nodeMap, __svg: svg });

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

function mockConnector(
  fixture: {
    content: HTMLElement;
  },
  selector: string,
  element: Element
): void {
  Object.assign(element, { ownerSVGElement: readSvg(fixture.content) });
  readConnectorMap(fixture.content).set(selector, [element]);
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

function readConnectorMap(content: HTMLElement): Map<string, Element[]> {
  return (content as HTMLElement & { __connectorMap: Map<string, Element[]> }).__connectorMap;
}

function readSvg(content: HTMLElement): SVGSVGElement {
  return (content as HTMLElement & { __svg: SVGSVGElement }).__svg;
}

function readMappedNode(nodeMap: Map<string, Element>, selector: string): Element | null {
  return nodeMap.get(selector) ?? nodeMap.get(extractNodeSelector(selector)) ?? null;
}

function readMappedNodes(nodeMap: Map<string, Element>, selector: string): Element[] {
  return selector
    .split(",")
    .map((value) => value.trim())
    .flatMap((entry) => {
      const element = readMappedNode(nodeMap, entry);

      return element === null ? [] : [element];
    });
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

function createPathConnectorStub(points: Array<{ x: number; y: number }>): Element {
  const distances = points.slice(1).reduce<number[]>((accumulator, point, index) => {
    const previousPoint = points[index];
    const previousDistance = accumulator.at(-1) ?? 0;
    const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);

    return [...accumulator, previousDistance + distance];
  }, [0]);
  const totalLength = distances.at(-1) ?? 0;

  return {
    dataset: {},
    getPointAtLength(distance: number) {
      return readConnectorPointAtDistance({ distance, distances, points, totalLength });
    },
    getTotalLength() {
      return totalLength;
    }
  } as unknown as Element;
}

function readConnectorPointAtDistance(input: {
  distance: number;
  distances: number[];
  points: Array<{ x: number; y: number }>;
  totalLength: number;
}): { x: number; y: number } {
  if (input.distance <= 0) {
    return input.points[0];
  }

  if (input.distance >= input.totalLength) {
    return input.points.at(-1) as { x: number; y: number };
  }

  return interpolateConnectorPoint(input.points, input.distances, input.distance);
}

function interpolateConnectorPoint(
  points: Array<{ x: number; y: number }>,
  distances: number[],
  distance: number
): { x: number; y: number } {
  const segmentIndex = distances.findIndex((value) => value >= distance) - 1;
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const offset = distance - distances[segmentIndex];
  const segmentLength = distances[segmentIndex + 1] - distances[segmentIndex];
  const ratio = segmentLength === 0 ? 0 : offset / segmentLength;

  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  };
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
