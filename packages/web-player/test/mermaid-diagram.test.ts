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
      "<svg>",
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
});

function readFocusState(container: HTMLElement, nodeId: string): string | null {
  return container
    .querySelector(`[data-node-id="${nodeId}"]`)
    ?.getAttribute("data-focus-state") ?? null;
}

function hasFocusState(container: HTMLElement, nodeId: string): boolean {
  return container.querySelector(`[data-node-id="${nodeId}"]`)?.hasAttribute("data-focus-state") ?? false;
}
