import { describe, expect, it } from "vitest";

import { createRequirementDiagramModel } from "../src/requirement-diagram-model.js";
import { createDiagramModel, resolveLoadedTour } from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";

describe("Requirement Diagram model", () => {
  it("uses source names for requirement and element targets with readable labels", () => {
    const model = createRequirementDiagramModel([
      "requirementDiagram",
      "requirement REQ_BASE {",
      "  id: 1",
      "  text: A base requirement",
      "  risk: low",
      "  verifyMethod: test",
      "}",
      "functionalRequirement REQ_FUNCTIONAL {",
      "  id: 2",
      "  text: A functional requirement",
      "  risk: high",
      "  verifyMethod: analysis",
      "}",
      "interfaceRequirement REQ_INTERFACE {",
      "  id: 3",
      "  text: An interface requirement",
      "  risk: medium",
      "  verifyMethod: demonstration",
      "}",
      "performanceRequirement REQ_PERFORMANCE {",
      "  id: 4",
      "  text: A performance requirement",
      "  risk: low",
      "  verifyMethod: inspection",
      "}",
      "physicalRequirement REQ_PHYSICAL {",
      "  id: 5",
      "  text: A physical requirement",
      "  risk: medium",
      "  verifyMethod: test",
      "}",
      "designConstraint REQ_CONSTRAINT {",
      "  id: 6",
      "  text: A design constraint",
      "  risk: high",
      "  verifyMethod: analysis",
      "}",
      "element AUTH_SERVICE {",
      "  type: service",
      "  docref: docs/authentication.md",
      "}",
      ""
    ].join("\n"));

    expect(model.type).toBe("requirementDiagram");
    expect(model.renderSource).toContain("verifyMethod: demonstration");
    expect(model.elements.map(({ id, label }) => [id, label])).toEqual([
      ["REQ_BASE", "REQ_BASE — Requirement"],
      ["REQ_FUNCTIONAL", "REQ_FUNCTIONAL — Functional Requirement"],
      ["REQ_INTERFACE", "REQ_INTERFACE — Interface Requirement"],
      ["REQ_PERFORMANCE", "REQ_PERFORMANCE — Performance Requirement"],
      ["REQ_PHYSICAL", "REQ_PHYSICAL — Physical Requirement"],
      ["REQ_CONSTRAINT", "REQ_CONSTRAINT — Design Constraint"],
      ["AUTH_SERVICE", "AUTH_SERVICE — Element"]
    ]);
    expect(model.elements.every(({ kind }) => kind === "node")).toBe(true);
  });

  it("parses all typed relationships, preserving direction and distinct render ordinals", () => {
    const ids = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const source = [
      "requirementDiagram",
      ...ids.flatMap((id) => [`requirement ${id} {`, "}"]),
      "A - contains -> B",
      "C - copies -> D",
      "E - derives -> F",
      "A - satisfies -> C",
      "D - verifies -> E",
      "F - refines -> G",
      "H - traces -> A",
      "B <- contains - H"
    ].join("\n");

    const relationships = createRequirementDiagramModel(source).elements.filter(({ kind }) => kind === "relationship");

    expect(relationships).toMatchObject([
      { id: "relationship-a-contains-b", renderId: "diagram-tour-requirement-edge-0", renderLabel: "contains", renderSourceId: "A", renderTargetId: "B" },
      { id: "relationship-c-copies-d", renderId: "diagram-tour-requirement-edge-1", renderLabel: "copies", renderSourceId: "C", renderTargetId: "D" },
      { id: "relationship-e-derives-f", renderId: "diagram-tour-requirement-edge-2", renderLabel: "derives", renderSourceId: "E", renderTargetId: "F" },
      { id: "relationship-a-satisfies-c", renderId: "diagram-tour-requirement-edge-3", renderLabel: "satisfies", renderSourceId: "A", renderTargetId: "C" },
      { id: "relationship-d-verifies-e", renderId: "diagram-tour-requirement-edge-4", renderLabel: "verifies", renderSourceId: "D", renderTargetId: "E" },
      { id: "relationship-f-refines-g", renderId: "diagram-tour-requirement-edge-5", renderLabel: "refines", renderSourceId: "F", renderTargetId: "G" },
      { id: "relationship-h-traces-a", renderId: "diagram-tour-requirement-edge-6", renderLabel: "traces", renderSourceId: "H", renderTargetId: "A" },
      { id: "relationship-h-contains-b", renderId: "diagram-tour-requirement-edge-7", renderLabel: "contains", renderSourceId: "H", renderTargetId: "B" }
    ]);
  });

  it("keeps arrow-like text inside quoted requirement names out of relationship direction", () => {
    const model = createRequirementDiagramModel([
      "requirementDiagram",
      'requirement "A <- X" {',
      "}",
      "requirement B {",
      "}",
      '"A <- X" - verifies -> B',
      '"A <- X" <- verifies - B'
    ].join("\n"));

    expect(model.elements.filter(({ kind }) => kind === "relationship")).toMatchObject([
      {
        id: "relationship-a-x-verifies-b",
        renderSourceId: "A <- X",
        renderTargetId: "B",
        renderOrder: 0
      },
      {
        id: "relationship-b-verifies-a-x",
        renderSourceId: "B",
        renderTargetId: "A <- X",
        renderOrder: 1
      }
    ]);
  });

  it("exposes only the latest self-link per node with its native path ID and keeps later ordinals", () => {
    const model = createRequirementDiagramModel([
      "requirementDiagram",
      "requirement A {",
      "}",
      "requirement B {",
      "}",
      "A - contains -> A",
      "A - verifies -> A",
      "A - verifies -> B"
    ].join("\n"));

    expect(model.elements.filter(({ kind }) => kind === "relationship")).toMatchObject([
      {
        id: "relationship-a-verifies-a",
        renderId: "A-cyclic-special-mid",
        renderSourceId: "A",
        renderTargetId: "A",
        renderOrder: 1
      },
      {
        id: "relationship-a-verifies-b",
        renderId: "diagram-tour-requirement-edge-2",
        renderSourceId: "A",
        renderTargetId: "B",
        renderOrder: 2
      }
    ]);
    expect(model.elements).not.toContainEqual(expect.objectContaining({ id: "relationship-a-contains-a" }));
  });

  it("disambiguates repeated semantic keys while retaining one render id per relation", () => {
    const model = createRequirementDiagramModel([
      "requirementDiagram",
      "requirement A {",
      "}",
      "requirement B {",
      "}",
      "A - verifies -> B",
      "A - verifies -> B",
      "A - verifies -> B"
    ].join("\n"));

    expect(model.elements.filter(({ kind }) => kind === "relationship")).toMatchObject([
      { id: "relationship-a-verifies-b", renderId: "diagram-tour-requirement-edge-0", renderOrder: 0 },
      { id: "relationship-a-verifies-b-2", renderId: "diagram-tour-requirement-edge-1", renderOrder: 1 },
      { id: "relationship-a-verifies-b-3", renderId: "diagram-tour-requirement-edge-2", renderOrder: 2 }
    ]);
  });

  it("keeps quoted source names, node classes, frontmatter, directives, metadata, and comments out of target keys", () => {
    const model = createRequirementDiagramModel([
      "---",
      "title: Requirement context",
      "---",
      '%%{init: {"theme":"dark"}}%%',
      "requirementDiagram",
      "direction LR",
      "accTitle: Accessible title",
      "accDescr {",
      "Phantom requirement GHOST {",
      "}",
      "}",
      "accDescr { Inline accessibility note }",
      "# source comment",
      "% another comment",
      "%% Mermaid comment",
      'requirement "User Access":::critical {',
      "  id: 20",
      "}",
      "classDef critical fill:#ff0000,color:#ffffff",
      'element "Identity Service" {',
      "  type: service",
      "}",
      '"User Access" - satisfies -> "Identity Service"'
    ].join("\n"));

    expect(model.elements.map(({ id }) => id)).toEqual([
      "User Access",
      "Identity Service",
      "relationship-user-access-satisfies-identity-service"
    ]);
    expect(model.elements[0]?.label).toBe("User Access — Requirement");
    expect(model.elements[2]).toMatchObject({
      renderId: "diagram-tour-requirement-edge-0",
      renderSourceId: "User Access",
      renderTargetId: "Identity Service"
    });
  });

  it("keeps the first node definition and reports undeclared relationship endpoints", () => {
    const duplicate = createRequirementDiagramModel([
      "requirementDiagram",
      "requirement REQ {",
      "}",
      "functionalRequirement REQ {",
      "}",
      "element SVC {",
      "}",
      "REQ - satisfies -> SVC"
    ].join("\n"));

    expect(duplicate.elements[0]?.label).toBe("REQ — Requirement");
    expect(() => createRequirementDiagramModel([
      "requirementDiagram",
      "requirement REQ {",
      "}",
      "REQ - satisfies -> MISSING"
    ].join("\n"))).toThrow('Requirement diagram relation references undeclared ID "MISSING".');
  });

  it("detects requirementDiagram and resolves authored focus and text references", () => {
    const diagramSource = [
      "requirementDiagram",
      "requirement REQ_AUTH {",
      "  text: Authenticate accounts",
      "}",
      "element AUTH_SERVICE {",
      "  type: service",
      "}",
      "AUTH_SERVICE - satisfies -> REQ_AUTH"
    ].join("\n");
    const context = createTourContext("/tmp/payment-requirements.mmd");
    const model = createDiagramModel(diagramSource, context);
    const tour = resolveLoadedTour({
      context,
      diagramPath: "/tmp/payment-requirements.mmd",
      diagramSource,
      rawTour: {
        version: 1,
        title: "Payment access",
        diagram: "payment-requirements.mmd",
        steps: [
          { focus: ["REQ_AUTH"], text: "Implements {{REQ_AUTH}}." },
          { focus: ["relationship-auth-service-satisfies-req-auth"], text: "Traceability: {{relationship-auth-service-satisfies-req-auth}}." }
        ]
      }
    });

    expect(model.type).toBe("requirementDiagram");
    expect(tour.diagram.type).toBe("requirementDiagram");
    expect(tour.steps).toMatchObject([
      { focus: [{ id: "REQ_AUTH" }], text: "Implements REQ_AUTH — Requirement." },
      { focus: [{ id: "relationship-auth-service-satisfies-req-auth" }], text: "Traceability: AUTH_SERVICE — Element — satisfies → REQ_AUTH — Requirement." }
    ]);
    expect(() => resolveLoadedTour({
      context,
      diagramPath: "/tmp/payment-requirements.mmd",
      diagramSource,
      rawTour: {
        version: 1,
        title: "Unknown target",
        diagram: "payment-requirements.mmd",
        steps: [{ focus: ["NOT_REAL"], text: "Inspect {{NOT_REAL}}." }]
      }
    })).toThrow('references unknown Mermaid requirement ID or relationship key "NOT_REAL"');
  });
});
