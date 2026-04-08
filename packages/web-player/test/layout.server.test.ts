import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
import { join, resolve } from "node:path";

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
      "checkout-payment-flow",
      "payments-platform-overview",
      "sequence-order-sequence"
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
      "Payment Flow",
      "Payments Platform Overview",
      "Order Sequence",
    ]);
    expect(result.collection.skipped).toEqual([]);
    expect(result.sourceTarget.kind).toBe("directory");
  });

  it("loads the payments platform example as the large interactive tour", async () => {
    const entry = await loadExampleEntry("payments-platform-overview");

    expectPaymentsPlatformExample(entry);
  });

  it("loads the authored sequence example with participant and message focus", async () => {
    const entry = await loadExampleEntry("sequence-order-sequence");

    expectOrderSequenceExample(entry);
  });

  it("describes file targets for direct author preview", async () => {
    const target = resolve(process.cwd(), "../../examples/checkout-payment-flow.tour.yaml");
    process.env.DIAGRAM_TOUR_SOURCE_TARGET = target;

    const result = (await load({} as never)) as {
      collection: ResolvedDiagramTourCollection;
      sourceTarget: SourceTargetInfo;
    };

    expect(result.collection.entries).toHaveLength(1);
    expect(result.collection.entries[0]?.slug).toBe("checkout-payment-flow");
    expect(result.sourceTarget).toEqual({
      kind: "file",
      label: "checkout-payment-flow.tour.yaml",
      path: target
    });
  });

  it("loads a generated fallback collection from a diagram file target", async () => {
    const target = resolve(process.cwd(), "../../examples/checkout-payment-flow.mmd");
    const result = await loadForTarget(target);

    expectGeneratedDiagramPreview(result, target);
  });

  it("loads multiple generated entries from a markdown file target", async () => {
    const target = await createTempMarkdownTarget([
      "# Overview",
      "",
      "```mermaid",
      "flowchart TD",
      "  start[Start] --> review[Review]",
      "```",
      "",
      "# Details",
      "",
      "```mermaid",
      "flowchart TD",
      "  detail[Detail] --> done[Done]",
      "```"
    ].join("\n"));
    const result = await loadForTarget(target);

    expect(result.collection.entries.map((entry) => entry.slug)).toEqual([
      "markdown-preview/overview",
      "markdown-preview/details"
    ]);
    expect(result.collection.entries.map((entry) => entry.title)).toEqual(["Overview", "Details"]);
    expect(result.sourceTarget.label).toBe("markdown-preview.md");
  });

  it("loads an authored markdown fragment target through the layout", async () => {
    const directory = await mkdtemp(join(tmpdir(), "diagram-tour-layout-server-"));
    const markdownPath = join(directory, "checklist.md");
    const tourPath = join(directory, "checklist.tour.yaml");

    await writeFile(
      markdownPath,
      [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> review[Review]",
        "```",
        "",
        "# Details",
        "",
        "```mermaid",
        "flowchart TD",
        "  detail[Detail] --> done[Done]",
        "```"
      ].join("\n")
    );
    await writeFile(
      tourPath,
      [
        "version: 1",
        "title: Markdown Tour",
        "diagram: ./checklist.md#details",
        "",
        "steps:",
        "  - focus:",
        "      - detail",
        "    text: >",
        "      Focus on {{detail}}."
      ].join("\n")
    );

    const result = await loadForTarget(tourPath);

    expect(result.collection.entries).toHaveLength(1);
    expect(result.collection.entries[0]?.tour.diagram.path).toBe("./checklist.md#details");
    expect(result.collection.entries[0]?.tour.diagram.source).toBe(
      "flowchart TD\n  detail[Detail] --> done[Done]"
    );
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

async function loadForTarget(target: string): Promise<{
  collection: ResolvedDiagramTourCollection;
  sourceTarget: SourceTargetInfo;
}> {
  process.env.DIAGRAM_TOUR_SOURCE_TARGET = target;

  return (await load({} as never)) as {
    collection: ResolvedDiagramTourCollection;
    sourceTarget: SourceTargetInfo;
  };
}

async function createTempMarkdownTarget(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "diagram-tour-layout-server-"));
  const target = join(directory, "markdown-preview.md");

  await writeFile(target, source);

  return target;
}

async function loadExampleEntry(slug: string) {
  return (await loadExamplesCollection()).collection.entries.find((item) => item.slug === slug);
}

function expectPaymentsPlatformExample(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
): void {
  const steps = readSteps(entry);

  expect(readTitle(entry)).toBe("Payments Platform Overview");
  expect(readNodeCount(entry)).toBeGreaterThanOrEqual(25);
  expect(steps).toHaveLength(6);
  expect(readFocusLength(steps, 0)).toBe(1);
  expect(readFocusLength(steps, 2)).toBe(3);
  expect(readFocusLength(steps, 4)).toBe(4);
  expect(steps[5]?.focus).toEqual([]);
}

function expectOrderSequenceExample(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
): void {
  const steps = readSteps(entry);

  expect(readTitle(entry)).toBe("Order Sequence");
  expect(entry?.tour.diagram.type).toBe("sequence");
  expect(steps).toHaveLength(3);
  expect(readPrimaryFocusIds(steps)).toEqual(["customer", "submit_order", "enqueue_order"]);
}

function readSteps(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
) {
  return readTour(entry).steps;
}

function readTour(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
) {
  expect(entry).toBeDefined();

  return entry!.tour;
}

function readFocusLength(
  steps: ResolvedDiagramTourCollection["entries"][number]["tour"]["steps"],
  index: number
): number {
  return steps[index]?.focus.length ?? 0;
}

function readPrimaryFocusIds(
  steps: ResolvedDiagramTourCollection["entries"][number]["tour"]["steps"]
): Array<string | undefined> {
  return steps.map((step) => step.focus[0]?.id);
}

function readTitle(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
): string | undefined {
  return entry?.tour.title;
}

function readNodeCount(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
): number {
  return entry?.tour.diagram.elements.length ?? 0;
}

function expectGeneratedDiagramPreview(
  result: {
    collection: ResolvedDiagramTourCollection;
    sourceTarget: SourceTargetInfo;
  },
  target: string
): void {
  const entry = result.collection.entries[0];

  expect(result.collection.entries).toHaveLength(1);
  expect(entry).toBeDefined();
    expect(entry!.slug).toBe("checkout-payment-flow");
  expect(entry!.tour.sourceKind).toBe("generated");
  expect(entry!.tour.steps[0]!.text).toBe("Overview of Checkout Payment Flow.");
  expect(result.sourceTarget).toEqual({
    kind: "file",
    label: "checkout-payment-flow.mmd",
    path: target
  });
}
