import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadResolvedTour } from "../src/authored-tour-loader.js";
import { createDiagramModel, resolveLoadedTour } from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";

describe("@diagram-tour/parser Entity Relationship diagrams", () => {
  it("extracts entity, scoped attribute, and relationship focus targets", () => {
    const model = createDiagramModel(
      [
        "erDiagram",
        "  CUSTOMER ||--o{ SALES_ORDER : places",
        "  CUSTOMER {",
        '    string customer_id PK "unique customer key"',
        "    string email UK",
        "  }",
        "  SALES_ORDER {",
        "    int order_id PK",
        "    int customer_id FK",
        "  }"
      ].join("\n"),
      createTourContext("/tmp/orders.mmd")
    );

    expect(model.type).toBe("erDiagram");
    expect(model.renderSource).toContain('string customer_id PK "unique customer key"');
    expect(model.elements).toEqual([
      { id: "CUSTOMER", kind: "node", label: "CUSTOMER" },
      { id: "SALES_ORDER", kind: "node", label: "SALES_ORDER" },
      {
        id: "attribute-customer-customer-id",
        kind: "attribute",
        label: "CUSTOMER.customer_id",
        renderOrder: 0,
        renderSourceId: "CUSTOMER",
        renderTargetId: "customer_id"
      },
      {
        id: "attribute-customer-email",
        kind: "attribute",
        label: "CUSTOMER.email",
        renderOrder: 0,
        renderSourceId: "CUSTOMER",
        renderTargetId: "email"
      },
      {
        id: "attribute-sales-order-order-id",
        kind: "attribute",
        label: "SALES_ORDER.order_id",
        renderOrder: 0,
        renderSourceId: "SALES_ORDER",
        renderTargetId: "order_id"
      },
      {
        id: "attribute-sales-order-customer-id",
        kind: "attribute",
        label: "SALES_ORDER.customer_id",
        renderOrder: 0,
        renderSourceId: "SALES_ORDER",
        renderTargetId: "customer_id"
      },
      {
        id: "relationship-customer-to-sales-order-places-one-identifying-zero-or-more",
        kind: "relationship",
        label: "CUSTOMER — places → SALES_ORDER (one, identifying, zero-or-more)",
        renderLinkType: "identifying",
        renderOrder: 0,
        renderLabel: "places",
        renderSourceCardinality: "one",
        renderSourceId: "CUSTOMER",
        renderTargetCardinality: "zero-or-more",
        renderTargetId: "SALES_ORDER"
      }
    ]);
  });

  it("keeps source ids and extracts implicit entities and directed cardinalities", () => {
    const model = createDiagramModel(
      [
        "erDiagram",
        "  Billing-Account }o..|{ Invoice : \"covers %% cycle\" %% trailing comment",
        "  Invoice |o--|| Receipt",
        "  Invoice ||--|{ Line_Item : contains",
        "  Line_Item o|--}| Shipment : ships;"
      ].join("\n"),
      createTourContext("/tmp/relations.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "node").map(({ id }) => id)).toEqual([
      "Billing-Account",
      "Invoice",
      "Receipt",
      "Line_Item",
      "Shipment"
    ]);
    expect(model.elements.filter((element) => element.kind === "relationship")).toMatchObject([
      {
        id: "relationship-billing-account-to-invoice-covers-cycle-zero-or-more-non-identifying-one-or-more",
        label: "Billing-Account — covers %% cycle → Invoice (zero-or-more, non-identifying, one-or-more)",
        renderOrder: 0
      },
      {
        id: "relationship-invoice-to-receipt-relationship-zero-or-one-identifying-one",
        label: "Invoice — relationship → Receipt (zero-or-one, identifying, one)",
        renderOrder: 1
      },
      {
        id: "relationship-invoice-to-line-item-contains-one-identifying-one-or-more",
        label: "Invoice — contains → Line_Item (one, identifying, one-or-more)",
        renderOrder: 2
      },
      {
        id: "relationship-line-item-to-shipment-ships-zero-or-one-identifying-one-or-more",
        label: "Line_Item — ships → Shipment (zero-or-one, identifying, one-or-more)",
        renderOrder: 3
      }
    ]);
    expect(model.renderSource).toContain("%% trailing comment");
  });

  it("disambiguates repeated attributes and same-label relationships in source order", () => {
    const model = createDiagramModel(
      [
        "erDiagram",
        "  A ||--o{ B : owns",
        "  A ||--o{ B : owns",
        "  A {",
        "    string code PK",
        "    string code PK",
        "  }"
      ].join("\n"),
      createTourContext("/tmp/duplicates.mmd")
    );

    expect(model.elements.map(({ id }) => id)).toEqual([
      "A",
      "B",
      "attribute-a-code",
      "attribute-a-code-2",
      "relationship-a-to-b-owns-one-identifying-zero-or-more",
      "relationship-a-to-b-owns-one-identifying-zero-or-more-2"
    ]);
    expect(model.elements.filter((element) => element.kind === "attribute").map(({ renderOrder }) => renderOrder)).toEqual([
      0,
      1
    ]);
  });

  it("supports Mermaid aliases, quoted Unicode entity ids, and primary-key prefixes", () => {
    const model = createDiagramModel(
      [
        "erDiagram",
        '  "Persona con datos" ||--o{ "Orden especial" : "abre órdenes"',
        '  "Persona con datos"["Persona"] {',
        "    string[] tags",
        "    string *identity",
        "  }",
        '  "Orden especial" {',
        "    decimal(10,2) amount",
        "  }",
        '  "Entidad independiente"'
      ].join("\n"),
      createTourContext("/tmp/unicode.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "node")).toEqual([
      { id: "Persona con datos", kind: "node", label: "Persona" },
      { id: "Orden especial", kind: "node", label: "Orden especial" },
      { id: "Entidad independiente", kind: "node", label: "Entidad independiente" }
    ]);
    expect(model.elements.filter((element) => element.kind === "attribute")).toMatchObject([
      { id: "attribute-persona-con-datos-tags", label: "Persona.tags", renderTargetId: "tags" },
      { id: "attribute-persona-con-datos-identity", label: "Persona.identity", renderTargetId: "*identity" },
      { id: "attribute-orden-especial-amount", label: "Orden especial.amount", renderTargetId: "amount" }
    ]);
    expect(model.elements.filter((element) => element.kind === "relationship")[0]).toMatchObject({
      id: "relationship-persona-con-datos-to-orden-especial-abre-ordenes-one-identifying-zero-or-more",
      label: "Persona — abre órdenes → Orden especial (one, identifying, zero-or-more)"
    });
  });

  it("ignores Mermaid context and malformed targets while retaining quoted comments", () => {
    const model = createDiagramModel(
      [
        "%% a Mermaid comment",
        "erDiagram %% header comment",
        "title: Order data",
        "accTitle: Order records",
        "direction LR",
        "  CUSTOMER ||--o{ ORDER : places",
        "  CUSTOMER {",
        '    string note "says hi %% literally" %% trailing comment',
        'title: \\"Escaped %% comment',
        "    not-an-attribute",
        "  }",
        "  invalid relation that is ignored"
      ].join("\n"),
      createTourContext("/tmp/context.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "attribute")).toEqual([
      {
        id: "attribute-customer-note",
        kind: "attribute",
        label: "CUSTOMER.note",
        renderOrder: 0,
        renderSourceId: "CUSTOMER",
        renderTargetId: "note"
      }
    ]);
    expect(model.elements.filter((element) => element.kind === "relationship")).toHaveLength(1);
  });

  it("matches Mermaid 11.13 ER syntax without metadata phantom entities or target collisions", () => {
    const source = [
      "---",
      "title: Orders",
      "---",
      "erDiagram",
      "  ACCDESCR {",
      "    Fake is accessibility copy, not an entity",
      "  }",
      "  A:::hot,two",
      "  D:::warm",
      "  A[First]",
      "  A[Second]",
      "  A { string id string *id array~list of text~ tags string *pk_id chaîne prénom custom-type name }",
      "  A ONE TO MANY B : owns",
      "  A||--o{B : owns",
      "  A:::hot,two ||.-o{ B:::cool : optional link",
      "  A u--|| C : extends",
      "  A ||-.|{ B : dotted link",
      "  A ||--o{ A : relates",
      "  E { string code PK",
      "  }",
      "  F {",
      "    string value }",
      "  G[New alias]",
      "  attribute-a-id"
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/complete-er.mmd"));
    expect(model.elements.filter((element) => element.kind === "node").map(({ id }) => id)).toEqual([
      "A",
      "D",
      "B",
      "C",
      "E",
      "F",
      "G",
      "attribute-a-id"
    ]);
    expect(model.elements.filter((element) => element.kind === "node").find((element) => element.id === "A")?.label)
      .toBe("First");
    expect(model.elements.filter((element) => element.kind === "node").find((element) => element.id === "G")?.label)
      .toBe("New alias");
    expect(model.elements.filter((element) => element.kind === "attribute")).toMatchObject([
      { id: "attribute-a-id-2", label: "First.id", renderTargetId: "id" },
      { id: "attribute-a-id-3", label: "First.id", renderTargetId: "*id" },
      { id: "attribute-a-tags", label: "First.tags", renderTargetId: "tags" },
      { id: "attribute-a-pk-id", label: "First.pk_id", renderTargetId: "*pk_id" },
      { id: "attribute-a-prenom", label: "First.prénom", renderTargetId: "prénom" },
      { id: "attribute-a-name", label: "First.name", renderTargetId: "name" },
      { id: "attribute-e-code", label: "E.code", renderTargetId: "code" },
      { id: "attribute-f-value", label: "F.value", renderTargetId: "value" }
    ]);
    expect(model.elements.filter((element) => element.kind === "relationship"))
      .toHaveLength(6);
    expect(model.elements.filter((element) => element.kind === "relationship").map(({ id }) => id)).toEqual([
      "relationship-a-to-b-owns-one-identifying-zero-or-more",
      "relationship-a-to-b-owns-one-identifying-zero-or-more-2",
      "relationship-a-to-b-optional-link-one-non-identifying-zero-or-more",
      "relationship-a-to-c-extends-unknown-identifying-one",
      "relationship-a-to-b-dotted-link-one-non-identifying-one-or-more",
      "relationship-a-to-a-relates-one-identifying-zero-or-more"
    ]);
  });

  it("keeps native relationship order and models latest self-loops, classes, arrays, and quoted braces", () => {
    const source = [
      "erDiagram",
      "  ACCDESCR {",
      "    attribute-a-id",
      "  }",
      "  A[A]",
      "  A[Second]",
      "  A { string id }",
      "  A ONE TO MANY B : owns",
      "  A ||--o{ B : owns",
      "  A ||--o{ A : earlier loop",
      "  A ||--o{ A : latest loop",
      "  A ||--o{ B : follows loops",
      "  H:::hot { string id PK }",
      "  I:::hot, two",
      "  C {",
      "    int[10] codes",
      "    string code[]",
      "    string note \"} suffix\"",
      "  }"
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/pass-three-er.mmd"));
    const relationships = model.elements.filter((element) => element.kind === "relationship");
    const attributes = model.elements.filter((element) => element.kind === "attribute");

    expect(model.elements.find((element) => element.kind === "node" && element.id === "A")?.label).toBe("A");
    expect(relationships).toMatchObject([
      { renderOrder: 0, renderSourceId: "A", renderTargetId: "B" },
      { renderOrder: 1, renderSourceId: "A", renderTargetId: "B" },
      { id: "relationship-a-to-a-latest-loop-one-identifying-zero-or-more", renderOrder: 3 },
      { id: "relationship-a-to-b-follows-loops-one-identifying-zero-or-more", renderOrder: 4 }
    ]);
    expect(relationships.map(({ id }) => id)).toEqual([
      "relationship-a-to-b-owns-one-identifying-zero-or-more",
      "relationship-a-to-b-owns-one-identifying-zero-or-more-2",
      "relationship-a-to-a-latest-loop-one-identifying-zero-or-more",
      "relationship-a-to-b-follows-loops-one-identifying-zero-or-more"
    ]);
    expect(relationships.some(({ id }) => id.includes("earlier-loop"))).toBe(false);
    expect(attributes).toMatchObject([
      { id: "attribute-a-id", renderTargetId: "id" },
      { id: "attribute-h-id", label: "H.id", renderTargetId: "id" },
      { id: "attribute-c-codes", label: "C.codes", renderTargetId: "codes" },
      { id: "attribute-c-code", label: "C.code[]", renderTargetId: "code[]" },
      { id: "attribute-c-note", label: "C.note", renderTargetId: "note" }
    ]);
    expect(model.elements.some((element) => element.kind === "node" && element.id === "I")).toBe(true);
  });

  it("parses relationships after headers and metadata, same-line entity blocks, and ER entity keywords", () => {
    const source = [
      "erDiagram A ||--o{ B : header relation",
      "accDescr { inline description } A ||--o{ B : metadata relation",
      "A { string id } B { string name }",
      "C { string id } C ||--o{ D : after block",
      "click",
      "href",
      "subgraph",
      "end"
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/header-er.mmd"));

    expect(model.elements.filter((element) => element.kind === "node").map(({ id }) => id)).toEqual([
      "A", "B", "C", "D", "click", "href", "subgraph", "end"
    ]);
    expect(model.elements.filter((element) => element.kind === "attribute")).toMatchObject([
      { id: "attribute-a-id", label: "A.id", renderSourceId: "A", renderTargetId: "id" },
      { id: "attribute-b-name", label: "B.name", renderSourceId: "B", renderTargetId: "name" },
      { id: "attribute-c-id", label: "C.id", renderSourceId: "C", renderTargetId: "id" }
    ]);
    expect(model.elements.filter((element) => element.kind === "relationship")).toMatchObject([
      { renderOrder: 0, renderLabel: "header relation", renderSourceId: "A", renderTargetId: "B" },
      { renderOrder: 1, renderLabel: "metadata relation", renderSourceId: "A", renderTargetId: "B" },
      { renderOrder: 2, renderLabel: "after block", renderSourceId: "C", renderTargetId: "D" }
    ]);
  });

  it("splits same-line relationships and reserves entities after multiline attribute blocks", () => {
    const source = [
      "erDiagram",
      "A ||--o{ B : owns A ||..o{ B : owns",
      "A ||..|{ B : owns",
      "A {",
      "string id } attribute-a-id"
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/relationship-statements.mmd"));

    expect(model.elements.filter((element) => element.kind === "relationship")).toMatchObject([
      { renderOrder: 0, renderLabel: "owns", id: "relationship-a-to-b-owns-one-identifying-zero-or-more" },
      { renderOrder: 1, renderLabel: "owns", id: "relationship-a-to-b-owns-one-non-identifying-zero-or-more" },
      { renderOrder: 2, renderLabel: "owns", id: "relationship-a-to-b-owns-one-non-identifying-one-or-more" }
    ]);
    expect(model.elements.filter((element) => element.kind === "attribute")).toMatchObject([
      { id: "attribute-a-id-2", renderSourceId: "A", renderTargetId: "id" }
    ]);
    expect(model.elements.filter((element) => element.kind === "node").map(({ id }) => id)).toEqual([
      "A", "B", "attribute-a-id"
    ]);
  });

  it("ignores relationship syntax in quoted text and resumes after relation roles", () => {
    const source = [
      "erDiagram",
      "%% fake X ||--o{ Y comment",
      'A { string id "see X ||--o{ Y" int age }',
      'A["X ||--o{ Y"]',
      'A ||--o{ B : "see X ||--o{ Y"',
      "A ||--o{ B : later NEXT { string code }",
      "A ||--o{ B : after quote"
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/quoted-relations.mmd"));

    expect(model.elements.filter((element) => element.kind === "node").map(({ id }) => id)).toEqual([
      "A", "B", "NEXT"
    ]);
    expect(model.elements.filter((element) => element.kind === "attribute").map(({ id, renderTargetId }) => ({
      id,
      renderTargetId
    }))).toEqual([
      { id: "attribute-a-id", renderTargetId: "id" },
      { id: "attribute-a-age", renderTargetId: "age" },
      { id: "attribute-next-code", renderTargetId: "code" }
    ]);
    expect(model.elements.filter((element) => element.kind === "relationship").map(({ renderOrder, renderSourceId, renderTargetId }) => ({
      renderOrder,
      renderSourceId,
      renderTargetId
    }))).toEqual([
      { renderOrder: 0, renderSourceId: "A", renderTargetId: "B" },
      { renderOrder: 1, renderSourceId: "A", renderTargetId: "B" },
      { renderOrder: 2, renderSourceId: "A", renderTargetId: "B" }
    ]);
  });

  it("normalizes Mermaid role formatting and retains native relationship semantics", () => {
    const model = createDiagramModel([
      "erDiagram",
      "A ||--o{ B : **owns**",
      "A ||--o{ B : *owns*",
      "A ||--o{ B : _owns_",
      "A ||--o{ B : owns &amp; sells",
      "A ||--o{ B : owns__many",
      "A ||--o{ B : owns   many",
      "A ||--o{ B : owns<br/>many",
      "A ONE TO MANY B : one to many",
      "A ||..o{ B : dashed",
      "A u--|| B : unknown"
    ].join("\n"), createTourContext("/tmp/role-rendering.mmd"));
    const relationships = model.elements.filter((element) => element.kind === "relationship");

    expect(relationships.map(({ renderLabel }) => renderLabel)).toEqual([
      "owns", "owns", "owns", "owns & sells", "owns__many", "owns many", "owns many",
      "one to many", "dashed", "unknown"
    ]);
    expect(relationships[0]).toMatchObject({
      id: "relationship-a-to-b-owns-one-identifying-zero-or-more",
      label: "A — owns → B (one, identifying, zero-or-more)",
      renderLinkType: "identifying",
      renderSourceCardinality: "one",
      renderTargetCardinality: "zero-or-more"
    });
    expect(relationships[7]).toMatchObject({
      renderSourceCardinality: "one",
      renderTargetCardinality: "zero-or-more",
      renderLinkType: "identifying"
    });
    expect(relationships[8]).toMatchObject({ renderLinkType: "non-identifying" });
    expect(relationships[9]).toMatchObject({ renderSourceCardinality: "unknown" });
  });

  it("resolves authored entity, attribute, and relationship focus and text references", async () => {
    const tour = await loadResolvedTour(
      resolve(process.cwd(), "../web-player/test/fixtures/entity-relationship/orders.tour.yaml")
    );

    expect(tour.diagram.type).toBe("erDiagram");
    expect(tour.steps[1]?.focus.map(({ id }) => id)).toEqual([
      "attribute-customer-customer-id",
      "attribute-customer-email"
    ]);
    expect(tour.steps.at(-1)!.focus[0]!.kind).toBe("relationship");
    expect(tour.steps.at(-1)!.text).toContain("places many sales orders");
  });

  it("reports unknown ER focus and text references with actionable target names", expectUnknownErReference);
});

function expectUnknownErReference(): void {
  expect(() => resolveLoadedTour({
      context: createTourContext("/tmp/orders.tour.yaml"),
      diagramPath: "/tmp/orders.mmd",
      diagramSource: "erDiagram\n  CUSTOMER",
      rawTour: {
        version: 1,
        title: "Orders",
        diagram: "./orders.mmd",
        steps: [{ focus: ["missing"], text: "{{missing}}" }]
      }
  })).toThrow('references unknown Mermaid entity ID, attribute key, or relationship key "missing"');
}
