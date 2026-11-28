import { describe, expect, it } from "vitest";

import { loadResolvedTour } from "../src/index.js";
import { createDiagramModel, createUnknownElementMessage } from "../src/diagram-model.js";
import { createGeneratedDiagramTour } from "../src/generated-tours.js";
import { createTourContext } from "../src/tour-context.js";
import { ARCHITECTURE_FIXTURE_TOUR_PATH, createTempTour } from "./parser-test-support.js";

describe("architecture diagram model", () => {
  it("detects architecture-beta and preserves unsupported visual syntax", () => {
    const source = "architecture-beta\nservice web(server)[Web]\nalign LR";
    const model = createDiagramModel(source, createTourContext("/tmp/architecture.mmd"));

    expect(model.type).toBe("architecture");
    expect(model.renderSource).toBe(source);
    expect(model.elements).toEqual([{ id: "service-web", kind: "node", label: "Web" }]);
  });

  it("parses Mermaid 11.13 spacing and ignores trailing comments without shifting connection keys", () => {
    const model = createDiagramModel([
      "architecture-beta",
      "service a (server) [API]",
      "service b(database)[DB]",
      "a : R --> L : b %% valid connection",
      "%% a:R --> L:b",
      "a:R --> L:b"
    ].join("\n"), createTourContext("/tmp/architecture.mmd"));

    expect(model.elements.map(({ id, label }) => [id, label])).toEqual([
      ["service-a", "API"], ["service-b", "DB"], ["connection-1", "a:R → b:L"], ["connection-2", "a:R → b:L"]
    ]);
  });

  it("preserves comment markers inside quoted service labels", () => {
    const model = createDiagramModel('architecture-beta\nservice a(server)["API %% Gateway"] %% trailing comment', createTourContext("/tmp/architecture.mmd"));
    expect(model.elements).toEqual([{ id: "service-a", kind: "node", label: "API %% Gateway" }]);
  });

  it("honors escaped characters while scanning quoted comments", () => {
    const model = createDiagramModel(String.raw`architecture-beta
service a(server)['API \X %% Gateway'] %% trailing comment`, createTourContext("/tmp/architecture.mmd"));
    expect(model.elements).toEqual([{ id: "service-a", kind: "node", label: "API \\X %% Gateway" }]);
  });

  it("parses spaced group traversal markers and diagnoses generated edge ID collisions", async () => {
    const source = ["architecture-beta", "service a_b(server)[A]", "service c(database)[C]", "service a(server)[A2]", "service b_c(database)[C2]",
      "a_b {group} : R --> L : c", "a : R --> L : b_c"].join("\n");
    const tourPath = await createTempTour({ mermaid: source, yaml: ["version: 1", "title: Collision", "diagram: ./diagram.mmd", "steps:",
      "  - focus: [connection-1]", "    text: Connection."].join("\n") });
    expect(createDiagramModel(source, createTourContext("/tmp/architecture.mmd")).elements.find(({ id }) => id === "connection-1"))
      .toMatchObject({ renderSourceGroup: true });
    const resolved = await loadResolvedTour(tourPath);
    expect(resolved.diagram.elements.filter(({ kind }) => kind === "transition")).toHaveLength(2);
  });

  it("extracts groups, services, junctions, and full connection metadata in source order", () => {
    const model = createDiagramModel([
      "architecture-beta",
      "group root(cloud)[Platform]",
      "group nested(server)[Runtime] in root",
      "service app(server)[Application] in nested",
      "junction split in nested",
      "service db(database)[Database]",
      "app:R --> L:split",
      "split{group}:B <-- T:db{group}",
      "app:T <--> B:db"
    ].join("\n"), createTourContext("/tmp/architecture.mmd"));

    expect(model.type).toBe("architecture");
    expect(model.elements).toEqual([
      { id: "group-root", kind: "group", label: "Platform" },
      { id: "group-nested", kind: "group", label: "Runtime" },
      { id: "service-app", kind: "node", label: "Application" },
      { id: "junction-split", kind: "junction", label: "split" },
      { id: "service-db", kind: "node", label: "Database" },
      {
        id: "connection-1", kind: "transition", label: "app:R → split:L", renderId: "L_app_split_0", renderOrder: 1,
        renderSourceId: "app", renderTargetId: "split", renderSourcePort: "R", renderTargetPort: "L",
        renderSourceArrow: false, renderTargetArrow: true, renderSourceGroup: false, renderTargetGroup: false
      },
      {
        id: "connection-2", kind: "transition", label: "split:B → db:T", renderId: "L_split_db_0", renderOrder: 2,
        renderSourceId: "split", renderTargetId: "db", renderSourcePort: "B", renderTargetPort: "T",
        renderSourceArrow: true, renderTargetArrow: false, renderSourceGroup: true, renderTargetGroup: true
      },
      {
        id: "connection-3", kind: "transition", label: "app:T → db:B", renderId: "L_app_db_0", renderOrder: 3,
        renderSourceId: "app", renderTargetId: "db", renderSourcePort: "T", renderTargetPort: "B",
        renderSourceArrow: true, renderTargetArrow: true, renderSourceGroup: false, renderTargetGroup: false
      }
    ]);
  });

  it("uses stable IDs when display labels repeat and falls back to IDs", () => {
    const model = createDiagramModel([
      "architecture-beta",
      "service alpha(server)[Same label]",
      "service beta(server)[Same label]",
      "group unnamed(cloud)",
      "junction fork"
    ].join("\n"), createTourContext("/tmp/architecture.mmd"));

    expect(model.elements.map(({ id, label }) => [id, label])).toEqual([
      ["service-alpha", "Same label"], ["service-beta", "Same label"], ["group-unnamed", "unnamed"], ["junction-fork", "fork"]
    ]);
  });

  it("keeps parallel connection keys independent for identical endpoints", () => {
    const model = createDiagramModel([
      "architecture-beta", "service app(server)[App]", "service db(database)[DB]",
      "app:R --> L:db", "app:B -- T:db"
    ].join("\n"), createTourContext("/tmp/architecture.mmd"));
    const connections = model.elements.filter(({ kind }) => kind === "transition");

    expect(connections.map(({ id, renderSourceId, renderTargetId, renderSourcePort, renderTargetPort }) =>
      [id, renderSourceId, renderTargetId, renderSourcePort, renderTargetPort]
    )).toEqual([
      ["connection-1", "app", "db", "R", "L"], ["connection-2", "app", "db", "B", "T"]
    ]);
  });

  it("rejects renderer-colliding edge IDs with a junction diagnostic", async () => {
    const tourPath = await createTempTour({
      mermaid: ["architecture-beta", "service app(server)[App]", "service db(database)[DB]",
        "app:R --> L:db", "app:B -- T:db"].join("\n"),
      yaml: ["version: 1", "title: Parallel routes", "diagram: ./diagram.mmd", "steps:",
        "  - focus: [connection-1]", "    text: First route."].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow("route parallel connections through a junction");
  });

  it("keeps underscore endpoint pairs that share an SVG edge ID independently addressable", async () => {
    const tourPath = await createTempTour({
      mermaid: ["architecture-beta", "service a_b(server)[A-B]", "service c(database)[C]",
        "service a(server)[A]", "service b_c(database)[B-C]", "a_b:R --> L:c", "a:R --> L:b_c"].join("\n"),
      yaml: ["version: 1", "title: Colliding routes", "diagram: ./diagram.mmd", "steps:",
        "  - focus: [connection-1]", "    text: First route."].join("\n")
    });

    const tour = await loadResolvedTour(tourPath);
    expect(tour.diagram.elements.filter(({ kind }) => kind === "transition").map(({ id, renderId }) => [id, renderId])).toEqual([
      ["connection-1", "L_a_b_c_0"], ["connection-2", "L_a_b_c_0"]
    ]);
  });

  it("rejects distinct hyphen endpoint pairs that collide in Mermaid's native identity", async () => {
    const tourPath = await createTempTour({
      mermaid: ["architecture-beta", "service a-b(server)[A-B]", "service c(database)[C]", "service a(server)[A]", "service b-c(database)[B-C]",
        "a-b:R --> L:c", "a:R --> L:b-c"].join("\n"),
      yaml: ["version: 1", "title: Colliding routes", "diagram: ./diagram.mmd", "steps:",
        "  - focus: [connection-1]", "    text: First route."].join("\n")
    });
    await expect(loadResolvedTour(tourPath)).rejects.toThrow("connection IDs collide");
  });

  it("rejects a generated preview when a service ID collides with an edge ID", () => {
    expect(() => createGeneratedDiagramTour({
      diagramPath: "collision.mmd",
      diagramSource: ["architecture-beta", "service a-b(server)[Combined]", "service a(server)[A]", "service b(server)[B]", "a:R --> L:b"].join("\n"),
      title: "Collision"
    })).toThrow("route parallel connections through a junction");
  });

  it("rejects junction IDs that collide with raw renderer edge identities", () => {
    expect(() => createGeneratedDiagramTour({
      diagramPath: "collision.mmd",
      diagramSource: ["architecture-beta", "junction aa-bb", "service aa(server)[A]", "service bb(database)[B]", "aa:R --> L:bb"].join("\n"),
      title: "Collision"
    })).toThrow("junction");
  });

  it("keeps junction routes whose source IDs are separate from edge identities", () => {
    expect(() => createGeneratedDiagramTour({
      diagramPath: "junction.mmd",
      diagramSource: ["architecture-beta", "junction split", "service aa(server)[A]", "service bb(database)[B]", "aa:R --> L:split", "split:R --> L:bb"].join("\n"),
      title: "Junction"
    })).not.toThrow();
  });

  it("does not classify an empty hyphenated group ID as a collision without an edge", async () => {
    const tourPath = await createTempTour({
      mermaid: ["architecture-beta", "group aa-bb(cloud)[Empty]", "service aa(server)[A]", "service bb(database)[B]"].join("\n"),
      yaml: ["version: 1", "title: Empty group", "diagram: ./diagram.mmd", "steps:",
        "  - focus: [group-aa-bb]", "    text: Empty group."].join("\n")
    });
    const tour = await loadResolvedTour(tourPath);
    expect(tour.steps[0]?.focus[0]?.id).toBe("group-aa-bb");
    expect(tour.diagram.elements.find(({ id }) => id === "group-aa-bb")).toMatchObject({ kind: "group", label: "Empty" });
  });

  it("rejects a populated group ID that collides with a generated edge identity", async () => {
    const tourPath = await createTempTour({
      mermaid: ["architecture-beta", "group a-b(cloud)[Other]", "service c(server)[C] in a-b", "service a(server)[A]", "service b(database)[B]", "a:R --> L:b"].join("\n"),
      yaml: ["version: 1", "title: Group collision", "diagram: ./diagram.mmd", "steps:",
        "  - focus: [connection-1]", "    text: Route."].join("\n")
    });
    await expect(loadResolvedTour(tourPath)).rejects.toThrow("connection IDs collide");
  });

  it("resolves authored focus keys and text references from the architecture example", async () => {
    const tour = await loadResolvedTour(ARCHITECTURE_FIXTURE_TOUR_PATH);

    expect(tour.diagram.type).toBe("architecture");
    expect(tour.steps.map(({ focus }) => focus[0]?.id)).toEqual([
      "group-platform", "service-app", "junction-split", "connection-1", "connection-2", "connection-3", "connection-4"
    ]);
    expect(tour.steps[4]?.text).toContain("split:B → cache:T");
  });

  it("gives actionable diagnostics for unknown architecture focus keys", () => {
    expect(createUnknownElementMessage({
      context: createTourContext("/tmp/architecture.tour.yaml"), diagramType: "architecture",
      elementId: "ghost", kind: "focus", stepIndex: 1
    })).toContain('references unknown Mermaid architecture service, group, junction, or connection key "ghost"');
  });
});
