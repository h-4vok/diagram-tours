import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyFocusState,
  createRenderableDiagramSource,
  getMermaidErrorMessage,
  renderMermaidDiagram
} from "../src/lib/mermaid-diagram";
import { createFocusGroup } from "../src/lib/focus-group";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const { mermaidInitialize, mermaidRender } = vi.hoisted(() => ({
  mermaidInitialize: vi.fn(),
  mermaidRender: vi.fn(async () => ({
    svg: [
      '<svg width="100%" style="max-width: 1440px;" viewBox="0 0 1440 960">',
      '<g class="diagram_tour_node_api_gateway"></g>',
      '<g class="diagram_tour_node_validation_service"></g>',
      '<g class="diagram_tour_node_payment_service"></g>',
      '<g class="edgeLabel"><foreignObject><div>Yes</div></foreignObject></g>',
      "</svg>"
    ].join("")
  }))
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender
  }
}));

describe("mermaid diagram helpers", () => {
  beforeEach(() => {
    mermaidInitialize.mockClear();
    mermaidRender.mockClear();
    clearThemeTokens();
  });

  it("adds app-owned node classes to the Mermaid source", () => {
    const source = createRenderableDiagramSource(resolvedPaymentFlowTour.diagram);

    expect(source).toContain("class api_gateway diagram_tour_node_api_gateway;");
    expect(source).toContain(
      "class validation_service diagram_tour_node_validation_service;"
    );
  });

  it("keeps sequence-diagram source unchanged", () => {
    const source = createRenderableDiagramSource({
      elements: [
        { id: "user", kind: "participant", label: "User" },
        { id: "request_sent", kind: "message", label: "Send request" }
      ],
      path: "./sequence.mmd",
      source: "sequenceDiagram\n  participant user as User\n  user->>user: Send request",
      type: "sequence"
    });

    expect(source).toBe("sequenceDiagram\n  participant user as User\n  user->>user: Send request");
  });

  it("renders the diagram and tags nodes with stable app-owned hooks", async () => {
    const container = document.createElement("div");
    document.documentElement.style.setProperty("--bg-base", "#101820");
    document.documentElement.style.setProperty("--bg-surface", "#16202a");
    document.documentElement.style.setProperty("--text-primary", "#eef4ff");
    document.documentElement.style.setProperty("--border-subtle", "#2a3440");
    document.documentElement.style.setProperty("--color-node-base-fill", "#18212c");
    document.documentElement.style.setProperty("--color-node-base-stroke", "#324152");
    document.documentElement.style.setProperty("--color-node-base-text", "#eef4ff");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: "base",
        themeVariables: expect.objectContaining({
          background: "#101820",
          fontFamily: "Geist, Inter, Segoe UI, system-ui, sans-serif",
          lineColor: "#324152",
          mainBkg: "#18212c",
          primaryTextColor: "#eef4ff",
          secondaryColor: "#16202a",
          textColor: "#eef4ff"
        })
      })
    );
    expect(mermaidRender).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-node-id="api_gateway"]')).not.toBeNull();
    expect(container.querySelector('[data-node-label="API Gateway"]')).not.toBeNull();
    expect(container.querySelector('[data-connector-role="label"]')).not.toBeNull();
    expect(container.querySelector("#diagram-tour-node-focus-gradient")).not.toBeNull();
    expect(container.querySelector("#diagram-tour-node-hover-gradient")).not.toBeNull();
    expectSvgState(container, {
      height: "960",
      intrinsicHeight: "960",
      intrinsicWidth: "1440",
      maxWidth: "",
      width: "1440"
    });
  });

  it("falls back to Mermaid theme defaults when CSS tokens are missing", async () => {
    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          background: "#0e1116",
          lineColor: "#30363d",
          mainBkg: "#1c2128",
          primaryTextColor: "#e6edf3"
        })
      })
    );
  });

  it("keeps Mermaid sizing untouched when the rendered svg has no viewBox", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: '<svg width="100%" style="max-width: 720px;"><g class="diagram_tour_node_api_gateway"></g></svg>'
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expectSvgState(container, {
      height: null,
      intrinsicHeight: undefined,
      intrinsicWidth: undefined,
      maxWidth: "720px",
      width: "100%"
    });
  });

  it("reuses existing svg defs and gradients when Mermaid already provides them", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 720px;" viewBox="0 0 720 480">',
        "<defs>",
        '<linearGradient id="diagram-tour-node-focus-gradient"></linearGradient>',
        '<linearGradient id="diagram-tour-node-hover-gradient"></linearGradient>',
        "</defs>",
        '<g class="diagram_tour_node_api_gateway"></g>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expect(container.querySelectorAll("#diagram-tour-node-focus-gradient")).toHaveLength(1);
    expect(container.querySelectorAll("#diagram-tour-node-hover-gradient")).toHaveLength(1);
  });

  it("tolerates Mermaid output that does not contain an svg root", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: '<div class="diagram_tour_node_api_gateway"></div>'
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector('[data-node-id="api_gateway"]')).not.toBeNull();
  });

  it("skips svg normalization when Mermaid returns an invalid viewBox", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 720px;" viewBox="0 0 NaN 960">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expectSvgState(container, {
      height: null,
      intrinsicHeight: undefined,
      intrinsicWidth: undefined,
      maxWidth: "720px",
      width: "100%"
    });
  });

  it("skips svg normalization when Mermaid returns a malformed viewBox", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 720px;" viewBox="0 0 720">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expectSvgState(container, {
      height: null,
      intrinsicHeight: undefined,
      intrinsicWidth: undefined,
      maxWidth: "720px",
      width: "100%"
    });
  });

  it("skips svg normalization when the viewBox height is not positive", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 720px;" viewBox="0 0 720 0">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

    expectSvgState(container, {
      height: null,
      intrinsicHeight: undefined,
      intrinsicWidth: undefined,
      maxWidth: "720px",
      width: "100%"
    });
  });

  it("throws a clear error when Mermaid rendering fails", async () => {
    mermaidRender.mockRejectedValueOnce(new Error("parse failure"));

    await expect(
      renderMermaidDiagram({
        container: document.createElement("div"),
        diagram: resolvedPaymentFlowTour.diagram
      })
    ).rejects.toThrow(getMermaidErrorMessage());
  });

  it("marks focused and dimmed nodes, and clears state when focus is empty", () => {
    const container = document.createElement("div");

    container.innerHTML = [
      "<div></div>",
      '<div data-node-id="api_gateway"></div>',
      '<div data-node-id="validation_service"></div>',
      '<div data-node-id="payment_service"></div>',
      '<path data-connector-role="flow" data-connector-source-id="api_gateway" data-connector-target-id="payment_service"></path>',
      '<path data-connector-role="flow" data-connector-source-id="validation_service" data-connector-target-id="payment_service"></path>',
      '<div class="edgeLabel" data-connector-role="label"><div>Yes</div></div>'
    ].join("");

    applyFocusState({
      container,
      focusGroup: createFocusGroup(["payment_service", "api_gateway", "payment_service"])
    });

    expect(readFocusState(container, "api_gateway")).toBe("focused");
    expect(readFocusState(container, "validation_service")).toBe("dimmed");
    expect(readFocusState(container, "payment_service")).toBe("focused");
    expect(container.dataset.focusGroupMode).toBe("group");
    expect(container.dataset.focusGroupSize).toBe("2");
    expect(container.querySelectorAll('[data-connector-state="context"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-connector-role="flow"][data-connector-state="active"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-connector-role="flow"][data-connector-state="context"]')).toHaveLength(1);

    applyFocusState({
      container,
      focusGroup: createFocusGroup([])
    });

    expect(hasFocusState(container, "api_gateway")).toBe(false);
    expect(hasFocusState(container, "validation_service")).toBe(false);
    expect(container.hasAttribute("data-focus-group-mode")).toBe(false);
    expect(container.hasAttribute("data-focus-group-size")).toBe(false);
    expect(container.querySelector('[data-connector-state="context"]')).toBeNull();
    expect(container.querySelector('[data-connector-role="flow"]')?.hasAttribute("data-connector-state")).toBe(
      false
    );
  });

  it("annotates untagged flowchart connectors during focus application", async () => {
    const container = document.createElement("div");

    container.innerHTML = [
      '<svg viewBox="0 0 960 640">',
      '<g class="diagram_tour_node_api_gateway" data-diagram-element-id="api_gateway" data-diagram-element-kind="node"></g>',
      '<g class="diagram_tour_node_validation_service" data-diagram-element-id="validation_service" data-diagram-element-kind="node"></g>',
      '<path class="flowchart-link"></path>',
      "</svg>"
    ].join("");

    await withFlowchartGeometryMocks(async () => {
      applyFocusState({
        container,
        focusGroup: createFocusGroup(["api_gateway", "validation_service"])
      });
    });

    expect(container.querySelector('[data-connector-role="flow"]')).not.toBeNull();
    expect(container.querySelector('[data-connector-state="active"]')).not.toBeNull();
  });

  it("annotates direct flowchart connectors and cloned markers with source and target ids", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        "<defs>",
        '<marker id="flow-arrow"><path d="M0 0 L10 5 L0 10 z"></path></marker>',
        "</defs>",
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<path class="flowchart-link" marker-end="url(#flow-arrow)"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartGeometryMocks(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
      expectAnnotatedFlowchartConnector(container);
    });
  });

  it("annotates flowchart connectors from encoded Mermaid edge ids", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_payment_service"></g>',
        '<g class="diagram_tour_node_payment_provider"></g>',
        '<path class="flowchart-link" data-id="L_payment_service_payment_provider_0"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    const connector = readRequiredElement(container, ".flowchart-link");

    expect(readRequiredAttribute(connector, "data-connector-source-id")).toBe("payment_service");
    expect(readRequiredAttribute(connector, "data-connector-target-id")).toBe("payment_provider");
  });

  it("annotates flowchart connectors from Mermaid source and target classes", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<path class="flowchart-link LS-api_gateway LE-validation_service"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    const connector = readRequiredElement(container, ".flowchart-link");

    expect(readRequiredAttribute(connector, "data-connector-source-id")).toBe("api_gateway");
    expect(readRequiredAttribute(connector, "data-connector-target-id")).toBe("validation_service");
  });

  it("annotates straight SVG line connectors from geometry when sampled paths are unavailable", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<line class="flowchart-link" x1="180" y1="100" x2="280" y2="100"></line>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    const connector = readRequiredElement(container, ".flowchart-link");

    expect(readRequiredAttribute(connector, "data-connector-source-id")).toBe("api_gateway");
    expect(readRequiredAttribute(connector, "data-connector-target-id")).toBe("validation_service");
  });

  it("annotates SVG polyline connectors from geometry when they expose multiple points", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<polyline class="flowchart-link" points="180,100 230,100 280,100"></polyline>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    const connector = readRequiredElement(container, ".flowchart-link");

    expect(readRequiredAttribute(connector, "data-connector-source-id")).toBe("api_gateway");
    expect(readRequiredAttribute(connector, "data-connector-target-id")).toBe("validation_service");
  });

  it("skips geometry-only connector annotation when node bounds are invalid", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<path class="flowchart-link"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withInvalidFlowchartBounds(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    expect(container.querySelector(".flowchart-link")?.hasAttribute("data-connector-role")).toBe(false);
  });

  it("skips sampled connector annotation when sampled geometry has no usable length", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<path class="flowchart-link"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withZeroLengthFlowchartGeometry(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    expect(container.querySelector(".flowchart-link")?.hasAttribute("data-connector-role")).toBe(false);
  });

  it("skips polyline connector annotation when points are missing or malformed", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<polyline class="flowchart-link"></polyline>',
        '<polyline class="flowchart-link" points="180,100 invalid"></polyline>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    expect(container.querySelectorAll('[data-connector-role="flow"]')).toHaveLength(0);
  });

  it("annotates SVG polyline connectors from native point lists when available", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<polyline class="flowchart-link"></polyline>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withPolylinePointListMocks(async () => {
      await withFlowchartBoundsOnly(async () => {
        await renderMermaidDiagram({
          container,
          diagram: resolvedPaymentFlowTour.diagram
        });
      });
    });

    const connector = readRequiredElement(container, ".flowchart-link");

    expect(readRequiredAttribute(connector, "data-connector-source-id")).toBe("api_gateway");
    expect(readRequiredAttribute(connector, "data-connector-target-id")).toBe("validation_service");
  });

  it("skips line connector annotation when coordinates are missing and no node can be inferred", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<line class="flowchart-link"></line>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    expect(container.querySelector(".flowchart-link")?.hasAttribute("data-connector-role")).toBe(false);
  });

  it("skips flowchart connector annotation when Mermaid edge metadata is unusable", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_api_gateway"></g>',
        '<g class="diagram_tour_node_validation_service"></g>',
        '<path class="flowchart-link" data-id="invalid-edge-id"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    expect(container.querySelector(".flowchart-link")?.hasAttribute("data-connector-role")).toBe(false);
  });

  it("skips encoded edge ids when they do not start with a known source node id", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_payment_service"></g>',
        '<g class="diagram_tour_node_payment_provider"></g>',
        '<path class="flowchart-link" data-id="L_unknown_payment_provider_0"></path>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");
    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({
        container,
        diagram: resolvedPaymentFlowTour.diagram
      });
    });

    expect(container.querySelector(".flowchart-link")?.hasAttribute("data-connector-role")).toBe(false);
  });

  it("renders a sequence diagram and annotates participant and message elements", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        "<defs>",
        '<marker id="arrowhead"><path d="M -1 0 L 10 5 L 0 10 z"></path></marker>',
        "</defs>",
        '<line class="messageLine0" marker-end="url(#arrowhead)"></line>',
        '<text class="messageText">Send request</text>',
        '<line class="messageLine1"></line>',
        '<text class="messageText">Untagged response</text>',
        "</svg>",
        '<div class="actor-top" name="user"></div>',
        '<div class="actor-bottom"><span name="user">User</span></div>',
        '<div class="actor-top" name="api"></div>',
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: createSequenceDiagram()
    });

    expectAnnotatedSequenceParticipant(container, "user");
    expectAnnotatedSequenceMessage(container);
  });

  it("prefers exact participant header matches when Mermaid exposes them directly", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640"></svg>',
        '<div class="actor-top" name="user"></div>',
        '<div class="actor-bottom" name="user"></div>'
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [{ id: "user", kind: "participant", label: "User" }],
        path: "./sequence.mmd",
        source: "sequenceDiagram",
        type: "sequence"
      }
    });

    expect(container.querySelectorAll('[data-diagram-element-id="user"]')).toHaveLength(2);
  });

  it("skips unmatched sequence messages and falls back when no exact participant header match exists", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640"></svg>',
        '<div class="actor-top"><span name="user">User</span></div>',
        '<div class="messageLine0"></div>',
        '<div class="messageText"></div>'
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [
          { id: "user", kind: "participant", label: "User" },
          { id: "missing_message", kind: "message", label: "Missing message" }
        ],
        path: "./sequence.mmd",
        source: "sequenceDiagram",
        type: "sequence"
      }
    });

    const messageText = container.querySelector(".messageText") as HTMLDivElement;

    Object.defineProperty(messageText, "textContent", {
      configurable: true,
      get: () => null
    });

    applyFocusState({
      container,
      focusGroup: createFocusGroup(["user"])
    });

    expect(container.querySelector('[data-diagram-element-id="user"]')).not.toBeNull();
    expect(container.querySelector('[data-diagram-element-id="missing_message"]')).toBeNull();
  });

  it("skips sequence message annotations when no later message text matches the label", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640"></svg>',
        '<div class="messageText">First message</div>',
        '<div class="messageLine0"></div>',
        '<div class="messageText">Second message</div>',
        '<div class="messageLine1"></div>'
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [{ id: "missing_message", kind: "message", label: "Missing message" }],
        path: "./sequence.mmd",
        source: "sequenceDiagram",
        type: "sequence"
      }
    });

    expect(container.querySelector('[data-diagram-element-id="missing_message"]')).toBeNull();
  });

  it("skips marker annotation when the matched sequence line is not an svg element", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640"></svg>',
        '<div class="messageLine0"></div>',
        '<div class="messageText">Send request</div>'
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: createSequenceDiagram()
    });

    expect(container.querySelector('[data-diagram-element-id="request_sent"]')).not.toBeNull();
    expect(container.querySelector("#arrowhead-request_sent")).toBeNull();
  });

  it("falls back to a document-level marker when the owning svg does not contain it", async () => {
    const documentMarkerHost = document.createElement("div");

    documentMarkerHost.innerHTML =
      '<svg><defs><marker id="arrowhead"><path d="M -1 0 L 10 5 L 0 10 z"></path></marker></defs></svg>';
    document.body.append(documentMarkerHost);

    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<line class="messageLine0" marker-end="url(#arrowhead)"></line>',
        '<text class="messageText">Send request</text>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    try {
      await renderMermaidDiagram({
        container,
        diagram: createSequenceDiagram()
      });

      expect(documentMarkerHost.querySelector("#arrowhead-request_sent")).not.toBeNull();
      expect(container.querySelector('.messageLine0')?.getAttribute("marker-end")).toBe(
        "url(#arrowhead-request_sent)"
      );
    } finally {
      documentMarkerHost.remove();
    }
  });

  it("ignores marker references that do not resolve to svg marker elements", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<line class="messageLine0" marker-end="url(#arrowhead)"></line>',
        '<text class="messageText">Send request</text>',
        "</svg>",
        '<div id="arrowhead"></div>'
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: createSequenceDiagram()
    });

    expect(container.querySelector("#arrowhead-request_sent")).toBeNull();
    expect(readMessageLineAttribute(container, "marker-end")).toBe("url(#arrowhead)");
  });

  it("ignores malformed or empty marker references on matched sequence messages", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<defs><marker id="arrowhead"><path d="M -1 0 L 10 5 L 0 10 z"></path></marker></defs>',
        '<line class="messageLine0" marker-start="url(#\'\')" marker-mid="url(arrowhead)" marker-end="url(#arrowhead)"></line>',
        '<text class="messageText">Send request</text>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: createSequenceDiagram()
    });

    expect(container.querySelector("#arrowhead-request_sent")).not.toBeNull();
    expect(readMessageLineAttribute(container, "marker-start")).toBe("url(#'')");
    expect(readMessageLineAttribute(container, "marker-mid")).toBe("url(arrowhead)");
    expect(readMessageLineAttribute(container, "marker-end")).toBe("url(#arrowhead-request_sent)");
  });

  it("reuses an existing cloned marker when multiple marker attributes target the same message", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<defs><marker id="arrowhead"><path d="M -1 0 L 10 5 L 0 10 z"></path></marker></defs>',
        '<line class="messageLine0" marker-start="url(#arrowhead)" marker-end="url(#arrowhead)"></line>',
        '<text class="messageText">Send request</text>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: createSequenceDiagram()
    });

    expect(container.querySelectorAll("#arrowhead-request_sent")).toHaveLength(1);
    expect(readMessageLineAttribute(container, "marker-start")).toBe("url(#arrowhead-request_sent)");
    expect(readMessageLineAttribute(container, "marker-end")).toBe("url(#arrowhead-request_sent)");
  });
});

function readFocusState(container: HTMLElement, nodeId: string): string | null {
  return container
    .querySelector(`[data-node-id="${nodeId}"]`)
    ?.getAttribute("data-focus-state") ?? null;
}

function hasFocusState(container: HTMLElement, nodeId: string): boolean {
  return container.querySelector(`[data-node-id="${nodeId}"]`)?.hasAttribute("data-focus-state") ?? false;
}

function expectSvgState(
  container: HTMLElement,
  expected: {
    height: string | null;
    intrinsicHeight: string | undefined;
    intrinsicWidth: string | undefined;
    maxWidth: string;
    width: string | null;
  }
): void {
  const svg = readRenderedSvg(container);

  expect(svg.getAttribute("width")).toBe(expected.width);
  expect(svg.getAttribute("height")).toBe(expected.height);
  expect(svg.dataset.intrinsicWidth).toBe(expected.intrinsicWidth);
  expect(svg.dataset.intrinsicHeight).toBe(expected.intrinsicHeight);
  expect(svg.style.maxWidth).toBe(expected.maxWidth);
}

function readRenderedSvg(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");

  expect(svg).not.toBeNull();

  return svg as SVGSVGElement;
}

function createSequenceDiagram() {
  return {
    elements: [
      { id: "user", kind: "participant" as const, label: "User" },
      { id: "api", kind: "participant" as const, label: "API Gateway" },
      { id: "request_sent", kind: "message" as const, label: "Send request" }
    ],
    path: "./sequence.mmd",
    source: "sequenceDiagram",
    type: "sequence" as const
  };
}

function expectAnnotatedSequenceParticipant(container: HTMLElement, participantId: string): void {
  expect(container.querySelector(`[data-diagram-element-id="${participantId}"]`)).not.toBeNull();
  expect(container.querySelectorAll(`[data-diagram-element-id="${participantId}"]`)).toHaveLength(2);
}

function expectAnnotatedSequenceMessage(container: HTMLElement): void {
  expectAnnotatedSequenceMessageElements(container);
  expectAnnotatedSequenceMarker(container);
}

function expectAnnotatedSequenceMessageElements(container: HTMLElement): void {
  expect(
    container.querySelectorAll(
      '.messageText[data-diagram-element-id="request_sent"], .messageLine0[data-diagram-element-id="request_sent"]'
    )
  ).toHaveLength(2);
  expect(container.querySelector('[data-diagram-element-label="Send request"]')).not.toBeNull();
}

function expectAnnotatedSequenceMarker(container: HTMLElement): void {
  const marker = readSequenceMarker(container);
  const markerPath = readSequenceMarkerPath(container);
  const messageLine = readRequiredElement(container, ".messageLine0");

  expect(marker).not.toBeNull();
  expect(readRequiredAttribute(marker, "data-diagram-element-auxiliary")).toBe("true");
  expect(readRequiredAttribute(markerPath, "data-diagram-element-id")).toBe("request_sent");
  expect(readRequiredAttribute(markerPath, "data-diagram-element-auxiliary")).toBe("true");
  expect(readRequiredAttribute(messageLine, "marker-end")).toBe("url(#arrowhead-request_sent)");
}

function expectAnnotatedFlowchartConnector(container: HTMLElement): void {
  const connector = readRequiredElement(container, ".flowchart-link");

  expect(readRequiredAttribute(connector, "data-connector-role")).toBe("flow");
  expect(readRequiredAttribute(connector, "data-connector-source-id")).toBe("api_gateway");
  expect(readRequiredAttribute(connector, "data-connector-target-id")).toBe("validation_service");
  expect(readRequiredAttribute(connector, "marker-end")).toContain("flow-arrow-flow-0-marker-end");
  expect(container.querySelector('[data-connector-role="flow-marker"]')).not.toBeNull();
}

function readSequenceMarker(container: HTMLElement): Element | null {
  return container.querySelector("#arrowhead-request_sent");
}

function readSequenceMarkerPath(container: HTMLElement): Element | null {
  return container.querySelector("#arrowhead-request_sent path");
}

function readRequiredElement(container: HTMLElement, selector: string): Element {
  const element = container.querySelector(selector);

  expect(element).not.toBeNull();

  return element!;
}

function readRequiredAttribute(element: Element | null, name: string): string {
  const attribute = element?.getAttribute(name);

  expect(element).not.toBeNull();
  expect(attribute).not.toBeNull();

  return attribute!;
}

function readMessageLineAttribute(container: HTMLElement, name: string): string {
  return readRequiredAttribute(readRequiredElement(container, ".messageLine0"), name);
}

function installFlowchartGeometryMocks(
  svgGraphicsPrototype: SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  }
): void {
  svgGraphicsPrototype.getBBox = function mockGetBBox() {
    return readMockSvgBounds(this);
  };
  svgGraphicsPrototype.getTotalLength = function mockGetTotalLength() {
    return this.classList.contains("flowchart-link") ? 240 : 0;
  };
  svgGraphicsPrototype.getPointAtLength = function mockGetPointAtLength(distance: number) {
    return {
      x: distance === 0 ? 180 : 280,
      y: 100
    } as DOMPoint;
  };
}

function installFlowchartBoundsOnlyMocks(
  svgGraphicsPrototype: SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  }
): void {
  svgGraphicsPrototype.getBBox = function mockGetBBox() {
    return readMockSvgBounds(this);
  };
  svgGraphicsPrototype.getPointAtLength = undefined;
  svgGraphicsPrototype.getTotalLength = undefined;
}

function installInvalidFlowchartBoundsMocks(
  svgGraphicsPrototype: SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  }
): void {
  svgGraphicsPrototype.getBBox = function mockGetBBox() {
    return { height: 0, width: 0, x: Number.NaN, y: 0 } as SVGRect;
  };
  svgGraphicsPrototype.getPointAtLength = undefined;
  svgGraphicsPrototype.getTotalLength = undefined;
}

function installZeroLengthFlowchartGeometryMocks(
  svgGraphicsPrototype: SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  }
): void {
  installFlowchartBoundsOnlyMocks(svgGraphicsPrototype);
  svgGraphicsPrototype.getTotalLength = function mockGetTotalLength() {
    return 0;
  };
  svgGraphicsPrototype.getPointAtLength = function mockGetPointAtLength() {
    return { x: 0, y: 0 } as DOMPoint;
  };
}

function readMockSvgBounds(element: Element): SVGRect {
  const bounds = readMockSvgBoundsByClass(element);

  return bounds ?? ({ height: 0, width: 0, x: 0, y: 0 } as SVGRect);
}

function readMockSvgBoundsByClass(element: Element): SVGRect | null {
  const boundsByClass = new Map<string, SVGRect>([
    ["diagram_tour_node_api_gateway", { height: 80, width: 140, x: 40, y: 60 } as SVGRect],
    ["diagram_tour_node_validation_service", { height: 80, width: 160, x: 280, y: 60 } as SVGRect],
    ["diagram_tour_node_payment_service", { height: 80, width: 160, x: 460, y: 60 } as SVGRect],
    ["diagram_tour_node_payment_provider", { height: 80, width: 180, x: 700, y: 60 } as SVGRect]
  ]);

  return Array.from(boundsByClass.entries()).find(([className]) => element.classList.contains(className))?.[1] ?? null;
}

async function withPolylinePointListMocks(run: () => Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, "points");

  Object.defineProperty(SVGElement.prototype, "points", {
    configurable: true,
    get() {
      if ((this as SVGElement).tagName.toLowerCase() !== "polyline") {
        return undefined;
      }

      return {
        getItem(index: number) {
          return [{ x: 180, y: 100 }, { x: 230, y: 100 }, { x: 280, y: 100 }][index] as SVGPoint;
        },
        length: 3
      } as SVGPointList;
    }
  });

  try {
    await run();
  } finally {
    if (descriptor === undefined) {
      delete (SVGElement.prototype as SVGElement & { points?: SVGPointList }).points;
    } else {
      Object.defineProperty(SVGElement.prototype, "points", descriptor);
    }
  }
}

function clearThemeTokens(): void {
  [
    "--bg-base",
    "--bg-surface",
    "--text-primary",
    "--border-subtle",
    "--color-node-base-fill",
    "--color-node-base-stroke",
    "--color-node-base-text"
  ].forEach((token) => {
    document.documentElement.style.removeProperty(token);
  });
}

function restoreFlowchartGeometryMocks(
  svgGraphicsPrototype: SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  },
  original: {
    getBBox: (() => SVGRect) | undefined;
    getPointAtLength: ((distance: number) => DOMPoint) | undefined;
    getTotalLength: (() => number) | undefined;
  }
): void {
  svgGraphicsPrototype.getBBox = original.getBBox;
  svgGraphicsPrototype.getPointAtLength = original.getPointAtLength;
  svgGraphicsPrototype.getTotalLength = original.getTotalLength;
}

async function withFlowchartGeometryMocks(run: () => Promise<void>): Promise<void> {
  const svgGraphicsPrototype = SVGElement.prototype as SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  };
  const original = {
    getBBox: svgGraphicsPrototype.getBBox,
    getPointAtLength: svgGraphicsPrototype.getPointAtLength,
    getTotalLength: svgGraphicsPrototype.getTotalLength
  };

  installFlowchartGeometryMocks(svgGraphicsPrototype);

  try {
    await run();
  } finally {
    restoreFlowchartGeometryMocks(svgGraphicsPrototype, original);
  }
}

async function withFlowchartBoundsOnly(run: () => Promise<void>): Promise<void> {
  const svgGraphicsPrototype = SVGElement.prototype as SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  };
  const original = {
    getBBox: svgGraphicsPrototype.getBBox,
    getPointAtLength: svgGraphicsPrototype.getPointAtLength,
    getTotalLength: svgGraphicsPrototype.getTotalLength
  };

  installFlowchartBoundsOnlyMocks(svgGraphicsPrototype);

  try {
    await run();
  } finally {
    restoreFlowchartGeometryMocks(svgGraphicsPrototype, original);
  }
}

async function withInvalidFlowchartBounds(run: () => Promise<void>): Promise<void> {
  const svgGraphicsPrototype = SVGElement.prototype as SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  };
  const original = {
    getBBox: svgGraphicsPrototype.getBBox,
    getPointAtLength: svgGraphicsPrototype.getPointAtLength,
    getTotalLength: svgGraphicsPrototype.getTotalLength
  };

  installInvalidFlowchartBoundsMocks(svgGraphicsPrototype);

  try {
    await run();
  } finally {
    restoreFlowchartGeometryMocks(svgGraphicsPrototype, original);
  }
}

async function withZeroLengthFlowchartGeometry(run: () => Promise<void>): Promise<void> {
  const svgGraphicsPrototype = SVGElement.prototype as SVGElement & {
    getBBox?: () => SVGRect;
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  };
  const original = {
    getBBox: svgGraphicsPrototype.getBBox,
    getPointAtLength: svgGraphicsPrototype.getPointAtLength,
    getTotalLength: svgGraphicsPrototype.getTotalLength
  };

  installZeroLengthFlowchartGeometryMocks(svgGraphicsPrototype);

  try {
    await run();
  } finally {
    restoreFlowchartGeometryMocks(svgGraphicsPrototype, original);
  }
}
