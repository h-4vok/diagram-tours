import { afterEach, describe, expect, it } from "vitest";

import { createDiagramModel, resolveLoadedTour } from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";
import { restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("sequence diagram models", () => {
  it("keeps focus targets in source order and preserves visual context", () => {
    const source = [
      "sequenceDiagram",
      "  participant customer as Customer",
      "  customer->>+api: [submit_order] Submit order",
      "  actor api as Order API",
      "  create participant audit as Audit Service",
      "  Note right of api: [internal_note] Validated request",
      "  activate api",
      "  alt Accepted",
      "    api-->>-customer: [order_accepted] Order accepted",
      "  else Rejected",
      "    api-->>customer: Retry later",
      "  end"
    ].join("\n");

    const model = createDiagramModel(source, createTourContext("/tmp/sequence.mmd"));

    expect(model.type).toBe("sequence");
    expect(model.elements).toEqual([
      { id: "customer", kind: "participant", label: "Customer" },
      { id: "submit_order", kind: "message", label: "Submit order" },
      { id: "api", kind: "participant", label: "Order API" },
      { id: "audit", kind: "participant", label: "Audit Service" },
      { id: "order_accepted", kind: "message", label: "Order accepted" }
    ]);
    expect(model.renderSource).toBe(source);
  });

  it("uses source ids for unaliased participants and ignores untagged messages", () => {
    const model = createDiagramModel(
      [
        "sequenceDiagram",
        "  participant queue",
        "  queue-->>queue: No message id",
        "  queue-x queue: [failure] Dead letter",
        "  Note over queue: [note_id] Diagnostic context"
      ].join("\n"),
      createTourContext("/tmp/sequence.mmd")
    );

    expect(model.elements).toEqual([
      { id: "queue", kind: "participant", label: "queue" },
      { id: "failure", kind: "message", label: "Dead letter" }
    ]);
    expect(model.renderSource).toContain("queue-->>queue: No message id");
    expect(model.renderSource).toContain("queue-x queue: [failure] Dead letter");
    expect(model.renderSource).toContain("Note over queue: [note_id] Diagnostic context");
  });

  it("preserves replacement tokens in message labels and the original render source", () => {
    const source = "sequenceDiagram\n  participant billing\n  billing->>billing: [price_check] Price is $&";
    const model = createDiagramModel(source, createTourContext("/tmp/sequence.mmd"));

    expect(model.elements).toEqual([
      { id: "billing", kind: "participant", label: "billing" },
      { id: "price_check", kind: "message", label: "Price is $&" }
    ]);
    expect(model.renderSource).toBe(source);
  });

  it("resolves authored participant and tagged-message focus and text references", () => {
    const tour = resolveLoadedTour({
      context: createTourContext("/tmp/sequence.tour.yaml"),
      diagramPath: "./sequence.mmd",
      diagramSource: "sequenceDiagram\n  participant api as Order API\n  api->>api: [validate] Validate request",
      rawTour: {
        version: 1,
        title: "Order sequence",
        diagram: "./sequence.mmd",
        steps: [
          { focus: ["api"], text: "{{api}} receives the request." },
          { focus: ["validate"], text: "{{validate}} checks the order." }
        ]
      }
    });

    expect(tour.steps).toEqual([
      {
        focus: [{ id: "api", kind: "participant", label: "Order API" }],
        index: 1,
        text: "Order API receives the request."
      },
      {
        focus: [{ id: "validate", kind: "message", label: "Validate request" }],
        index: 2,
        text: "Validate request checks the order."
      }
    ]);
  });

  it("reports unknown focus and text ids with sequence-specific guidance", () => {
    const makeTour = (focus: string[], text: string) =>
      resolveLoadedTour({
        context: createTourContext("/tmp/sequence.tour.yaml"),
        diagramPath: "./sequence.mmd",
        diagramSource: "sequenceDiagram\n  participant api as Order API",
        rawTour: {
          version: 1,
          title: "Order sequence",
          diagram: "./sequence.mmd",
          steps: [{ focus, text }]
        }
      });

    expect(() => makeTour(["missing"], "Unknown focus target.")).toThrow(
      'step 1 focus references unknown Mermaid participant or message id "missing"'
    );
    expect(() => makeTour([], "Unknown {{missing}} target.")).toThrow(
      'step 1 text references unknown Mermaid participant or message id "missing"'
    );
  });

  it("rejects ids duplicated across participant and message targets", () => {
    expect(() =>
      createDiagramModel(
        "sequenceDiagram\n  participant api as Order API\n  api->>api: [api] Recursive call",
        createTourContext("/tmp/sequence.mmd")
      )
    ).toThrow('diagram contains duplicate Mermaid sequence id "api"');
  });
});
