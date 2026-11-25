import { afterEach, describe, expect, it } from "vitest";

import { createDiagramModel, resolveLoadedTour } from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";
import { restoreParserTestState } from "./parser-test-support.js";

const source = [
  "zenuml",
  "title Checkout",
  "// source comment",
  "@Actor Customer",
  "UI as Checkout",
  "while(cartHasItems) {",
  "  OrderService.submit() {",
  "    Inventory.reserve()",
  "    if(inventoryAvailable) {",
  "      PaymentGateway.authorize()",
  "      return receipt",
  "    } else {",
  "      PaymentGateway.decline()",
  "    }",
  "  }",
  "}"
].join("\n");

afterEach(restoreParserTestState);

describe("ZenUML diagram models", () => {
  it("detects ZenUML, preserves full source, and extracts actors, interactions, and named groups", () => {
    const model = createDiagramModel(source, createTourContext("/tmp/checkout.mmd"));

    expect(model.type).toBe("zenuml");
    expect(model.renderSource).toBe(source);
    expect(model.elements).toEqual([
      { id: "actor-customer", kind: "participant", label: "Customer" },
      { id: "actor-ui", kind: "participant", label: "Checkout" },
      { id: "block-while-cart-has-items", kind: "group", label: "While: cartHasItems" },
      { id: "actor-order-service", kind: "participant", label: "OrderService" },
      { id: "interaction-while-cart-has-items-order-service-submit", kind: "message", label: "submit()" },
      { id: "actor-inventory", kind: "participant", label: "Inventory" },
      { id: "interaction-while-cart-has-items-order-service-submit-inventory-reserve", kind: "message", label: "reserve()" },
      { id: "block-while-cart-has-items-order-service-submit-if-inventory-available", kind: "group", label: "If: inventoryAvailable" },
      { id: "actor-payment-gateway", kind: "participant", label: "PaymentGateway" },
      { id: "interaction-while-cart-has-items-order-service-submit-if-inventory-available-payment-gateway-authorize", kind: "message", label: "authorize()" },
      { id: "interaction-while-cart-has-items-order-service-submit-if-inventory-available-return-receipt", kind: "message", label: "receipt" },
      { id: "interaction-while-cart-has-items-order-service-submit-if-inventory-available-payment-gateway-decline", kind: "message", label: "decline()" }
    ]);
  });

  it("retains named actor identities and disambiguates repeated interaction keys", () => {
    const model = createDiagramModel(
      ["zenuml", "A as Alice", "A->B: ping", "A->B: ping", "new B", "return value"].join("\n"),
      createTourContext("/tmp/repeated.mmd")
    );

    expect(model.elements).toEqual([
      { id: "actor-a", kind: "participant", label: "Alice" },
      { id: "actor-b", kind: "participant", label: "B" },
      { id: "interaction-a-b-ping", kind: "message", label: "ping" },
      { id: "interaction-a-b-ping-2", kind: "message", label: "ping" },
      { id: "interaction-new-b", kind: "message", label: "B" },
      { id: "interaction-return-value", kind: "message", label: "value" }
    ]);
  });

  it("closes an if/else frame before parsing later interactions", () => {
    const model = createDiagramModel(
      [
        "zenuml",
        "if(ready) {",
        "  Service.begin()",
        "} else {",
        "  Service.abort()",
        "}",
        "Service.finish()"
      ].join("\n"),
      createTourContext("/tmp/if-else.mmd")
    );

    expect(model.elements.map((element) => element.id)).toEqual([
      "block-if-ready",
      "actor-service",
      "interaction-if-ready-service-begin",
      "interaction-if-ready-service-abort",
      "interaction-service-finish"
    ]);
  });

  it("covers anonymous frames, alternate branches, unlabeled messages, and standalone ZenUML statements", () => {
    const model = createDiagramModel(
      [
        "zenuml",
        "Alice",
        "@Database Store",
        "Alice->Store",
        "Store.lookup",
        "opt {",
        "  SomeType result = Store.find()",
        "  if(firstCondition) {",
        "  } else if(secondCondition) {",
        "    return result",
        "  } else {",
        "    return",
        "    new Created",
        "  }",
        "} catch {",
        "} finally {",
        "}",
        "unsupported statement"
      ].join("\n"),
      createTourContext("/tmp/edge-cases.mmd")
    );

    expect(model.elements.map((element) => element.kind)).toEqual([
      "participant", "participant", "message", "message", "message", "group", "group", "message", "message", "participant", "message"
    ]);
    expect(model.elements.some((element) => element.label === "Else if: secondCondition")).toBe(true);
    expect(model.elements.some((element) => element.id === "block-opt-anonymous-if-first-condition-else-if-second-condition")).toBe(true);
    expect(model.elements.some((element) => element.label === "return")).toBe(true);
    expect(model.elements.map((element) => element.id)).toContain("actor-created");
  });

  it("resolves authored focus and text references and diagnoses unknown targets", () => {
    const tour = {
      version: 1,
      title: "Checkout",
      diagram: "./checkout.mmd",
      steps: [
        { focus: ["block-while-cart-has-items"], text: "{{actor-customer}} submits an order." },
        { focus: ["interaction-while-cart-has-items-order-service-submit"], text: "{{actor-order-service}} submits." }
      ]
    };
    const resolved = resolveLoadedTour({
      context: createTourContext("/tmp/checkout.tour.yaml"),
      diagramPath: "./checkout.mmd",
      diagramSource: source,
      rawTour: tour
    });

    expect(resolved.diagram.type).toBe("zenuml");
    expect(resolved.steps.map((step) => [step.focus[0]?.id, step.text])).toEqual([
      ["block-while-cart-has-items", "Customer submits an order."],
      ["interaction-while-cart-has-items-order-service-submit", "OrderService submits."]
    ]);
    expect(() => resolveLoadedTour({
      context: createTourContext("/tmp/checkout.tour.yaml"),
      diagramPath: "./checkout.mmd",
      diagramSource: source,
      rawTour: { ...tour, steps: [{ focus: ["not-a-target"], text: "{{also-unknown}}" }] }
    })).toThrow('unknown Mermaid ZenUML actor, interaction, or block key "not-a-target"');
    expect(() => resolveLoadedTour({
      context: createTourContext("/tmp/checkout.tour.yaml"),
      diagramPath: "./checkout.mmd",
      diagramSource: source,
      rawTour: { ...tour, steps: [{ focus: [], text: "{{not-a-text-target}}" }] }
    })).toThrow('unknown Mermaid ZenUML actor, interaction, or block key "not-a-text-target"');
  });
});
