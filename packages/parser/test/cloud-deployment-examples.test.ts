import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadResolvedTour } from "../src/authored-tour-loader.js";
import { EXAMPLES_ROOT } from "./parser-test-support.js";

describe("cloud deployment examples", () => {
  it("resolves architecture-beta boundaries, services, and connection directions", async () => {
    const tour = await loadResolvedTour(resolve(EXAMPLES_ROOT, "architecture/cloud-deployment.tour.yaml"));

    expect(tour.diagram.type).toBe("architecture");
    expect(tour.steps.map(({ focus }) => focus[0]?.id)).toEqual([
      "group-cloud", "group-region", "group-vpc", "service-api", "service-database_primary",
      "service-database_replica", "connection-1", "connection-5"
    ]);
    expect(tour.diagram.elements.filter(({ label }) => label === "Database").map(({ id }) => id)).toEqual([
      "service-database_primary", "service-database_replica"
    ]);
    expect(tour.diagram.elements.find(({ id }) => id === "connection-5")).toMatchObject({
      renderSourceArrow: true, renderTargetArrow: true
    });
  });

  it("resolves styled Flowchart boundaries, duplicate resources, and bidirectional connector", async () => {
    const tour = await loadResolvedTour(resolve(EXAMPLES_ROOT, "flowchart/cloud-deployment.tour.yaml"));

    expect(tour.diagram.type).toBe("flowchart");
    expect(tour.steps.map(({ focus }) => focus[0]?.id)).toEqual([
      "group-cloud", "group-region", "group-network", "group-subnet", "api",
      "transition-gateway-to-api-routes-requests", "transition-primary-to-replica-unlabeled"
    ]);
    expect(tour.diagram.elements.filter(({ label }) => label === "PostgreSQL Database").map(({ id }) => id)).toEqual([
      "primary", "replica"
    ]);
    expect(tour.diagram.elements.find(({ id }) => id === "transition-primary-to-replica-unlabeled")).toMatchObject({
      kind: "transition", renderSourceId: "primary", renderTargetId: "replica"
    });
  });
});
