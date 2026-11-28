import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadResolvedTour } from "@diagram-tour/parser";

import {
  applyFocusState,
  createRenderableDiagramSource,
  getMermaidErrorMessage,
  renderMermaidDiagram
} from "../src/lib/mermaid-diagram";
import { createFocusGroup } from "../src/lib/focus-group";
import { resolvedClassTour, resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const { mermaidBindFunctions, mermaidInitialize, mermaidRegisterExternalDiagrams, mermaidRender } = vi.hoisted(() => {
  const bindFunctions = vi.fn();
  type RenderResult = { bindFunctions?: typeof bindFunctions; svg: string };
  const render = vi.fn<() => Promise<RenderResult>>(async () => ({
    bindFunctions,
    svg: [
      '<svg width="100%" style="max-width: 1440px;" viewBox="0 0 1440 960">',
      '<g class="diagram_tour_node_api_gateway"></g>',
      '<g class="diagram_tour_node_validation_service"></g>',
      '<g class="diagram_tour_node_payment_service"></g>',
      '<g class="edgeLabel"><foreignObject><div>Yes</div></foreignObject></g>',
      "</svg>"
    ].join("")
  }));

  return {
    mermaidBindFunctions: bindFunctions,
    mermaidInitialize: vi.fn(),
    mermaidRegisterExternalDiagrams: vi.fn(async () => undefined),
    mermaidRender: render
  };
});

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitialize,
    registerExternalDiagrams: mermaidRegisterExternalDiagrams,
    render: mermaidRender
  }
}));

vi.mock("@mermaid-js/mermaid-zenuml", () => ({ default: { id: "zenuml-plugin" } }));

describe("mermaid diagram helpers", () => {
  beforeEach(() => {
    mermaidInitialize.mockClear();
    mermaidBindFunctions.mockClear();
    mermaidRegisterExternalDiagrams.mockClear();
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

  it("adds app-owned node classes for newly addressable flowchart IDs", () => {
    const source = createRenderableDiagramSource({
      elements: [
        { id: "decision", kind: "node", label: "Decision" },
        { id: "archive", kind: "node", label: "archive" },
        { id: "metadata", kind: "node", label: "Metadata Node" }
      ],
      path: "./flowchart-addressability.mmd",
      source: "flowchart LR\n  decision{Decision} --> archive\n  metadata@{ shape: rect, label: Metadata Node }",
      type: "flowchart"
    });

    expect(source).toContain("class decision diagram_tour_node_decision;");
    expect(source).toContain("class archive diagram_tour_node_archive;");
    expect(source).toContain("class metadata diagram_tour_node_metadata;");
  });

  it("keeps flowchart click annotations in the rendered Mermaid source", () => {
    const source = createRenderableDiagramSource({
      elements: [{ id: "decision", kind: "node", label: "Decision" }],
      path: "./flowchart-addressability.mmd",
      source: [
        "flowchart LR",
        "  decision{Decision}",
        '  click decision "https://example.com/decision" "Decision rule details"'
      ].join("\n"),
      type: "flowchart"
    });

    expect(source).toContain(
      'click decision "https://example.com/decision" "Decision rule details"'
    );
  });

  it("keeps sequence-diagram source unchanged", () => {
    const source = createRenderableDiagramSource({
      elements: [
        { id: "user", kind: "participant", label: "User" },
        { id: "request_sent", kind: "message", label: "Send request" }
      ],
      path: "./sequence.mmd",
      source: "sequenceDiagram\n  participant user as User\n  user->>user: [request_sent] Send request",
      type: "sequence"
    });

    expect(source).toBe("sequenceDiagram\n  participant user as User\n  user->>user: [request_sent] Send request");
  });

  it("adds app-owned node classes to class diagram source", () => {
    const source = createRenderableDiagramSource(resolvedClassTour.diagram);

    expect(source).toBe(resolvedClassTour.diagram.source);
  });

  it("keeps sankey source unchanged", () => {
    const source = createRenderableDiagramSource({
      elements: [
        { id: "Checkout", kind: "node", label: "Checkout" },
        { id: "Gateway", kind: "node", label: "Gateway" }
      ],
      path: "./sankey.mmd",
      source: "sankey-beta\nCheckout,Gateway,120",
      type: "sankey"
    });

    expect(source).toBe("sankey-beta\nCheckout,Gateway,120");
  });

  it("keeps ZenUML source unchanged for Mermaid rendering", () => {
    const source = "zenuml\nA.method() {\n  return result\n}";

    expect(createRenderableDiagramSource({ elements: [], path: "./zenuml.mmd", source, type: "zenuml" })).toBe(source);
  });

  it("preserves the complete state-diagram fixture source for rendering", async () => {
    const source = await readFile(resolve(process.cwd(), "test/fixtures/state/review-lifecycle.mmd"), "utf8");

    expect(
      createRenderableDiagramSource({ elements: [], path: "./review-lifecycle.mmd", source, type: "stateDiagram" })
    ).toBe(source);
  });

  it("preserves the complete mindmap fixture source for rendering", async () => {
    const source = await readFile(resolve(process.cwd(), "test/fixtures/mindmap/release-plan.mmd"), "utf8");

    expect(createRenderableDiagramSource({ elements: [], path: "./release-plan.mmd", source, type: "mindmap" })).toBe(
      source
    );
  });

  it("resolves paired decision tree tours to focusable branches and Mindmap topics", async () => {
    const flowchart = await loadResolvedTour(
      resolve(process.cwd(), "test/fixtures/decision-tree/eligibility-flowchart.tour.yaml")
    );
    const mindmap = await loadResolvedTour(
      resolve(process.cwd(), "test/fixtures/decision-tree/eligibility-mindmap.tour.yaml")
    );

    expect(flowchart.diagram.elements.filter((element) => element.kind === "transition").map(({ id }) => id)).toEqual([
      "transition-request-to-eligibility-unlabeled",
      "transition-eligibility-to-approved-yes",
      "transition-eligibility-to-documents-no",
      "transition-documents-to-manual_review-yes",
      "transition-documents-to-rejected-no"
    ]);
    expect(mindmap.diagram.elements.map(({ id }) => id)).toHaveLength(11);
    expect(mindmap.diagram.elements.map(({ id }) => id)).toContain("documents_yes");
    expect(mindmap.diagram.elements.map(({ id }) => id)).toContain("mindmap-eligibility-eligible-no-documents-complete");
    expect(flowchart.steps[2]?.text).toContain("Eligible? → Approved: Yes leads to the approval outcome.");
    expect(mindmap.steps[5]?.text).toContain("Review Documents complete? before deciding the next step.");
    expect(mindmap.diagram.source).toContain("mindmap");
  });

  it("preserves the authored fixture source for Mermaid rendering", async () => {
    const source = await readFile(resolve(process.cwd(), "test/fixtures/zenuml/checkout-zenuml.mmd"), "utf8");

    expect(createRenderableDiagramSource({ elements: [], path: "./checkout-zenuml.mmd", source, type: "zenuml" })).toBe(source);
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

    expect(mermaidRegisterExternalDiagrams).toHaveBeenCalledWith([{ id: "zenuml-plugin" }]);
    expect(mermaidBindFunctions).toHaveBeenCalledWith(container);
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

  it("tags architecture focus keys on the rendered Mermaid groups and shapes", async () => {
    const tour = await loadResolvedTour(resolve(process.cwd(), "test/fixtures/architecture/platform-topology.tour.yaml"));
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="300" height="200" viewBox="0 0 300 200">',
        '<g class="architecture-edges"><g><path class="edge" id="L_app_split_0"></path><polygon class="arrow"></polygon></g>',
        '<g><path class="edge" id="L_split_cache_0"></path></g><g><path class="edge" id="L_app_database_0"></path><polygon class="arrow"></polygon></g>',
        '<g><path class="edge" id="L_cache_app_0"></path><polygon class="arrow"></polygon></g></g>',
        '<g class="architecture-services"><g id="service-app" class="architecture-service"><path></path><text>Application</text></g>',
        '<g class="architecture-junction"><g><rect id="node-split"></rect></g></g></g>',
        '<g class="architecture-groups"><rect id="group-platform" class="node-bkg"></rect>',
        '<g class="group-label"><text>Platform</text></g></g></svg>'
      ].join("")
    });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: tour.diagram });

    expect(readNodeId(container, "#service-app.architecture-service")).toBe("service-app");
    expect(readNodeId(container, "#node-split")).toBe("junction-split");
    expect(readNodeId(container, "#group-platform.node-bkg")).toBe("group-platform");
    expect(readNodeId(container, ".group-label")).toBe("group-platform");
    const edge = container.querySelector('.architecture-edges > g[data-node-id="connection-3"]')!;
    expect(readEdgeId(edge)).toBe("L_app_database_0");
    expect(hasArrow(edge)).toBe(true);
    expect(mermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({
      themeVariables: expect.objectContaining({
        archEdgeColor: "var(--color-node-base-stroke, #30363d)",
        archEdgeArrowColor: "var(--color-node-base-stroke, #30363d)",
        archGroupBorderColor: "var(--color-node-base-stroke, #30363d)"
      })
    }));

    applyFocusState({ container, focusGroup: createFocusGroup(["connection-3"]) });
    expect(edge.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector('[data-node-id="connection-1"]')?.getAttribute("data-focus-state")).toBe("dimmed");
  });

  it("maps colliding native Architecture IDs to separate source-order paths", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="architecture-edges"><g><path id="L_a_b_c_0"></path></g><g><path id="L_a_b_c_0"></path></g></g></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "connection-1", kind: "transition", label: "a_b:R → c:L", renderId: "L_a_b_c_0", renderOrder: 1 },
        { id: "connection-2", kind: "transition", label: "a:R → b_c:L", renderId: "L_a_b_c_0", renderOrder: 2 }
      ], path: "./collision.mmd", source: "architecture-beta", type: "architecture"
    } });

    expect(readNodeId(container, '.architecture-edges > g:nth-child(1)')).toBe("connection-1");
    expect(readNodeId(container, '.architecture-edges > g:nth-child(2)')).toBe("connection-2");
  });

  it("skips missing architecture targets and groups without a rendered label", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: '<svg><g class="architecture-groups"><rect id="group-empty" class="node-bkg"></rect></g><g class="architecture-edges"></g><svg class="architecture-edges"><path id="edge-no-group"></path></svg></svg>'
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "group-empty", kind: "group" as const, label: "Empty" },
        { id: "service-missing", kind: "node" as const, label: "Missing" },
        { id: "connection-4", kind: "transition" as const, label: "Missing edge", renderId: "not-rendered", renderOrder: 4 },
        { id: "connection-no-id", kind: "transition" as const, label: "No render id" },
        { id: "connection-no-group", kind: "transition" as const, label: "No SVG group", renderId: "edge-no-group" }
      ],
      path: "./missing-architecture-targets.mmd",
      source: "architecture-beta",
      type: "architecture" as const
    };

    await renderMermaidDiagram({ container, diagram });

    expect(readNodeId(container, "#group-empty")).toBe("group-empty");
    expect(container.querySelector('[data-node-id="service-missing"]')).toBeNull();
    expect(container.querySelector('[data-node-id="connection-4"]')).toBeNull();
  });

  it("annotates C4 boundaries, people, relationship connectors and matching labels", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        "<svg>",
        '<g class="boundary" id="company"><rect></rect><text>Acme</text></g>',
        '<g class="person-man" id="visitor"><text>Shopper</text></g><g class="person-man" id="visitor-alt"><text>Shopper</text></g>',
        '<g><line marker-end="url(#arrow)"></line><text>1: Browses and buys</text><text>[HTTPS]</text></g>',
        '<g><path marker-start="url(#arrow)"></path><text>Refunds order</text></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "boundary-company", kind: "group" as const, label: "Acme", renderId: "company" },
        { id: "person-visitor", kind: "node" as const, label: "Shopper", renderId: "visitor" },
        { id: "person-visitor-alt", kind: "node" as const, label: "Shopper", renderId: "visitor-alt" },
        { id: "missing-person", kind: "node" as const, label: "Unrendered person" },
        { id: "missing-boundary", kind: "group" as const, label: "Unrendered boundary" },
        { id: "relationship-1", kind: "relationship" as const, label: "visitor → shop: Browses and buys [HTTPS]", renderTechnology: "HTTPS" },
        { id: "relationship-2", kind: "relationship" as const, label: "shop → store: Refunds order", renderOrder: 2 },
        { id: "relationship-3", kind: "relationship" as const, label: "No label", renderOrder: 3 },
        { id: "relationship-4", kind: "relationship" as const, label: "missing → target: Uses [HTTPS]", renderOrder: 4 }
      ],
      path: "./platform-context.mmd",
      source: "C4Deployment",
      type: "c4" as const
    };

    await renderMermaidDiagram({ container, diagram });

    expect(readNodeId(container, ".boundary")).toBe("boundary-company");
    const people = Array.from(container.querySelectorAll(".person-man"));
    expect((people[0] as HTMLElement).dataset.nodeId).toBe("person-visitor");
    expect((people[1] as HTMLElement).dataset.nodeId).toBe("person-visitor-alt");
    expect(readNodeId(container, "line[marker-end]")).toBe("relationship-1");
    expect(readNodeId(container, "path[marker-start]")).toBe("relationship-2");
    const relationshipLabels = Array.from(container.querySelectorAll("text"))
      .filter((label) => label.getAttribute("data-node-id") === "relationship-1");
    expect(relationshipLabels.map((label) => label.textContent)).toEqual(["1: Browses and buys", "[HTTPS]"]);
    const secondRelationshipLabel = Array.from(container.querySelectorAll("text"))
      .find((label) => label.textContent === "Refunds order");
    expect(secondRelationshipLabel?.getAttribute("data-node-id")).toBe("relationship-2");
    expect(container.querySelector('[data-node-id="missing-person"]')).toBeNull();
    expect(container.querySelector('[data-node-id="missing-boundary"]')).toBeNull();
    expect(container.querySelector('[data-node-id="relationship-3"]')).toBeNull();
  });

  it("matches C4 source IDs inside labels and falls back to exact rendered labels", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="boundary"><rect></rect><text>Acme</text></g>',
      '<g class="person-man"><text>visitor</text></g>',
      '<g class="person-man"><text>Direct label</text></g>',
      '<g class="person-man"><text>Unrelated</text></g></svg>'
    ].join("") });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-company", kind: "group", label: "Acme", renderId: "company" },
        { id: "person-visitor", kind: "node", label: "Visitor", renderId: "visitor" },
        { id: "person-unmatched", kind: "node", label: "Not present", renderId: "missing" },
        { id: "person-direct", kind: "node", label: "Direct label" }
      ],
      path: "./context.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, ".boundary")).toBe("boundary-company");
    expect(readNodeId(container, ".person-man")).toBe("person-visitor");
    expect(Array.from(container.querySelectorAll(".person-man"))[1]?.getAttribute("data-node-id")).toBe("person-direct");
    expect(container.querySelector('[data-node-id="person-unmatched"]')).toBeNull();
  });

  it("matches nested same-title C4 boundaries in outer-to-inner source order", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="boundary"><rect></rect><text>Same</text><g class="boundary"><rect></rect><text>Same</text></g></g><g class="person-man"><rect></rect><text>App</text><text>Server</text></g></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-outer", kind: "group", label: "Same", renderId: "outer" },
        { id: "boundary-inner", kind: "group", label: "Same", renderId: "inner" },
        { id: "system-app", kind: "node", label: "App<br/>Server", renderId: "app" }
      ], path: "./nested.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, ".boundary")).toBe("boundary-outer");
    expect(readNodeId(container, ".boundary .boundary")).toBe("boundary-inner");
    expect(readNodeId(container, ".person-man")).toBe("system-app");
  });

  it("matches same-title C4 sibling boundaries by render order and systems by full identity", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="boundary" id="first"><rect></rect><text>Same</text></g>',
      '<g class="boundary" id="second"><rect></rect><text>Same</text></g>',
      '<g class="person-man" id="outside"><text>Same</text><text>Outside</text></g>',
      '<g class="person-man" id="inside"><text>Same</text><text>Inside</text></g></svg>'
    ].join("") });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-one", kind: "group", label: "Same", renderId: "one" },
        { id: "boundary-two", kind: "group", label: "Same", renderId: "two" },
        { id: "system-a", kind: "node", label: "Same", renderId: "a", renderIdentity: "Same Inside" },
        { id: "system-b", kind: "node", label: "Same", renderId: "b", renderIdentity: "Same Outside" }
      ], path: "./siblings.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, "#first")).toBe("boundary-one");
    expect(readNodeId(container, "#second")).toBe("boundary-two");
    expect(readNodeId(container, "#inside")).toBe("system-a");
    expect(readNodeId(container, "#outside")).toBe("system-b");
  });

  it("maps identical C4 shapes to their source boundary and leaves root identities outside it", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="boundary" id="scope"><rect></rect><text>Scope</text></g>',
      '<g class="person-man" id="inside"><rect></rect><text>Same</text><text>Description</text></g>',
      '<g class="person-man" id="outside"><rect></rect><text>Same</text><text>Description</text></g>',
      '<g class="person-man" id="external"><rect></rect><text>Same</text><text>Description</text></g></svg>'
    ].join("") });
    const container = document.createElement("div");
    const boundsSpy = vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(function (this: SVGElement) {
      const bounds = readDuplicateC4Bounds(this);
      return new DOMRect(bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!);
    });
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-scope", kind: "group", label: "Scope", renderId: "scope" },
        { id: "system-inside", kind: "node", label: "Same", renderIdentity: "Same Description", renderParentId: "scope" },
        { id: "system-outside", kind: "node", label: "Same", renderIdentity: "Same Description" },
        { id: "system-external", kind: "node", label: "Same", renderIdentity: "Same Description" },
        { id: "system-missing-parent", kind: "node", label: "Same", renderIdentity: "Same Description", renderParentId: "missing" }
      ], path: "./duplicate-identity.mmd", source: "C4Context", type: "c4"
    } });
    boundsSpy.mockRestore();

    expect(readNodeId(container, "#inside")).toBe("system-inside");
    expect(readNodeId(container, "#outside")).toBe("system-outside");
    expect(readNodeId(container, "#external")).toBe("system-external");
    expect(container.querySelector('[data-node-id="system-missing-parent"]')).toBeNull();
  });

  it("maps identical C4 shapes inside deployment nodes separately from root shapes", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="boundary" id="cloud"><rect></rect></g>',
      '<g class="person-man" id="inside"><rect></rect><text>Same</text><text>Description</text></g>',
      '<g class="person-man" id="outside"><rect></rect><text>Same</text><text>Description</text></g></svg>'
    ].join("") });
    const container = document.createElement("div");
    const boundsSpy = vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(function (this: SVGElement) {
      const bounds = readDuplicateC4Bounds(this);
      return new DOMRect(bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!);
    });
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "deployment-cloud", kind: "group", label: "Cloud", renderId: "cloud" },
        { id: "container-a", kind: "node", label: "Same", renderIdentity: "Same Description", renderParentId: "cloud" },
        { id: "container-b", kind: "node", label: "Same", renderIdentity: "Same Description" }
      ], path: "./deployment-identity.mmd", source: "C4Deployment", type: "c4"
    } });
    boundsSpy.mockRestore();

    expect(readNodeId(container, "#cloud")).toBe("deployment-cloud");
    expect(readNodeId(container, "#inside")).toBe("container-a");
    expect(readNodeId(container, "#outside")).toBe("container-b");
  });

  it("skips C4 candidates outside the SVG when resolving a scoped target", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<div class="person-man" id="outside"><text>Outside</text></div><svg><g class="boundary" id="scope"><rect></rect></g><g class="person-man" id="inside"><text>Inside</text></g></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-scope", kind: "group", label: "Scope", renderId: "scope" },
        { id: "system-outside", kind: "node", label: "Outside" },
        { id: "system-inside", kind: "node", label: "Inside", renderParentId: "scope" }
      ], path: "./outside-svg.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, "#outside")).toBe("system-outside");
    expect(container.querySelector('[data-node-id="system-inside"]')).toBeNull();
  });

  it("skips a scoped C4 shape when Mermaid renders no shape candidates", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: "<svg></svg>" });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "system-app", kind: "node", label: "App", renderIdentity: "App Service", renderParentId: "scope" }
      ], path: "./missing-c4-parent.mmd", source: "C4Context", type: "c4"
    } });

    expect(container.querySelector('[data-node-id="system-app"]')).toBeNull();
  });

  it("matches a C4 system's full identity exactly when another identity extends it", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="person-man" id="longer"><text>&lt;&lt;system&gt;&gt;</text><text>Same</text><text>Inside External</text></g>',
      '<g class="person-man" id="exact"><text>&lt;&lt;system&gt;&gt;</text><text>Same</text><text>Inside</text></g></svg>'
    ].join("") });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "system-a", kind: "node", label: "Same", renderId: "a", renderIdentity: "Same Inside" },
        { id: "system-b", kind: "node", label: "Same", renderId: "b", renderIdentity: "Same Inside External" }
      ], path: "./identity-prefix.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, "#exact")).toBe("system-a");
    expect(readNodeId(container, "#longer")).toBe("system-b");
  });

  it("does not fall back to a shared C4 label when a full identity is available", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="person-man" id="candidate"><text>Same</text><text>Other</text></g></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [{ id: "system-a", kind: "node", label: "Same", renderIdentity: "Same Missing" }],
      path: "./identity-missing.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, "#candidate")).toBeUndefined();
  });

  it("uses exact C4 source ID text after full identity does not match", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="person-man"><text>a</text></g></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [{ id: "system-a", kind: "node", label: "Same", renderId: "a", renderIdentity: "Same" }],
      path: "./identity-source.mmd", source: "C4Context", type: "c4"
    } });

    expect(readNodeId(container, ".person-man")).toBe("system-a");
  });

  it("orders same-title C4 boundaries by containment when Mermaid renders nested groups first", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="boundary" id="outer"><rect></rect><text>Same</text></g><g class="boundary" id="inner"><rect></rect><text>Same</text></g></svg>' });
    const container = document.createElement("div");
    const boundsSpy = vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(function (this: SVGElement) {
      const bounds = this.parentElement?.id === "outer" ? [0, 0, 500, 500] : [100, 100, 100, 100];
      return new DOMRect(bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!);
    });
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-outer", kind: "group", label: "Same", renderId: "outer" },
        { id: "boundary-inner", kind: "group", label: "Same", renderId: "inner", renderParentId: "outer" }
      ], path: "./nested-order.mmd", source: "C4Context", type: "c4"
    } });
    boundsSpy.mockRestore();

    expect(readNodeId(container, "#outer")).toBe("boundary-outer");
    expect(readNodeId(container, "#inner")).toBe("boundary-inner");
  });

  it("orders same-title C4 boundaries when the outer renderer group appears first", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="boundary" id="inner"><rect></rect><text>Same</text></g><g class="boundary" id="outer"><rect></rect><text>Same</text></g></svg>' });
    const container = document.createElement("div");
    const boundsSpy = vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(function (this: SVGElement) {
      const bounds = this.parentElement?.id === "outer" ? [0, 0, 500, 500] : [100, 100, 100, 100];
      return new DOMRect(bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!);
    });
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "boundary-outer", kind: "group", label: "Same", renderId: "outer" },
        { id: "boundary-inner", kind: "group", label: "Same", renderId: "inner", renderParentId: "outer" }
      ], path: "./nested-order.mmd", source: "C4Context", type: "c4"
    } });
    boundsSpy.mockRestore();

    expect(readNodeId(container, "#outer")).toBe("boundary-outer");
    expect(readNodeId(container, "#inner")).toBe("boundary-inner");
  });

  it("reads relationship labels after the final SVG connector sibling", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><line marker-end="url(#arrow)"></line><text>Last relation</text></svg>' });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: {
      elements: [{ id: "relationship-1", kind: "relationship", label: "source → target: Last relation" }],
      path: "./relations.mmd", source: "C4Dynamic", type: "c4"
    } });

    expect(readNodeId(container, "line[marker-end]")).toBe("relationship-1");
    expect(readNodeId(container, "text")).toBe("relationship-1");
  });

  it("keeps C4 relationship labels inside the connector's sibling range", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><line marker-end="url(#first)"></line><text>First relation</text>',
      '<path marker-start="url(#second)"></path><text>Second relation</text></svg>'
    ].join("") });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "relationship-1", kind: "relationship", label: "a → b: First relation" },
        { id: "relationship-2", kind: "relationship", label: "b → c: Second relation", renderOrder: 2 }
      ],
      path: "./relations.mmd", source: "C4Dynamic", type: "c4"
    } });

    expect(readNodeId(container, "text:nth-of-type(1)")).toBe("relationship-1");
    expect(readNodeId(container, "text:nth-of-type(2)")).toBe("relationship-2");
  });

  it("maps every C4 line-break label fragment only within its relationship group", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g><line marker-end="url(#first)"></line><text>Uses</text><text>Database</text><text>[TLS]</text></g><text>Unrelated node label</text></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [{ id: "relationship-1", kind: "relationship", label: "source → target: Uses<br/>Database [TLS]", renderTechnology: "TLS" }],
      path: "./line-break.mmd", source: "C4Dynamic", type: "c4"
    } });

    expect(Array.from(container.querySelectorAll("text[data-node-id='relationship-1']")).map(({ textContent }) => textContent)).toEqual([
      "Uses", "Database", "[TLS]"
    ]);
    expect(container.querySelector("svg > text")?.getAttribute("data-node-id")).toBeNull();
  });

  it("keeps bracketed display text distinct from Mermaid relationship technology", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g><line marker-end="a"></line><text>Reads [cache]</text></g><g><line marker-end="b"></line><text>Reads</text><text>[HTTP]</text></g></svg>' });
    const container = document.createElement("div");
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "relationship-1", kind: "relationship", label: "a → b: Reads [cache]" },
        { id: "relationship-2", kind: "relationship", label: "a → b: Reads [HTTP]", renderOrder: 2, renderTechnology: "HTTP" }
      ], path: "./relationship-technology.mmd", source: "C4Dynamic", type: "c4"
    } });

    expect(Array.from(container.querySelectorAll("text[data-node-id='relationship-1']"), ({ textContent }) => textContent)).toEqual(["Reads [cache]"]);
    expect(Array.from(container.querySelectorAll("text[data-node-id='relationship-2']"), ({ textContent }) => textContent)).toEqual(["Reads", "[HTTP]"]);
  });

  it("binds state diagram theme variables to the active light and dark theme", async () => {
    const tour = await loadResolvedTour(resolve(process.cwd(), "test/fixtures/state/review-lifecycle.tour.yaml"));

    await renderMermaidDiagram({ container: document.createElement("div"), diagram: tour.diagram });

    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          compositeBackground: "var(--bg-surface, #161b22)",
          stateBkg: "var(--color-node-base-fill, #1c2128)",
          stateBorder: "var(--color-node-base-stroke, #30363d)",
          stateLabelColor: "var(--color-node-base-text, #e6edf3)",
          transitionColor: "var(--color-node-base-stroke, #30363d)"
        })
      })
    );
  });

  it("tags mindmap topics in render order and keeps branch lines as context", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<path class="edge"></path>',
        '<g class="mindmap-node section-root"><circle></circle><text>Release plan</text></g>',
        '<g class="mindmap-node section-0"><rect></rect><text>Research</text></g>',
        '<g class="mindmap-node section-0"><rect></rect><text>Interviews</text></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "plan", kind: "node" as const, label: "Release plan" },
        { id: "research", kind: "node" as const, label: "Research" },
        { id: "mindmap-plan-research-interviews", kind: "node" as const, label: "Interviews" }
      ],
      path: "./release-plan.mmd",
      source: "mindmap\n  plan((Release plan))\n    research[Research]\n      Interviews",
      type: "mindmap" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup(["mindmap-plan-research-interviews"]) });

    expectFocusState(container, "plan", "dimmed");
    expectFocusState(container, "research", "dimmed");
    expectFocusState(container, "mindmap-plan-research-interviews", "focused");
    expect(container.querySelector(".edge")?.hasAttribute("data-focus-state")).toBe(false);
    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          lineColor: "#30363d",
          primaryColor: "#1c2128",
          primaryTextColor: "#e6edf3"
        })
      })
    );
    expect(mermaidRender).toHaveBeenCalledWith(expect.any(String), diagram.source);
  });

  it("binds sequence colors to live light and dark theme tokens", async () => {
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: createSequenceDiagram() });

    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          actorTextColor: "var(--color-node-base-text, #e6edf3)",
          noteBkgColor: "var(--bg-surface, #161b22)",
          noteTextColor: "var(--text-primary, #e6edf3)",
          signalTextColor: "var(--color-node-base-text, #e6edf3)"
        })
      })
    );
  });

  it("registers ZenUML and annotates source-derived actor, interaction, and block targets", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg aria-roledescription="zenuml" viewBox="0 0 640 480">',
        "<style>.participant-box { fill: #ffffff; }</style>",
        '<g class="actor"><rect class="participant-box"></rect><text>Customer</text></g>',
        '<g class="message"><path></path><text>OrderService.submit()</text></g>',
        '<g class="message"><path></path><foreignObject><div>receipt</div></foreignObject></g>',
        "<text>unwrapped</text>",
        '<g class="block"><rect></rect><text>cartHasItems</text></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "actor-customer", kind: "participant" as const, label: "Customer" },
        { id: "interaction-order-service-submit", kind: "message" as const, label: "submit()" },
        { id: "interaction-return-receipt", kind: "message" as const, label: "receipt" },
        { id: "interaction-unwrapped", kind: "message" as const, label: "unwrapped" },
        { id: "interaction-missing", kind: "message" as const, label: "not rendered" },
        { id: "block-while-cart-has-items", kind: "group" as const, label: "While: cartHasItems" }
      ],
      path: "./zenuml.mmd",
      source: "zenuml\nOrderService.submit() {\n  return receipt\n}\nwhile(cartHasItems) {",
      type: "zenuml" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup(["block-while-cart-has-items"]) });

    expectFocusState(container, "actor-customer", "dimmed");
    expectFocusState(container, "interaction-order-service-submit", "dimmed");
    expectFocusState(container, "block-while-cart-has-items", "focused");
    expect(container.querySelector('[data-node-id="interaction-return-receipt"]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="interaction-unwrapped"]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="interaction-missing"]')).toBeNull();
    expect((container.querySelector(".participant-box") as SVGElement).style.fill).toBe("var(--color-node-base-fill)");
    expect(mermaidRender).toHaveBeenCalledWith(expect.any(String), diagram.source);
  });

  it("renders and tags class diagram nodes", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg class="classDiagram" width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="node default" id="classId-Animal-0">',
        '<g class="label-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>Animal</p></span></div></foreignObject></g></g>',
        '<g class="members-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>+String name</p></span></div></foreignObject></g></g>',
        '<g class="methods-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>+void speak()</p></span></div></foreignObject></g></g>',
        "</g>",
        '<g class="node default" id="classId-Duck-1">',
        '<g class="label-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>Duck</p></span></div></foreignObject></g></g>',
        '<g class="methods-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>+void quack()</p></span></div></foreignObject></g></g>',
        "</g>",
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: resolvedClassTour.diagram
    });

    expect(container.querySelector('[data-node-id="Animal"]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="Animal.name"]')).not.toBeNull();
    expect(container.querySelector('[data-node-label="Animal"]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="Duck"]')).not.toBeNull();
  });

  it("falls back to the class node element when Mermaid omits a label-group wrapper", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg class="classDiagram" width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="node default" id="classId-Animal-0">Animal</g>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [{ id: "Animal", kind: "node", label: "Animal" }],
        path: "./class-diagram.mmd",
        source: "classDiagram\n  class Animal",
        type: "classDiagram"
      }
    });

    expect(container.querySelector('[data-node-id="Animal"]')).not.toBeNull();
    expect(container.querySelector('[data-node-label="Animal"]')).not.toBeNull();
  });

  it("skips unmatched class nodes and member labels in class diagrams", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg class="classDiagram" width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="node default" id="classId-Ghost-0">',
        '<g class="label-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>Ghost</p></span></div></foreignObject></g></g>',
        "</g>",
        '<g class="node default" id="classId-Animal-1">',
        '<g class="label-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>Animal</p></span></div></foreignObject></g></g>',
        '<g class="members-group text"><g class="label"><foreignObject><div><span class="nodeLabel markdown-node-label"><p>+String fur</p></span></div></foreignObject></g></g>',
        "</g>",
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [
          { id: "Animal", kind: "node", label: "Animal" },
          { id: "Animal.name", kind: "node", label: "+String name" }
        ],
        path: "./class-diagram.mmd",
        source: "classDiagram\n  class Animal {\n    +String name\n  }",
        type: "classDiagram"
      }
    });

    expect(container.querySelector('[data-node-id="Ghost"]')).toBeNull();
    expect(container.querySelector('[data-node-id="Animal.name"]')).toBeNull();
    expect(container.querySelector('[data-node-id="Animal"]')).not.toBeNull();
  });

  it("annotates sankey nodes and labels in source order", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="nodes"><g class="node"><rect></rect></g><g class="node"><rect></rect></g></g>',
        '<g class="node-labels"><text>Checkout</text><text>Gateway</text></g>',
        "</svg>"
      ].join("")
    });

    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [
          { id: "Checkout", kind: "node", label: "Checkout" },
          { id: "Gateway", kind: "node", label: "Gateway" }
        ],
        path: "./sankey.mmd",
        source: "sankey-beta\nCheckout,Gateway,120",
        type: "sankey"
      }
    });

    expect(container.querySelector('.nodes .node[data-diagram-element-id="Checkout"]')).not.toBeNull();
    expect(container.querySelector('.node-labels text[data-diagram-element-id="Gateway"]')).not.toBeNull();
    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        sankey: {
          height: 860,
          useMaxWidth: false,
          width: 1560
        }
      })
    );
  });

  it("annotates nested states and transitions as independent focus targets", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<g class="statediagram-state" id="state-Draft-2"><rect></rect><text>Draft</text></g>',
        '<g class="statediagram-cluster" id="state-InReview-2"><rect></rect><text>In review</text></g>',
        '<g class="statediagram-state" id="state-Reviewing-19"><rect></rect><text>Reviewing</text></g>',
        '<g class="statediagram-state" id="state-review_fork-12"><rect></rect></g>',
        '<g class="statediagram-state" id="state-review_join-15"><rect></rect></g>',
        '<g class="edgePaths"><path class="transition" data-edge="" data-id="edge0"></path></g>',
        '<g class="edgeLabels"><g class="edgeLabel"><g class="label" data-id="edge0">submit [complete]</g></g></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "state-draft", kind: "state" as const, label: "Draft", renderId: "Draft" },
        { id: "transition-state-draft-to-state-in-review-submit-complete", kind: "transition" as const, label: "Draft → In review: submit [complete]", renderOrder: 0, renderSourceId: "state-draft", renderTargetId: "state-in-review" },
        { id: "state-in-review", kind: "state" as const, label: "In review", renderId: "InReview" },
        { id: "state-in-review-reviewing", kind: "state" as const, label: "Reviewing", renderId: "Reviewing" },
        { id: "state-in-review-review-fork", kind: "state" as const, label: "review_fork", renderId: "review_fork" },
        { id: "state-in-review-review-join", kind: "state" as const, label: "review_join", renderId: "review_join" }
      ],
      path: "./review-lifecycle.mmd",
      source: "stateDiagram-v2\nDraft --> InReview : submit [complete]",
      type: "stateDiagram" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup([diagram.elements[1]!.id]) });

    expectFocusState(container, "state-draft", "dimmed");
    expectFocusState(container, "state-in-review", "dimmed");
    expectFocusState(container, "state-in-review-reviewing", "dimmed");
    expectFocusState(container, "transition-state-draft-to-state-in-review-submit-complete", "focused");
    expect(container.querySelector(".edgeLabel > .label[data-node-id]")?.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector('[data-node-id="state-in-review-review-fork"]')).not.toBeNull();
    applyFocusState({ container, focusGroup: createFocusGroup(["state-in-review-review-fork"]) });
    expectFocusState(container, "state-in-review-review-fork", "focused");
  });

  it("matches duplicate state labels by source ID before using visible text", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<g class="statediagram-state" id="state-first-2"><text>Shared label</text></g>',
        '<g class="statediagram-state" id="state-second-2"><text>Shared label</text></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "state-first", kind: "state" as const, label: "Shared label", renderId: "first" },
        { id: "state-second", kind: "state" as const, label: "Shared label", renderId: "second" }
      ],
      path: "./state.mmd",
      source: "stateDiagram-v2",
      type: "stateDiagram" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup(["state-second"]) });

    expectFocusState(container, "state-first", "dimmed");
    expectFocusState(container, "state-second", "focused");
  });

  it("falls back to state labels and skips transitions without render identity", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<g class="statediagram-state" id="fallback"><text>Fallback label</text></g>',
        '<g class="statediagram-state" id="unmatched"><text>Other label</text></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "state-fallback", kind: "state" as const, label: "Fallback label" },
        { id: "state-unmatched", kind: "state" as const, label: "No match" },
        { id: "transition-no-order", kind: "transition" as const, label: "No order" },
        { id: "transition-no-source", kind: "transition" as const, label: "No source", renderOrder: 0, renderSourceId: "missing", renderTargetId: "missing" },
        { id: "state-no-render-id", kind: "state" as const, label: "No render ID" },
        { id: "transition-no-render-id", kind: "transition" as const, label: "No render ID", renderOrder: 1, renderSourceId: "state-no-render-id", renderTargetId: "state-no-render-id" }
      ],
      path: "./state.mmd",
      source: "stateDiagram-v2",
      type: "stateDiagram" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup(["state-fallback"]) });

    expectFocusState(container, "state-fallback", "focused");
    expect(container.querySelector('[data-node-id="transition-no-order"]')).toBeNull();
    expect(container.querySelector('[data-node-id="transition-no-source"]')).toBeNull();
    expect(container.querySelector('[data-node-id="transition-no-render-id"]')).toBeNull();
  });

  it("focuses composite self-loop fragments through the composite group data ID", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<g class="statediagram-cluster" id="Work" data-id="Work"><text>Work queue</text></g>',
        '<path data-id="Work-cyclic-special-1" id="loop-start"></path>',
        '<path data-id="Work-cyclic-special-mid" id="loop-middle"></path>',
        '<path data-id="Work-cyclic-special-2" id="loop-end"></path>',
        '<g class="edgeLabel"><g class="label" data-id="Work-cyclic-special-mid">retry</g></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "state-work", kind: "state" as const, label: "Work queue", renderId: "Work" },
        {
          id: "transition-state-work-to-state-work-retry",
          kind: "transition" as const,
          label: "Work queue → Work queue: retry",
          renderOrder: 0,
          renderSourceId: "state-work",
          renderTargetId: "state-work"
        }
      ],
      path: "./state.mmd",
      source: "stateDiagram-v2",
      type: "stateDiagram" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup([diagram.elements[1]!.id]) });

    expectFocusState(container, "state-work", "dimmed");
    expectFocusState(container, "transition-state-work-to-state-work-retry", "focused");
    expect(container.querySelector("#loop-start")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#loop-middle")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#loop-end")!.getAttribute("data-focus-state")).toBe("focused");
  });

  it("maps nested self-loop fragments through the exact child alias", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<g class="statediagram-state" id="state-Reviewing-19"></g>',
        '<path data-id="Reviewing-cyclic-special-1" id="nested-loop-start"></path>',
        '<path data-id="Reviewing-cyclic-special-mid" id="nested-loop-middle"></path>',
        '<path data-id="Reviewing-cyclic-special-2" id="nested-loop-end"></path>',
        '<g class="edgeLabel"><g class="label" data-id="Reviewing-cyclic-special-mid">retry</g></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "state-in-review-reviewing", kind: "state" as const, label: "Reviewing", renderId: "Reviewing" },
        { id: "transition-nested-loop", kind: "transition" as const, label: "Reviewing → Reviewing: retry", renderOrder: 1, renderSourceId: "state-in-review-reviewing", renderTargetId: "state-in-review-reviewing" }
      ],
      path: "./state.mmd",
      source: "stateDiagram-v2",
      type: "stateDiagram" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup(["transition-nested-loop"]) });

    expectFocusState(container, "transition-nested-loop", "focused");
    expect(container.querySelector("#nested-loop-start")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#nested-loop-middle")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#nested-loop-end")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector('.edgeLabel > .label[data-node-id="transition-nested-loop"]')!.getAttribute("data-focus-state")).toBe("focused");
  });

  it("maps state transitions by Mermaid edge identity around notes and split self-loop paths", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg viewBox="0 0 640 480">',
        '<g class="statediagram-state" id="state-Draft-2"><text>Draft</text></g>',
        '<path class="transition" data-edge="" data-id="edge3" id="parallel-later"></path>',
        '<path class="note-edge" data-edge="" data-id="Draft-Draft----note-1" id="note-edge"></path>',
        '<path class="transition" data-edge="" data-id="Draft-cyclic-special-1" id="self-loop-start"></path>',
        '<path class="transition" data-edge="" data-id="Draft-cyclic-special-mid" id="self-loop-middle"></path>',
        '<path class="transition" data-edge="" data-id="Draft-cyclic-special-2" id="self-loop-end"></path>',
        '<path class="transition" data-edge="" data-id="edge2" id="parallel-first-retry"></path>',
        '<path class="transition" data-edge="" data-id="edge0" id="unlabeled-transition"></path>',
        '<g class="edgeLabel"><g class="label" data-id="edge3">retry</g></g>',
        '<g class="edgeLabel"><g class="label" data-id="edge2">retry</g></g>',
        '<g class="edgeLabel"><g class="label" data-id="Draft-cyclic-special-mid">edit</g></g>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "state-draft", kind: "state" as const, label: "Draft", renderId: "Draft" },
        { id: "state-in-review", kind: "state" as const, label: "In review", renderId: "InReview" },
        { id: "transition-state-draft-to-state-in-review-unlabeled", kind: "transition" as const, label: "Draft → In review", renderOrder: 0, renderSourceId: "state-draft", renderTargetId: "state-in-review" },
        { id: "transition-state-draft-to-state-draft-edit", kind: "transition" as const, label: "Draft → Draft: edit", renderOrder: 1, renderSourceId: "state-draft", renderTargetId: "state-draft" },
        { id: "transition-state-draft-to-state-in-review-retry", kind: "transition" as const, label: "Draft → In review: retry", renderOrder: 2, renderSourceId: "state-draft", renderTargetId: "state-in-review" },
        { id: "transition-state-draft-to-state-in-review-retry-2", kind: "transition" as const, label: "Draft → In review: retry", renderOrder: 3, renderSourceId: "state-draft", renderTargetId: "state-in-review" }
      ],
      path: "./review-lifecycle.mmd",
      source: "stateDiagram-v2",
      type: "stateDiagram" as const
    };

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup([diagram.elements[2]!.id]) });

    expect(container.querySelector("#unlabeled-transition")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#parallel-first-retry")!.getAttribute("data-focus-state")).toBe("dimmed");
    expect(container.querySelector("#self-loop-start")!.getAttribute("data-focus-state")).toBe("dimmed");
    expect(container.querySelector("#note-edge")!.hasAttribute("data-focus-state")).toBe(false);

    applyFocusState({ container, focusGroup: createFocusGroup([diagram.elements[3]!.id]) });
    expect(container.querySelector("#self-loop-start")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#self-loop-middle")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#self-loop-end")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#unlabeled-transition")!.getAttribute("data-focus-state")).toBe("dimmed");

    applyFocusState({ container, focusGroup: createFocusGroup([diagram.elements[4]!.id]) });
    expect(container.querySelector("#parallel-first-retry")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector('.edgeLabel [data-id="edge2"]')!.getAttribute("data-focus-state")).toBe("focused");

    applyFocusState({ container, focusGroup: createFocusGroup([diagram.elements[5]!.id]) });
    expect(container.querySelector("#parallel-later")!.getAttribute("data-focus-state")).toBe("focused");
    expect(container.querySelector("#parallel-first-retry")!.getAttribute("data-focus-state")).toBe("dimmed");
    expect(container.querySelector('.edgeLabel [data-id="edge3"]')!.getAttribute("data-focus-state")).toBe("focused");
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

  it("focuses a labeled decision branch independently from its endpoint nodes", async () => {
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "decision", kind: "node" as const, label: "Decision" },
        { id: "approved", kind: "node" as const, label: "Approved" },
        {
          id: "transition-decision-to-approved-yes",
          kind: "transition" as const,
          label: "Decision → Approved: Yes",
          renderId: "L_decision_approved_0",
          renderSourceId: "decision",
          renderTargetId: "approved"
        }
      ],
      path: "./eligibility.mmd",
      source: "flowchart TD\n decision{Eligible?} -->|Yes| approved[Approved]",
      type: "flowchart" as const
    };

    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_decision"></g>',
        '<g class="diagram_tour_node_approved"></g>',
        '<path class="flowchart-link" data-id="L_decision_approved_0"></path>',
        '<g class="edgeLabel" id="label-wrapper"><foreignObject><div data-id="L_decision_approved_0">Yes</div></foreignObject></g>',
        '<path class="flowchart-link" data-id="L_decision_review_0"></path>',
        "</svg>"
      ].join("")
    });

    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({ container, diagram });
    });
    applyFocusState({ container, focusGroup: createFocusGroup(["transition-decision-to-approved-yes"]) });

    const branch = readRequiredElement(container, '.flowchart-link[data-id="L_decision_approved_0"]');
    const branchLabel = readRequiredElement(container, '.edgeLabel[id="label-wrapper"]');
    expect(branch.getAttribute("data-diagram-element-id")).toBe("transition-decision-to-approved-yes");
    expect(branch.getAttribute("data-diagram-element-kind")).toBe("transition");
    expect(branch.getAttribute("data-focus-state")).toBe("focused");
    expect(branch.getAttribute("data-connector-state")).toBe("active");
    expect(branchLabel.getAttribute("data-diagram-element-id")).toBe("transition-decision-to-approved-yes");
    expect(branchLabel.getAttribute("data-focus-state")).toBe("focused");
    expect(branchLabel.getAttribute("data-connector-state")).toBe("active");
    expectFocusState(container, "decision", "dimmed");
    expectFocusState(container, "approved", "dimmed");
    expect(container.querySelector('.flowchart-link[data-id="L_decision_review_0"]')?.hasAttribute("data-diagram-element-id")).toBe(false);
  });

  it("annotates nested flowchart subgraph boundaries without consuming child targets", async () => {
    const container = document.createElement("div");
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="cluster" id="platform">',
      '<rect class="outer-boundary"></rect><g class="cluster-label"><text>Platform</text></g>',
      '<g class="cluster" id="services"><rect class="inner-boundary"></rect>',
      '<g class="cluster-label"><text>Services</text></g></g></g>',
      '<g class="cluster" id="duplicate-one"><rect class="duplicate-one"></rect><g class="cluster-label"><text>Shared</text></g></g>',
      '<g class="cluster" id="duplicate-two"><rect class="duplicate-two"></rect><g class="cluster-label"><text>Shared</text></g></g>',
      '<g class="diagram_tour_node_api"></g>',
      '<path class="flowchart-link" data-id="L_api_worker_0"></path></svg>'
    ].join("") });
    const diagram = {
      elements: [
        { id: "api", kind: "node" as const, label: "API" },
        { id: "group-platform", kind: "group" as const, label: "Platform", renderId: "platform", renderOrder: 0 },
        { id: "group-platform-services", kind: "group" as const, label: "Services", renderId: "services", renderOrder: 1 },
        { id: "group-unrendered-title", kind: "group" as const, label: "Not rendered", renderOrder: 2 },
        { id: "group-unrendered-explicit", kind: "group" as const, label: "Missing", renderId: "missing", renderOrder: 3 },
        { id: "group-shared", kind: "group" as const, label: "Shared", renderOrder: 4 },
        { id: "group-shared-2", kind: "group" as const, label: "Shared", renderOrder: 5 },
        { id: "transition-api-to-worker-unlabeled", kind: "transition" as const, label: "API → Worker", renderId: "L_api_worker_0", renderOrder: 0, renderSourceId: "api", renderTargetId: "worker" }
      ],
      path: "./components.mmd",
      source: "flowchart TB\nsubgraph platform[Platform]\nsubgraph services[Services]\napi --> worker\nend\nend",
      type: "flowchart" as const
    };

    await renderMermaidDiagram({ container, diagram });
    expect(container.querySelector(".outer-boundary")!.getAttribute("data-node-id")).toBe("group-platform");
    expect(container.querySelector(".inner-boundary")!.getAttribute("data-node-id")).toBe("group-platform-services");
    expect(container.querySelector(".duplicate-one")!.getAttribute("data-node-id")).toBe("group-shared");
    expect(container.querySelector(".duplicate-two")!.getAttribute("data-node-id")).toBe("group-shared-2");
    expect(container.querySelector(".diagram_tour_node_api")!.getAttribute("data-node-id")).toBe("api");

    applyFocusState({ container, focusGroup: createFocusGroup(["transition-api-to-worker-unlabeled"]) });
    expect(container.querySelector(".flowchart-link")!.getAttribute("data-node-id")).toBe("transition-api-to-worker-unlabeled");
    expect(container.querySelector(".flowchart-link")!.getAttribute("data-focus-state")).toBe("focused");
  });

  it("maps explicit Unicode Flowchart groups by their members when Mermaid prefixes the native ID", async () => {
    const container = document.createElement("div");
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="cluster" id="flowchart-géo-0"><rect></rect><g class="cluster-label"><text>Area</text></g>',
      '<g class="node"><title>A</title></g><g class="node"><title>B</title></g></g></svg>'
    ].join("") });
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "A", kind: "node", label: "Node A" }, { id: "B", kind: "node", label: "Node B" },
        { id: "group-géo", kind: "group", label: "Area", renderId: "géo", renderMemberIds: ["A", "B"] }
      ], path: "./unicode.mmd", source: "flowchart LR", type: "flowchart"
    } });
    applyFocusState({ container, focusGroup: createFocusGroup(["group-géo"]) });

    expect(readNodeId(container, ".cluster > rect")).toBe("group-géo");
    expectFocusState(container, "group-géo", "focused");
  });

  it("matches an explicit Flowchart title when the native ID differs and membership is empty", async () => {
    const container = document.createElement("div");
    mermaidRender.mockResolvedValueOnce({ svg: '<svg><g class="cluster" id="prefixed"><rect></rect><g class="cluster-label"><text>Empty</text></g></g></svg>' });
    await renderMermaidDiagram({ container, diagram: {
      elements: [{ id: "group-empty", kind: "group", label: "Empty", renderId: "empty" }],
      path: "./empty-group.mmd", source: "flowchart LR", type: "flowchart"
    } });

    expect(readNodeId(container, ".cluster > rect")).toBe("group-empty");
  });

  it("maps repeated title-only groups by their exact contained member IDs when SVG order reverses", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="cluster" id="source-second"><rect class="second-boundary"></rect><g class="cluster-label"><text>Shared</text></g><g class="node"><text>second</text></g></g>',
      '<g class="cluster" id="source-first"><rect class="first-boundary"></rect><g class="cluster-label"><text>Shared</text></g><g class="node"><title>first</title></g></g></svg>'
    ].join("") });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "first", kind: "node", label: "First" },
        { id: "second", kind: "node", label: "Second" },
        { id: "group-shared", kind: "group", label: "Shared", renderMemberIds: ["first"] },
        { id: "group-shared-2", kind: "group", label: "Shared", renderMemberIds: ["second"] }
      ],
      path: "./groups.mmd", source: "flowchart TB", type: "flowchart"
    } });

    expect(container.querySelector(".first-boundary")?.getAttribute("data-node-id")).toBe("group-shared");
    expect(container.querySelector(".second-boundary")?.getAttribute("data-node-id")).toBe("group-shared-2");
  });

  it("maps title-only groups by source classes when Mermaid removes node titles", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="cluster" id="Persistence"><rect class="persistence-boundary"></rect>',
      '<g class="cluster-label"><text>Persistence</text></g><g class="node diagram_tour_node_database"></g></g></svg>'
    ].join("") });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: {
      elements: [{ id: "database", kind: "node", label: "Database" },
        { id: "group-platform-persistence", kind: "group", label: "Persistence", renderMemberIds: ["database"] }],
      path: "./groups.mmd", source: "flowchart TB", type: "flowchart"
    } });

    expect(container.querySelector(".persistence-boundary")?.getAttribute("data-node-id")).toBe("group-platform-persistence");
    expect(container.querySelector(".cluster-label")?.getAttribute("data-node-id")).toBe("group-platform-persistence");
  });

  it("matches title-only groups by exact member centers when Mermaid omits nested nodes", async () => {
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><g class="cluster"><rect id="geometry-boundary"></rect><g class="cluster-label"><text>Persistence</text></g></g>',
      '<g class="cluster"><rect id="outside-boundary"></rect><g class="cluster-label"><text>Outside</text></g></g>',
      '<g class="cluster"><g class="cluster-label"><text>No boundary</text></g></g>',
      '<g class="node diagram_tour_node_database" id="database"></g><g class="node diagram_tour_node_outside" id="outside"></g></svg>'
    ].join("") });
    const container = document.createElement("div");
    const inside = { left: 20, top: 20, right: 40, bottom: 40, width: 20, height: 20 } as DOMRect;
    const outside = { left: 150, top: 150, right: 170, bottom: 170, width: 20, height: 20 } as DOMRect;
    const bounds = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 } as DOMRect;
    const boundsById = new Map([["geometry-boundary", bounds], ["outside-boundary", bounds], ["database", inside]]);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return boundsById.get(this.id) ?? outside;
    });
    await renderMermaidDiagram({ container, diagram: {
      elements: [
        { id: "database", kind: "node", label: "Database" },
        { id: "outside", kind: "node", label: "Outside node" },
        { id: "group-persistence", kind: "group", label: "Persistence", renderMemberIds: ["database"] },
        { id: "group-outside", kind: "group", label: "Outside", renderMemberIds: ["outside"] },
        { id: "group-no-boundary", kind: "group", label: "No boundary", renderMemberIds: ["ghost"] }
      ],
      path: "./groups.mmd", source: "flowchart TB", type: "flowchart"
    } });

    expect(container.querySelector("#geometry-boundary")?.getAttribute("data-node-id")).toBe("group-persistence");
    expect(container.querySelector("#outside-boundary")?.hasAttribute("data-node-id")).toBe(false);
  });

  it("skips flowchart transitions without Mermaid render identity", async () => {
    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [{ id: "transition-no-render-id", kind: "transition", label: "A → B: Yes" }],
        path: "./decision.mmd",
        source: "flowchart TD\n  A -->|Yes| B",
        type: "flowchart"
      }
    });

    expect(container.querySelector('[data-diagram-element-id="transition-no-render-id"]')).toBeNull();
  });

  it("does not focus Mermaid edge-label wrappers when an unlabeled link has no visible label", async () => {
    const container = document.createElement("div");
    mermaidRender.mockResolvedValueOnce({ svg: [
      '<svg><path class="flowchart-link" data-id="L_A_B_0"></path>',
      '<g class="edgeLabel"><g data-id="L_A_B_0"></g></g>',
      '<span class="edgeLabel"></span></svg>'
    ].join("") });
    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [{ id: "transition-A-to-B-unlabeled", kind: "transition", label: "A → B", renderId: "L_A_B_0", renderOrder: 0, renderSourceId: "A", renderTargetId: "B" }],
        path: "./components.mmd",
        source: "flowchart LR\n  A --> B",
        type: "flowchart"
      }
    });

    expect(container.querySelector(".flowchart-link")?.getAttribute("data-node-id")).toBe("transition-A-to-B-unlabeled");
    expect(container.querySelector(".edgeLabel")?.hasAttribute("data-node-id")).toBe(false);
  });

  it("disambiguates duplicate Mermaid edge IDs by endpoints and label order", async () => {
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "A", kind: "node" as const, label: "A" },
        { id: "B", kind: "node" as const, label: "B" },
        { id: "C", kind: "node" as const, label: "C" },
        { id: "D", kind: "node" as const, label: "D" },
        {
          id: "transition-A-to-B-yes",
          kind: "transition" as const,
          label: "A → B: Yes",
          renderId: "L_C_D_0",
          renderSourceId: "A",
          renderTargetId: "B"
        },
        {
          id: "transition-C-to-D-no",
          kind: "transition" as const,
          label: "C → D: No",
          renderId: "L_C_D_0",
          renderSourceId: "C",
          renderTargetId: "D"
        }
      ],
      path: "./render-id-collision.mmd",
      source: "flowchart TD\n A L_C_D_0@-->|Yes| B\n C -->|No| D",
      type: "flowchart" as const
    };

    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" viewBox="0 0 960 640">',
        '<g class="diagram_tour_node_A"></g><g class="diagram_tour_node_B"></g>',
        '<g class="diagram_tour_node_C"></g><g class="diagram_tour_node_D"></g>',
        '<path class="flowchart-link LS-A LE-B" data-id="L_C_D_0"></path>',
        '<path class="flowchart-link LS-C" data-id="L_C_D_0"></path>',
        '<g class="edgeLabel" id="L_C_D_0"><foreignObject><div>Yes</div></foreignObject></g>',
        '<g class="edgeLabel" id="L_C_D_0"><foreignObject><div>No</div></foreignObject></g>',
        "</svg>"
      ].join("")
    });

    await withFlowchartBoundsOnly(async () => {
      await renderMermaidDiagram({ container, diagram });
    });
    applyFocusState({ container, focusGroup: createFocusGroup(["transition-A-to-B-yes"]) });
    const labels = container.querySelectorAll(".edgeLabel");

    expect(readRequiredAttribute(readRequiredElement(container, ".flowchart-link.LS-A.LE-B"), "data-focus-state")).toBe(
      "focused"
    );
    const edgePaths = container.querySelectorAll('.flowchart-link[data-id="L_C_D_0"]');
    expect(readRequiredAttribute(edgePaths[0]!, "data-connector-source-id")).toBe("A");
    expect(readRequiredAttribute(edgePaths[0]!, "data-connector-target-id")).toBe("B");
    expect(readRequiredAttribute(edgePaths[1]!, "data-connector-source-id")).toBe("C");
    expect(readRequiredAttribute(edgePaths[1]!, "data-connector-target-id")).toBe("D");
    expect(readRequiredAttribute(edgePaths[1]!, "data-focus-state")).toBe("dimmed");
    expect(readRequiredAttribute(labels[0]!, "data-focus-state")).toBe("focused");
    expect(readRequiredAttribute(labels[1]!, "data-focus-state")).toBe("dimmed");

    applyFocusState({ container, focusGroup: createFocusGroup(["transition-C-to-D-no"]) });
    expect(readRequiredAttribute(edgePaths[0]!, "data-focus-state")).toBe("dimmed");
    expect(readRequiredAttribute(edgePaths[1]!, "data-focus-state")).toBe("focused");
    expect(readRequiredAttribute(labels[0]!, "data-focus-state")).toBe("dimmed");
    expect(readRequiredAttribute(labels[1]!, "data-focus-state")).toBe("focused");
  });

  it("keeps an unlabeled duplicate-ID connector in diagram context", async () => {
    const container = document.createElement("div");
    const diagram = {
      elements: [
        { id: "A", kind: "node" as const, label: "A" },
        { id: "B", kind: "node" as const, label: "B" },
        { id: "C", kind: "node" as const, label: "C" },
        { id: "D", kind: "node" as const, label: "D" },
        {
          id: "transition-A-to-B-yes",
          kind: "transition" as const,
          label: "A → B: Yes",
          renderId: "L_C_D_0",
          renderSourceId: "A",
          renderTargetId: "B"
        }
      ],
      path: "./render-id-collision-unlabeled.mmd",
      source: "flowchart TD\n A L_C_D_0@-->|Yes| B\n C --> D",
      type: "flowchart" as const
    };
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" viewBox="0 0 960 640">',
        ...["A", "B", "C", "D"].map((id) => `<g class="diagram_tour_node_${id}"></g>`),
        '<path class="flowchart-link" data-id="L_C_D_0"></path>',
        '<path class="flowchart-link" data-id="L_C_D_0"></path>',
        '<g class="edgeLabel" id="L_C_D_0"><foreignObject><div>Yes</div></foreignObject></g>',
        "</svg>"
      ].join("")
    });

    await renderMermaidDiagram({ container, diagram });
    applyFocusState({ container, focusGroup: createFocusGroup(["transition-A-to-B-yes"]) });
    const paths = container.querySelectorAll('.flowchart-link[data-id="L_C_D_0"]');

    expect(paths).toHaveLength(2);
    expect(readRequiredAttribute(paths[0]!, "data-diagram-element-id")).toBe("transition-A-to-B-yes");
    expect(readRequiredAttribute(paths[0]!, "data-connector-source-id")).toBe("A");
    expect(readRequiredAttribute(paths[0]!, "data-connector-target-id")).toBe("B");
    expect(paths[1]!.getAttribute("data-diagram-element-id")).toBeNull();
    expect(paths[1]!.getAttribute("data-focus-state")).toBeNull();
  });

  it("matches a duplicate render ID to source endpoints when Mermaid omits endpoint classes", async () => {
    const container = document.createElement("div");
    const transition = {
      id: "transition-api_gateway-to-validation_service-yes",
      kind: "transition" as const,
      label: "API Gateway → Validation Service: Yes",
      renderId: "L_payment_service_payment_provider_0",
      renderSourceId: "api_gateway",
      renderTargetId: "validation_service"
    };
    const diagram = {
      elements: [
        { id: "api_gateway", kind: "node" as const, label: "API Gateway" },
        { id: "validation_service", kind: "node" as const, label: "Validation Service" },
        { id: "payment_service", kind: "node" as const, label: "Payment Service" },
        { id: "payment_provider", kind: "node" as const, label: "Payment Provider" },
        transition
      ],
      path: "./render-id-collision.mmd",
      source: "flowchart TD",
      type: "flowchart" as const
    };
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" viewBox="0 0 960 640">',
        ...["api_gateway", "validation_service", "payment_service", "payment_provider"].map(
          (id) => `<g class="diagram_tour_node_${id}"></g>`
        ),
        '<path class="flowchart-link" data-id="L_payment_service_payment_provider_0" data-test-order="0"></path>',
        '<path class="flowchart-link" data-id="L_payment_service_payment_provider_0" data-test-order="1"></path>',
        '<g class="edgeLabel" id="L_payment_service_payment_provider_0"><foreignObject><div>Yes</div></foreignObject></g>',
        "</svg>"
      ].join("")
    });

    await withFlowchartGeometryMocks(async () => {
      await renderMermaidDiagram({ container, diagram });
    });
    applyFocusState({ container, focusGroup: createFocusGroup([transition.id]) });
    const paths = container.querySelectorAll('.flowchart-link[data-id="L_payment_service_payment_provider_0"]');

    expect(readRequiredAttribute(paths[0]!, "data-diagram-element-id")).toBe(transition.id);
    expect(readRequiredAttribute(paths[0]!, "data-connector-source-id")).toBe("api_gateway");
    expect(readRequiredAttribute(paths[0]!, "data-connector-target-id")).toBe("validation_service");
    expect(paths[1]!.getAttribute("data-diagram-element-id")).toBeNull();
    expect(readRequiredAttribute(paths[1]!, "data-connector-source-id")).toBe("payment_service");
    expect(readRequiredAttribute(paths[1]!, "data-connector-target-id")).toBe("payment_provider");
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
        '<text class="messageText">[request_sent] Send request</text>',
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

  it("focuses tagged sequence messages while keeping the participant and untagged context visible", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" viewBox="0 0 960 640">',
        '<line class="messageLine0"></line>',
        '<text class="messageText">[request_sent] Send request</text>',
        '<text class="messageText">Untagged response</text>',
        '<text class="noteText">Additional context</text>',
        "</svg>",
        '<div class="actor-top" name="user">User</div>'
      ].join("")
    });
    const container = document.createElement("div");

    await renderMermaidDiagram({ container, diagram: createSequenceDiagram() });
    applyFocusState({ container, focusGroup: createFocusGroup(["request_sent"]) });

    expect(
      container.querySelector('.messageText[data-node-id="request_sent"]')!.getAttribute("data-focus-state")
    ).toBe("focused");
    expect(container.querySelector('.actor-top[data-node-id="user"]')!.getAttribute("data-focus-state")).toBe(
      "dimmed"
    );
    expect(container.querySelector(".messageText:not([data-node-id])")!.hasAttribute("data-focus-state")).toBe(
      false
    );
    expect(container.querySelector(".noteText")!.hasAttribute("data-focus-state")).toBe(false);
  });

  it("uses explicit message ids to disambiguate duplicate labels and removes tags from split text", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: [
        '<svg width="100%" viewBox="0 0 960 640">',
        '<line class="messageLine0"></line>',
        '<line class="messageLine1"></line>',
        '<line class="messageLine0"></line>',
        '<text class="messageText">Repeated label</text>',
        '<text class="messageText"><tspan>[first_</tspan><tspan>message] Repeated label</tspan></text>',
        '<text class="messageText"> <tspan>[formatted_</tspan><tspan>message] Long</tspan><tspan> label</tspan></text>',
        "</svg>"
      ].join("")
    });
    const container = document.createElement("div");

    await renderMermaidDiagram({
      container,
      diagram: {
        elements: [
          { id: "first_message", kind: "message", label: "Repeated label" },
          { id: "formatted_message", kind: "message", label: "Long label" }
        ],
        path: "./sequence.mmd",
        source: "sequenceDiagram",
        type: "sequence"
      }
    });
    applyFocusState({ container, focusGroup: createFocusGroup(["first_message"]) });

    expect(container.querySelectorAll(".messageText")[0]!.hasAttribute("data-node-id")).toBe(false);
    expect(container.querySelector('.messageText[data-node-id="first_message"]')!.textContent).toBe(
      "Repeated label"
    );
    expect(container.querySelector('.messageText[data-node-id="first_message"]')!.getAttribute("data-focus-state")).toBe(
      "focused"
    );
    expect(container.querySelector('.messageText[data-node-id="formatted_message"]')!.textContent).toBe(
      "Long label"
    );
    expect(container.querySelector('.messageText[data-node-id="formatted_message"]')!.getAttribute("data-focus-state")).toBe(
      "dimmed"
    );
    expect(container.querySelectorAll(".messageLine0, .messageLine1")[0]!.hasAttribute("data-node-id")).toBe(
      false
    );
    expect(container.querySelectorAll(".messageLine0, .messageLine1")[1]!.getAttribute("data-node-id")).toBe(
      "first_message"
    );
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
        '<div class="messageText">[request_sent] Send request</div>'
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
        '<text class="messageText">[request_sent] Send request</text>',
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
        '<text class="messageText">[request_sent] Send request</text>',
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
        '<text class="messageText">[request_sent] Send request</text>',
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
        '<text class="messageText">[request_sent] Send request</text>',
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

function readNodeId(container: HTMLElement, selector: string): string | undefined {
  const target = container.querySelector(selector)!;
  return (target as HTMLElement).dataset.nodeId;
}

function readDuplicateC4Bounds(element: SVGElement): number[] {
  const key = element.id || element.parentElement!.id;
  return DUPLICATE_C4_BOUNDS[key]!;
}

const DUPLICATE_C4_BOUNDS: Record<string, number[]> = {
  cloud: [0, 0, 200, 200], external: [400, 0, 40, 40], inside: [10, 10, 40, 40], outside: [300, 0, 40, 40], scope: [0, 0, 200, 200]
};

function readEdgeId(edge: Element): string {
  return edge.querySelector("path.edge")!.id;
}

function hasArrow(edge: Element): boolean {
  return edge.querySelector("polygon.arrow") !== null;
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
    source: "sequenceDiagram\n  user->>api: [request_sent] Send request",
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
    const points = this.getAttribute("data-test-order") === "1" ? [540, 790] : [110, 360];
    return {
      x: points[Number(distance > 0)]!,
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

function expectFocusState(container: HTMLElement, id: string, state: string): void {
  expect(container.querySelector(`[data-node-id="${id}"]`)?.getAttribute("data-focus-state")).toBe(state);
}
