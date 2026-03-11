import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { load } from "../src/routes/+layout.server";

const ORIGINAL_TARGET = process.env.DIAGRAM_TOUR_SOURCE_TARGET;
const EXAMPLES_ROOT = resolve(process.cwd(), "../../examples");

afterEach(() => {
  if (ORIGINAL_TARGET === undefined) {
    delete process.env.DIAGRAM_TOUR_SOURCE_TARGET;

    return;
  }

  process.env.DIAGRAM_TOUR_SOURCE_TARGET = ORIGINAL_TARGET;
});

describe("+layout.server", () => {
  it("loads a collection from the configured source target", async () => {
    process.env.DIAGRAM_TOUR_SOURCE_TARGET = EXAMPLES_ROOT;

    const result = (await load({} as never)) as { collection: ResolvedDiagramTourCollection };

    expect(result.collection.entries.map((entry) => entry.slug)).toEqual([
      "payment-flow",
      "refund-flow"
    ]);
    expect(result.collection.skipped).toHaveLength(0);
  });
});
