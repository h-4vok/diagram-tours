import { describe, expect, it } from "vitest";

import { loadResolvedTour } from "../src/index.js";
import { createDiagramModel, createUnknownElementMessage } from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";
import { C4_FIXTURE_TOUR_PATH, createTempTour } from "./parser-test-support.js";

describe("C4 diagram model", () => {
  it("gives actionable guidance for unknown C4 keys", () => {
    expect(createUnknownElementMessage({
      context: createTourContext("/tmp/c4.tour.yaml"),
      diagramType: "c4",
      elementId: "ghost",
      kind: "focus",
      stepIndex: 2
    })).toContain('references unknown Mermaid C4 person, system, container, component, deployment, boundary, or relationship key "ghost"');
  });

  it("keys external, database, queue, and node variants by source alias", () => {
    const model = createDiagramModel([
      "C4Deployment",
      'System_Ext(systemExt, "External system")',
      'SystemDb_Ext(systemDbExt, "External database")',
      'SystemQueue(systemQueue, "Event, queue")',
      'SystemQueue_Ext(systemQueueExt, "External queue")',
      'Container_Ext(containerExt, "External container")',
      'ContainerDb(containerDb, "Database container")',
      'ContainerDb_Ext(containerDbExt, "External database container")',
      'ContainerQueue(containerQueue, "Queue container")',
      'ContainerQueue_Ext(containerQueueExt, "External queue container")',
      'Component_Ext(componentExt, "External component")',
      'ComponentDb(componentDb, "Database component")',
      'ComponentDb_Ext(componentDbExt, "External database component")',
      'ComponentQueue(componentQueue, "Queue component")',
      'ComponentQueue_Ext(componentQueueExt, "External queue component")',
      'Node(node, "Deployment node")',
      'Node_R(nodeRight, "Right node")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id }) => id)).toEqual([
      "system-systemExt", "system-systemDbExt", "system-systemQueue", "system-systemQueueExt",
      "container-containerExt", "container-containerDb", "container-containerDbExt",
      "container-containerQueue", "container-containerQueueExt", "component-componentExt",
      "component-componentDb", "component-componentDbExt", "component-componentQueue",
      "component-componentQueueExt", "deployment-node", "deployment-nodeRight"
    ]);
    expect(model.elements[2]?.label).toBe("Event, queue");
  });

  it("resolves the shared C4 fixture's authored focus keys and text references", async () => {
    const tour = await loadResolvedTour(C4_FIXTURE_TOUR_PATH);

    expect(tour.diagram.type).toBe("c4");
    expect(tour.steps.map(({ focus }) => focus[0]?.id)).toEqual([
      "person-visitor", "system-shop", "system-payments_alt", "container-storefront", "component-checkout",
      "deployment-cloud", "boundary-company", "relationship-2"
    ]);
    expect(tour.steps[5]?.text).toContain("Cloud region");
    expect(tour.steps[7]?.text).toContain("shop → payments: Authorizes payment [HTTPS]");
  });

  it("detects all five C4 headers and extracts nodes, boundaries, and ordered relations", () => {
    for (const header of ["C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment"]) {
      expect(createDiagramModel([header, 'Person(p, "User")'].join("\n"), createTourContext("/tmp/a.mmd")).type).toBe("c4");
    }
    const model = createDiagramModel([
      "C4Context",
      'Person_Ext(user, "User", "Browser")',
      'System(system, "Shop", "Description")',
      'SystemDb(db, "Database", "Postgres")',
      'SystemQueue_Ext(queue, "Queue", "Kafka")',
      'Boundary(org, "Organisation") {',
      'Enterprise_Boundary(enterprise, "Enterprise") {',
      'System_Boundary(domain, "Domain") {',
      'Container_Boundary(runtime, "Runtime") {',
      'Container(web, "Web", "Svelte", "App")',
      'Component(api, "API", "HTTP", "Endpoint")',
      'Deployment_Node(node, "Cloud", "Region", "Region") {',
      'Node_L(service, "Service", "Container", "Workload")',
      'Person(duplicate, "User")',
      'Person(sameLabel, "User")',
      "Person(labelFallback)",
      "Boundary(aliasOnly)",
      'Rel(user, system, "Uses", "HTTPS")',
      'BiRel(system, db, "Reads and writes")',
      'RelIndex(3, system, queue, "Publishes", "AMQP")',
      'Rel_U(user, queue, "Up")',
      'Rel_Down(queue, db, "Down")',
      'Rel_Up(db, user, "Up full")',
      'Rel_D(user, db, "Down short")',
      'Rel_L(db, queue, "Left")',
      'Rel_Left(queue, user, "Left full")',
      'Rel_Right(system, user, "Right")',
      'Rel_R(queue, system, "Right short")',
      'Rel_Back(db, system, "Back")',
      'Rel(other, target, "Final")',
      "}"
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.type).toBe("c4");
    expect(model.elements.map(({ id }) => id)).toEqual([
      "person-user", "system-system", "system-db", "system-queue", "boundary-org",
      "boundary-enterprise", "boundary-domain", "boundary-runtime", "container-web", "component-api",
      "deployment-node", "deployment-service", "person-duplicate", "person-sameLabel", "person-labelFallback", "boundary-aliasOnly",
      "relationship-1", "relationship-2", "relationship-3", "relationship-4", "relationship-5",
      "relationship-6", "relationship-7", "relationship-8", "relationship-9", "relationship-10",
      "relationship-11", "relationship-12", "relationship-13"
    ]);
    expect(model.elements.slice(16, 19)).toMatchObject([
      { label: "user → system: Uses [HTTPS]", renderSourceId: "user", renderTargetId: "system" },
      { label: "system → db: Reads and writes", renderSourceId: "system", renderTargetId: "db" },
      { label: "system → queue: Publishes [AMQP]", renderSourceId: "system", renderTargetId: "queue" }
    ]);
    expect(model.renderSource).toContain("RelIndex");
  });

  it("ignores comments and titles while parsing multiline relationship arguments", () => {
    const model = createDiagramModel([
      "C4Context",
      'title System(phantom, "Fake")',
      'Person(a, "A") %% Rel(a,b,"Phantom")',
      'System(b, "B")',
      'Rel(a,b,',
      '  "Uses", "HTTPS")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id, label }) => [id, label])).toEqual([
      ["person-a", "A"], ["system-b", "B"], ["relationship-1", "a → b: Uses [HTTPS]"]
    ]);
    expect(model.renderSource).toContain("Rel(a,b,");
  });

  it("ignores a C4 call that has no closing parenthesis", () => {
    const model = createDiagramModel('C4Context\nSystem(broken, "Open"', createTourContext("/tmp/c4.mmd"));

    expect(model.elements).toEqual([]);
  });

  it("ignores quoted braces and unmatched scope tokens between C4 calls", () => {
    const model = createDiagramModel([
      "C4Context", 'Person(a, "A") { "ignored } text"', 'Person(b, "B") }', 'Person(c, "C")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id, renderParentId }) => [id, renderParentId])).toEqual([
      ["person-a", undefined], ["person-b", undefined], ["person-c", undefined]
    ]);
  });

  it("retains complete C4 node identity for repeated visible names", () => {
    const model = createDiagramModel([
      "C4Context", 'System(a, "Same", "Inside")', 'System(b, "Same", "Outside")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));
    expect(model.elements.map(({ id, label, renderIdentity }) => [id, label, renderIdentity])).toEqual([
      ["system-a", "Same", "Same Inside"], ["system-b", "Same", "Same Outside"]
    ]);
  });

  it("keeps source aliases scoped to their Mermaid boundary and parses named display arguments", () => {
    const model = createDiagramModel([
      "C4Context", 'System_Boundary(app, "Application") {',
      'System(inside, "Same", $descr="Description")', "}",
      'System(outside, "Same", $descr="Description")',
      'System_Ext(external, "Same", $descr="Description")',
      'Rel(inside, outside, "Reads (cached)", $techn="HTTP")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id, label, renderIdentity, renderParentId }) => [id, label, renderIdentity, renderParentId])).toEqual([
      ["boundary-app", "Application", undefined, undefined],
      ["system-inside", "Same", "Same Description", "app"],
      ["system-outside", "Same", "Same Description", undefined],
      ["system-external", "Same", "Same Description", undefined],
      ["relationship-1", "inside → outside: Reads (cached) [HTTP]", undefined, undefined]
    ]);
  });

  it("assigns named display arguments by their field name rather than their positional slot", () => {
    const model = createDiagramModel([
      "C4Container", 'System(first, "Same", $tags="tagA")',
      'Container(second, "Widget", $descr="Description", $techn="JS")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id, label, renderIdentity }) => [id, label, renderIdentity])).toEqual([
      ["system-first", "Same", "Same"], ["container-second", "Widget", "Widget JS Description"]
    ]);
  });

  it("keeps only Mermaid-rendered relationships for repeated directed endpoints", async () => {
    const source = [
      "C4Context", 'Person(a, "A")', 'System(b, "B")', 'System(c, "C")',
      'Rel(a, b, "First")', 'Rel(a, b, "Second")', 'Rel(b, c, "Third")'
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/c4.mmd"));

    expect(model.elements.filter(({ kind }) => kind === "relationship")).toMatchObject([
      { id: "relationship-2", renderOrder: 1, label: "a → b: Second" },
      { id: "relationship-3", renderOrder: 2, label: "b → c: Third" }
    ]);
    expect(model.elements.some(({ id }) => id === "relationship-1")).toBe(false);
    const tourPath = await createTempTour({
      mermaid: source,
      yaml: ["version: 1", "title: Missing rendered relationship", "diagram: ./diagram.mmd", "steps:",
        "  - focus: [relationship-1]", "    text: This source relation was replaced by Mermaid."].join("\n")
    });
    await expect(loadResolvedTour(tourPath)).rejects.toThrow("relationship-1");
  });

  it("tracks deployment scopes and excludes named tags from rendered identities", () => {
    const model = createDiagramModel([
      "C4Deployment", 'Deployment_Node(cloud, "Cloud", "Provider", "Region") {',
      'Container(a, "Same", "Description")', "}",
      'Container(b, "Same", "Description")',
      'Deployment_Node(region, "Region", "Provider", "Region") {',
      'Deployment_Node(host, "Host", "Server", "Host") {',
      'Container(c, "Same", "Description")', "}", "}",
      'System(first, "Same", "Description", $tags="tagA")',
      'System(second, "Other")', 'Rel(first, second, "Reads [cache]")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.filter(({ id }) => ["container-a", "container-b", "container-c"].includes(id))
      .map(({ id, renderParentId }) => [id, renderParentId])).toEqual([
      ["container-a", "cloud"], ["container-b", undefined], ["container-c", "host"]
    ]);
    expect(model.elements.find(({ id }) => id === "system-first")?.renderIdentity).toBe("Same Description");
    expect(model.elements.find(({ id }) => id === "relationship-1"))
      .toMatchObject({ label: "first → second: Reads [cache]" });
    expect(model.elements.find(({ id }) => id === "relationship-1")?.renderTechnology).toBeUndefined();
  });

  it("uses a named deployment type in the group identity and scopes its container", () => {
    const model = createDiagramModel([
      "C4Deployment",
      'Deployment_Node(host01, "Application Host", $type="Infrastructure") {',
      'Container(api, "API", "JS")',
      "}"
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id, renderIdentity, renderParentId }) => [id, renderIdentity, renderParentId]))
      .toEqual([
        ["deployment-host01", "Application Host Infrastructure", undefined],
        ["container-api", "API JS", "host01"]
      ]);
  });

  it("uses Mermaid's default deployment type in the group identity and child scope", () => {
    const model = createDiagramModel([
      "C4Deployment",
      'Deployment_Node(host01, "Application Host") {',
      'Container(api, "API", "JS")',
      "}"
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ id, renderIdentity, renderParentId }) => [id, renderIdentity, renderParentId]))
      .toEqual([
        ["deployment-host01", "Application Host node", undefined],
        ["container-api", "API JS", "host01"]
      ]);
  });

  it("includes every display argument in a complete C4 identity", () => {
    const model = createDiagramModel([
      "C4Deployment", 'Deployment_Node(cloud, "Cloud region", "Cloud provider", "UK region")',
      'Container(app, "Storefront", "Svelte", "Customer experience")'
    ].join("\n"), createTourContext("/tmp/c4.mmd"));

    expect(model.elements.map(({ renderIdentity }) => renderIdentity)).toEqual([
      "Cloud region Cloud provider UK region", "Storefront Svelte Customer experience"
    ]);
  });
});
