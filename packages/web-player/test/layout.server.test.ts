import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { load } from "../src/routes/+layout.server";
import type { SourceTargetInfo } from "../src/lib/source-target";

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
    const result = await loadExamplesCollection();

    expect(result.collection.entries.map((entry) => entry.slug)).toEqual([
      "decision-flow",
      "incident-response",
      "parallel-onboarding",
      "payment-flow",
      "refund-flow",
      "release-pipeline",
      "support-decision-tree",
      "viewport-stability"
    ]);
    expect(result.collection.skipped).toHaveLength(0);
    expect(result.sourceTarget).toEqual({
      kind: "directory",
      label: "examples",
      path: EXAMPLES_ROOT
    });
  });

  it("loads the expanded examples set with only valid tours", async () => {
    const result = await loadExamplesCollection();

    expect(result.collection.entries.map((entry) => entry.title)).toEqual([
      "Decision Flow",
      "Incident Response",
      "Parallel Onboarding",
      "Payment Flow",
      "Refund Flow",
      "Release Pipeline",
      "Support Decision Tree",
      "Viewport Stability"
    ]);
    expect(result.collection.skipped).toEqual([]);
    expect(result.sourceTarget.kind).toBe("directory");
  });

  it("loads the viewport stability example with an empty-focus step", async () => {
    const entry = await loadExampleEntry("viewport-stability");

    expectViewportStabilityExample(entry);
  });

  it("describes file targets for direct author preview", async () => {
    const target = resolve(process.cwd(), "../../examples/payment-flow/payment-flow.tour.yaml");
    process.env.DIAGRAM_TOUR_SOURCE_TARGET = target;

    const result = (await load({} as never)) as {
      collection: ResolvedDiagramTourCollection;
      sourceTarget: SourceTargetInfo;
    };

    expect(result.collection.entries).toHaveLength(1);
    expect(result.collection.entries[0]?.slug).toBe("payment-flow");
    expect(result.sourceTarget).toEqual({
      kind: "file",
      label: "payment-flow.tour.yaml",
      path: target
    });
  });
});

async function loadExamplesCollection(): Promise<{
  collection: ResolvedDiagramTourCollection;
  sourceTarget: SourceTargetInfo;
}> {
  process.env.DIAGRAM_TOUR_SOURCE_TARGET = EXAMPLES_ROOT;

  return (await load({} as never)) as {
    collection: ResolvedDiagramTourCollection;
    sourceTarget: SourceTargetInfo;
  };
}

async function loadExampleEntry(slug: string) {
  return (await loadExamplesCollection()).collection.entries.find((item) => item.slug === slug);
}

function expectViewportStabilityExample(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
): void {
  const steps = readSteps(entry);

  expect(steps).toHaveLength(3);
  expect(readFocusLength(steps, 0)).toBe(1);
  expect(steps[1]?.focus).toEqual([]);
  expect(readFocusLength(steps, 2)).toBe(2);
}

function readSteps(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
) {
  expect(entry).toBeDefined();

  return entry!.tour.steps;
}

function readFocusLength(
  steps: ResolvedDiagramTourCollection["entries"][number]["tour"]["steps"],
  index: number
): number {
  return steps[index]?.focus.length ?? 0;
}
