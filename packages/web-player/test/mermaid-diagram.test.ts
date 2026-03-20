import { describe, expect, it, vi } from "vitest";

import {
  applyFocusState,
  createRenderableDiagramSource,
  getMermaidErrorMessage,
  renderMermaidDiagram
} from "../src/lib/mermaid-diagram";
import { createFocusGroup } from "../src/lib/focus-group";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const { mermaidRender } = vi.hoisted(() => ({
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
    initialize: vi.fn(),
    render: mermaidRender
  }
}));

describe("mermaid diagram helpers", () => {
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

    await renderMermaidDiagram({
      container,
      diagram: resolvedPaymentFlowTour.diagram
    });

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
    expect(container.querySelector('[data-connector-state="context"]')).not.toBeNull();

    applyFocusState({
      container,
      focusGroup: createFocusGroup([])
    });

    expect(hasFocusState(container, "api_gateway")).toBe(false);
    expect(hasFocusState(container, "validation_service")).toBe(false);
    expect(container.hasAttribute("data-focus-group-mode")).toBe(false);
    expect(container.hasAttribute("data-focus-group-size")).toBe(false);
    expect(container.querySelector('[data-connector-state="context"]')).toBeNull();
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
    expect(container.querySelector('.messageLine0')?.getAttribute("marker-end")).toBe("url(#arrowhead)");
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
    expect(container.querySelector('.messageLine0')?.getAttribute("marker-start")).toBe("url(#'')");
    expect(container.querySelector('.messageLine0')?.getAttribute("marker-mid")).toBe("url(arrowhead)");
    expect(container.querySelector('.messageLine0')?.getAttribute("marker-end")).toBe(
      "url(#arrowhead-request_sent)"
    );
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
    expect(container.querySelector('.messageLine0')?.getAttribute("marker-start")).toBe(
      "url(#arrowhead-request_sent)"
    );
    expect(container.querySelector('.messageLine0')?.getAttribute("marker-end")).toBe(
      "url(#arrowhead-request_sent)"
    );
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
