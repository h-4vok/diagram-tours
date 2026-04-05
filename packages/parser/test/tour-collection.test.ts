import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadResolvedTourCollection, validateDiscoveredTours } from "../src/index.js";
import {
  DISCOVERY_FIXTURE_ROOT,
  EXAMPLES_ROOT,
  FIXTURE_TOUR_PATH,
  INVALID_ONLY_FIXTURE_ROOT,
  createTempDiagramDirectory,
  normalizePath,
  readCollectionEntryAt,
  restoreParserTestState
} from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser tour collection", () => {
  it("builds a one-tour collection from a single file target", async () => {
    const collection = await loadResolvedTourCollection(FIXTURE_TOUR_PATH);

    expect(collection.entries).toHaveLength(1);
    expect(collection.entries[0]).toMatchObject({
      slug: "payment-flow",
      sourcePath: "payment-flow.tour.yaml",
      title: "Payment Flow"
    });
    expect(collection.skipped).toHaveLength(0);
  });

  it("builds a one-tour collection from a single diagram file target", async () => {
    const collection = await loadResolvedTourCollection(
      resolve(EXAMPLES_ROOT, "./checkout-payment-flow.mmd")
    );

    expect(collection.entries).toHaveLength(1);
    expect(collection.entries[0]).toMatchObject({
      slug: "checkout-payment-flow",
      sourcePath: "checkout-payment-flow.mmd",
      title: "Checkout Payment Flow",
      tour: {
        sourceKind: "generated"
      }
    });
    expect(collection.entries[0]?.tour.steps.map((step) => step.text)).toEqual([
      "Overview of Checkout Payment Flow.",
      "Focus on Client.",
      "Focus on API Gateway.",
      "Focus on Validation Service.",
      "Focus on Payment Service.",
      "Focus on Payment Provider.",
      "Focus on Response."
    ]);
    expect(collection.skipped).toHaveLength(0);
  });

  it("builds generated fallback steps from a raw sequence diagram file target", async () => {
    const sequenceRoot = await createTempDiagramDirectory({
      "diagrams/order-sequence.mmd": [
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway",
        "  user->>api: [request_sent] Send request",
        "  api-->>user: Untagged response"
      ].join("\n")
    });

    const collection = await loadResolvedTourCollection(resolve(sequenceRoot, "./diagrams/order-sequence.mmd"));
    const entry = readCollectionEntryAt(collection, 0);

    expect(collection.entries).toHaveLength(1);
    expect(entry.tour.diagram.type).toBe("sequence");
    expect(entry.tour.steps.map((step) => step.text)).toEqual([
      "Overview of Order Sequence.",
      "Focus on User.",
      "Focus on API Gateway.",
      "Focus on Send request."
    ]);
    expect(entry.tour.diagram.source).toContain("user->>api: Send request");
    expect(entry.tour.diagram.source).not.toContain("[request_sent]");
  });

  it("discovers matching .tour.yaml files from a directory target", async () => {
    const collection = await loadResolvedTourCollection(DISCOVERY_FIXTURE_ROOT);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "alpha-tour/alpha",
      "invalid-tour/invalid",
      "nested/beta-tour/beta"
    ]);
    expect(collection.skipped).toHaveLength(1);
    expect(collection.skipped[0]).toMatchObject({
      diagnostics: [
        {
          code: null,
          location: { column: 10, line: 6 },
          message: 'step 1 focus references unknown Mermaid node id "missing_node"'
        },
        {
          code: null,
          location: { column: 12, line: 7 },
          message: 'step 1 text references unknown Mermaid node id "missing_node"'
        }
      ],
      sourceId: normalizePath(resolve(DISCOVERY_FIXTURE_ROOT, "./invalid-tour/invalid.tour.yaml")),
      sourcePath: "invalid-tour/invalid.tour.yaml"
    });
  });

  it("discovers generated fallback tours from standalone mermaid files", async () => {
    const fallbackRoot = await createTempDiagramDirectory({
      "payments/refund.mmd": "flowchart LR\n  customer[Customer] --> receipt[Receipt]",
      "ops/release.mermaid": "flowchart LR\n  build[Build] --> deploy[Deploy]",
      "ops/--release-candidate.mmd": "flowchart LR\n  build[Build] --> approve[Approve]"
    });

    const collection = await loadResolvedTourCollection(fallbackRoot);
    const releaseEntry = readCollectionEntryAt(collection, 1);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "ops/--release-candidate",
      "ops/release",
      "payments/refund"
    ]);
    expect(collection.entries.map((entry) => entry.tour.sourceKind)).toEqual([
      "generated",
      "generated",
      "generated"
    ]);
    expect(releaseEntry.tour.steps).toHaveLength(3);
    expect(releaseEntry.tour.steps[0]).toEqual({
      focus: [],
      index: 1,
      text: "Overview of Release."
    });
    expect(readCollectionEntryAt(collection, 0).tour.title).toBe("Release Candidate");
    expect(collection.skipped).toEqual([]);
  });

  it("ignores unsupported files while discovering a directory", async () => {
    const fallbackRoot = await createTempDiagramDirectory({
      "payments/refund.mmd": "flowchart LR\n  customer[Customer] --> receipt[Receipt]",
      "payments/notes.txt": "not a diagram"
    });

    const collection = await loadResolvedTourCollection(fallbackRoot);

    expect(collection.entries.map((entry) => entry.slug)).toEqual(["payments/refund"]);
  });

  it("shows authored tours and generated fallback tours together while hiding duplicates", async () => {
    const mixedRoot = await createTempDiagramDirectory({
      "payment-flow/payment-flow.mmd": "flowchart LR\n  api_gateway[API Gateway]",
      "payment-flow/payment-flow.tour.yaml": [
        "version: 1",
        "title: Payment Flow",
        "diagram: ./payment-flow.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - api_gateway",
        "    text: >",
        "      Focus on {{api_gateway}}."
      ].join("\n"),
      "refund-flow/refund-flow.mmd": "flowchart LR\n  refund_service[Refund Service]"
    });

    const collection = await loadResolvedTourCollection(mixedRoot);

    expect(collection.entries.map((entry) => `${entry.slug}:${entry.tour.sourceKind}`)).toEqual([
      "payment-flow:authored",
      "refund-flow:generated"
    ]);
  });

  it("keeps generated markdown blocks that are not owned by an authored markdown tour", async () => {
    const mixedRoot = await createTempDiagramDirectory({
      "docs/checklist.md": [
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
      ].join("\n"),
      "docs/checklist.tour.yaml": [
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
    });

    const collection = await loadResolvedTourCollection(mixedRoot);

    expect(collection.entries.map((entry) => `${entry.slug}:${entry.tour.sourceKind}`)).toEqual([
      "docs/checklist:authored",
      "docs/checklist/overview:generated"
    ]);
  });

  it("falls back to a generic title when a diagram filename has no usable words", async () => {
    const fallbackRoot = await createTempDiagramDirectory({
      "--.mmd": "flowchart LR\n  start[Start] --> finish[Finish]"
    });

    const collection = await loadResolvedTourCollection(fallbackRoot);
    const entry = readCollectionEntryAt(collection, 0);

    expect(entry.tour.title).toBe("Diagram");
    expect(entry.tour.steps[0]?.text).toBe("Overview of Diagram.");
  });

  it("keeps skipped authored tour errors while still generating a fallback from the diagram", async () => {
    const collection = await loadResolvedTourCollection(INVALID_ONLY_FIXTURE_ROOT);

    expect(collection.entries.map((entry) => `${entry.slug}:${entry.tour.sourceKind}`)).toEqual([
      "broken:generated"
    ]);
    expect(collection.skipped).toHaveLength(1);
    expect(collection.skipped[0]?.sourcePath).toBe("broken.tour.yaml");
    expect(collection.skipped[0]?.diagnostics).toHaveLength(2);
  });

  it("validates discovered authored tours under a directory", async () => {
    const result = await validateDiscoveredTours(DISCOVERY_FIXTURE_ROOT);

    expect(result.valid).toEqual(["alpha-tour/alpha.tour.yaml", "nested/beta-tour/beta.tour.yaml"]);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]).toMatchObject({
      diagnostics: [
        expect.objectContaining({
          message: 'step 1 focus references unknown Mermaid node id "missing_node"'
        }),
        expect.objectContaining({
          message: 'step 1 text references unknown Mermaid node id "missing_node"'
        })
      ],
      sourcePath: "invalid-tour/invalid.tour.yaml"
    });
  });

  it("keeps invalid authored tours visible even when none validate", async () => {
    const result = await validateDiscoveredTours(INVALID_ONLY_FIXTURE_ROOT);

    expect(result.valid).toEqual([]);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]).toMatchObject({
      diagnostics: [
        expect.objectContaining({
          message: 'step 1 focus references unknown Mermaid node id "ghost"'
        }),
        expect.objectContaining({
          message: 'step 1 text references unknown Mermaid node id "ghost"'
        })
      ],
      sourcePath: "broken.tour.yaml"
    });
  });

  it("returns no authored tours for a directory with only raw diagrams", async () => {
    const fallbackRoot = await createTempDiagramDirectory({
      "payments/refund.mmd": "flowchart LR\n  customer[Customer] --> receipt[Receipt]"
    });
    const result = await validateDiscoveredTours(fallbackRoot);

    expect(result).toEqual({
      invalid: [],
      valid: []
    });
  });

  it("validates a single authored tour file target", async () => {
    const result = await validateDiscoveredTours(FIXTURE_TOUR_PATH);

    expect(result).toEqual({
      invalid: [],
      valid: ["payment-flow.tour.yaml"]
    });
  });

  it("returns no authored tours for a non-tour single-file target", async () => {
    const result = await validateDiscoveredTours(resolve(EXAMPLES_ROOT, "./checkout-payment-flow.mmd"));

    expect(result).toEqual({
      invalid: [],
      valid: []
    });
  });

  it("fails when a single-file target is invalid", async () => {
    const invalidFilePath = resolve(DISCOVERY_FIXTURE_ROOT, "./invalid-tour/invalid.tour.yaml");

    await expect(loadResolvedTourCollection(invalidFilePath)).rejects.toThrow(
      `Tour "${normalizePath(invalidFilePath)}": step 1 focus references unknown Mermaid node id "missing_node"`
    );
  });

  it("fails when discovery finds no valid tours or diagrams", async () => {
    const emptyRoot = await createTempDiagramDirectory({});

    await expect(loadResolvedTourCollection(emptyRoot)).rejects.toThrow(
      `No valid tours or diagrams were discovered in source target "${normalizePath(emptyRoot)}".`
    );
  });

  it("uses the parent directory name as the slug when the file stem matches that directory", async () => {
    const collection = await loadResolvedTourCollection(EXAMPLES_ROOT);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "checkout-decision-flow",
      "checkout-payment-flow",
      "checkout-refund-flow",
      "navigation-viewport-centering",
      "navigation-viewport-stability",
      "ops-huge-system",
      "ops-incident-response",
      "ops-parallel-onboarding",
      "ops-release-pipeline",
      "sequence-order-sequence",
      "support-support-decision-tree",
      "support-support-handoff"
    ]);
  });
});
