import { afterEach, describe, expect, it } from "vitest";

import { createDiagramModel, resolveLoadedTour } from "../src/diagram-model.js";
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
