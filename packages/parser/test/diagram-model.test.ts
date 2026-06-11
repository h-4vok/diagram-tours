import { afterEach, describe, expect, it } from "vitest";

import { createDiagramModel, createGeneratedSteps, resolveLoadedTour } from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";
import { restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser diagram model", () => {
  it("extracts unique flowchart nodes in source order", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  api_gateway[API Gateway] --> payment_service[Payment Service]",
        "  api_gateway --> response[Response]"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model).toMatchObject({
      type: "flowchart",
      elements: [
        { id: "api_gateway", kind: "node", label: "API Gateway" },
        { id: "payment_service", kind: "node", label: "Payment Service" },
        { id: "response", kind: "node", label: "Response" }
      ]
    });
  });

  it("extracts flowchart nodes from common shapes and metadata syntax", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  start(Start) --> decision{Decision}",
        "  decision --> cache[(Cache)]",
        "  cache --> worker((Worker))",
        "  worker --> stadium([Stadium])",
        "  stadium --> subroutine[[Subroutine]]",
        "  subroutine --> hexagon{{Hexagon}}",
        "  hexagon --> trapezoid[/Trapezoid\\]",
        "  trapezoid --> parallelogram[\\Parallelogram/]",
        "  metadata@{ shape: rect, label: Metadata Node }"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model).toMatchObject({
      type: "flowchart",
      elements: [
        { id: "start", kind: "node", label: "Start" },
        { id: "decision", kind: "node", label: "Decision" },
        { id: "cache", kind: "node", label: "Cache" },
        { id: "worker", kind: "node", label: "Worker" },
        { id: "stadium", kind: "node", label: "Stadium" },
        { id: "subroutine", kind: "node", label: "Subroutine" },
        { id: "hexagon", kind: "node", label: "Hexagon" },
        { id: "trapezoid", kind: "node", label: "Trapezoid" },
        { id: "parallelogram", kind: "node", label: "Parallelogram" },
        { id: "metadata", kind: "node", label: "Metadata Node" }
      ]
    });
    expect(model.renderSource).toContain("metadata@{ shape: rect, label: Metadata Node }");
  });

  it("extracts flowchart nodes from a full addressability sample with clickable annotations", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  intake[Inbound Intake] --> decision{Decision}",
        "  decision -- Approved --> archive",
        "  decision -- Review --> manual_review[/Manual Review\\]",
        "  manual_review --> queue[(Review Queue)]",
        "  queue --> worker((Worker))",
        '  worker --> done@{ shape: rect, label: "Done" }',
        '  click decision "https://example.com/decision" "Decision rule details"'
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "intake", kind: "node", label: "Inbound Intake" },
      { id: "decision", kind: "node", label: "Decision" },
      { id: "archive", kind: "node", label: "archive" },
      { id: "manual_review", kind: "node", label: "Manual Review" },
      { id: "queue", kind: "node", label: "Review Queue" },
      { id: "worker", kind: "node", label: "Worker" },
      { id: "done", kind: "node", label: "Done" }
    ]);
  });

  it("extracts bare flowchart link endpoints with id fallback labels", () => {
    const model = createDiagramModel(
      ["flowchart LR", "  source --> target", "  target -- Approved --> archive"].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "source", kind: "node", label: "source" },
      { id: "target", kind: "node", label: "target" },
      { id: "archive", kind: "node", label: "archive" }
    ]);
  });

  it("ignores flowchart metadata nodes that do not provide labels", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  unlabeled@{ shape: rect }",
        '  empty@{ shape: rect, label: "" }',
        "  -- detached --> orphan"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([{ id: "orphan", kind: "node", label: "orphan" }]);
  });

  it("keeps first flowchart order and updates duplicate explicit labels", () => {
    const model = createDiagramModel(
      ["flowchart LR", "  source --> target", "  target[Latest Target] --> done[Done]"].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "source", kind: "node", label: "source" },
      { id: "target", kind: "node", label: "Latest Target" },
      { id: "done", kind: "node", label: "Done" }
    ]);
  });

  it("creates generated overview and node focus steps", () => {
    expect(
      createGeneratedSteps([{ id: "api_gateway", kind: "node", label: "API Gateway" }], "Payment Flow")
    ).toEqual([
      {
        focus: [],
        index: 1,
        text: "Overview of Payment Flow."
      },
      {
        focus: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
        index: 2,
        text: "Focus on API Gateway."
      }
    ]);
  });

  it("ignores flowchart non-node statements", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  start[Start] --> finish[Finish]",
        "  class start primary",
        "  classDef primary fill:#fff",
        "  style finish stroke:#333",
        "  linkStyle 0 stroke:#333",
        "  click start call callback()",
        "  subgraph cluster",
        "  direction TB",
        "  end"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "start", kind: "node", label: "Start" },
      { id: "finish", kind: "node", label: "Finish" }
    ]);
  });

  it("extracts sequence participants and strips tagged message ids from render source", () => {
    const model = createDiagramModel(
      [
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway",
        "  user->>api: [request_sent] Send request"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.type).toBe("sequence");
    expect(model.elements).toEqual([
      { id: "user", kind: "participant", label: "User" },
      { id: "api", kind: "participant", label: "API Gateway" },
      { id: "request_sent", kind: "message", label: "Send request" }
    ]);
    expect(model.renderSource).toContain("user->>api: Send request");
    expect(model.renderSource).not.toContain("[request_sent]");
  });

  it("fails on duplicate sequence ids", () => {
    expect(() =>
      createDiagramModel(
        ["sequenceDiagram", "  participant user as User", "  user->>user: [user] Recursive"].join(
          "\n"
        ),
        createTourContext("/tmp/diagram.mmd")
      )
    ).toThrow('Tour "/tmp/diagram.mmd": diagram contains duplicate Mermaid sequence id "user"');
  });

  it("resolves authored tour references into player-ready text and focus", () => {
    const resolved = resolveLoadedTour({
      context: createTourContext("/tmp/tour.tour.yaml"),
      diagramPath: "./diagram.mmd",
      diagramSource: "flowchart LR\n  api_gateway[API Gateway]",
      rawTour: {
        version: 1,
        title: "Valid Tour",
        diagram: "./diagram.mmd",
        steps: [
          {
            focus: ["api_gateway"],
            text: "Focus on {{api_gateway}}."
          }
        ]
      }
    });

    expect(resolved.steps).toEqual([
      {
        focus: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
        index: 1,
        text: "Focus on API Gateway."
      }
    ]);
  });
});
