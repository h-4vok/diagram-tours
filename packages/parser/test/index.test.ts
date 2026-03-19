import { mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadResolvedTour, loadResolvedTourCollection } from "../src/index";

const FIXTURE_TOUR_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/payment-flow.tour.yaml"
);
const DISCOVERY_FIXTURE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "./fixtures/discovery");
const INVALID_ONLY_FIXTURE_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "./fixtures/invalid-only"
);
const EXAMPLES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../examples");
const ORIGINAL_CWD = process.cwd();

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("@diagram-tour/parser", () => {
  it("loads a valid linear tour into a resolved player-ready model", async () => {
    const result = await loadResolvedTour(FIXTURE_TOUR_PATH);

    expect(result).toEqual({
      version: 1,
      sourceKind: "authored",
      title: "Payment Flow",
      diagram: {
        elements: [
          { id: "client", kind: "node", label: "Client" },
          { id: "api_gateway", kind: "node", label: "API Gateway" },
          { id: "validation_service", kind: "node", label: "Validation Service" },
          { id: "payment_service", kind: "node", label: "Payment Service" },
          { id: "payment_provider", kind: "node", label: "Payment Provider" },
          { id: "response", kind: "node", label: "Response" }
        ],
        path: "./payment-flow.mmd",
        source: [
          "flowchart LR",
          "  client[Client] --> api_gateway[API Gateway]",
          "  api_gateway --> validation_service[Validation Service]",
          "  validation_service --> payment_service[Payment Service]",
          "  payment_service --> payment_provider[Payment Provider]",
          "  payment_provider --> response[Response]"
        ].join("\n"),
        type: "flowchart"
      },
      steps: [
        {
          index: 1,
          focus: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
          text:
            "The API Gateway is the public edge of the checkout system. It receives untrusted traffic from Client and normalizes the request before any payment work begins.\n"
        },
        {
          index: 2,
          focus: [{ id: "validation_service", kind: "node", label: "Validation Service" }],
          text:
            "The Validation Service protects the payment path by rejecting malformed amounts, expired intents, and requests that do not match business rules before they reach Payment Service.\n"
        },
        {
          index: 3,
          focus: [
            { id: "payment_service", kind: "node", label: "Payment Service" },
            { id: "payment_provider", kind: "node", label: "Payment Provider" }
          ],
          text:
            "The Payment Service owns the merchant-side transaction state while Payment Provider talks to the banking network. This split lets the product keep internal business logic separate from external settlement concerns.\n"
        },
        {
          index: 4,
          focus: [{ id: "response", kind: "node", label: "Response" }],
          text:
            "Once the provider result is known, the platform turns it into a stable Response that the client can render without needing to understand provider-specific outcomes.\n"
        }
      ]
    });
  });

  it("accepts a step with empty focus when the text references valid nodes", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Empty Focus",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The {{api_gateway}} exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).resolves.toEqual({
      version: 1,
      sourceKind: "authored",
      title: "Empty Focus",
      diagram: {
        elements: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
        path: "./diagram.mmd",
        source: "flowchart LR\n  api_gateway[API Gateway]",
        type: "flowchart"
      },
      steps: [
        {
          index: 1,
          focus: [],
          text: "The API Gateway exists.\n"
        }
      ]
    });
  });

  it("fails when the tour version is unsupported", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 2",
        "title: Unsupported Version",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The {{api_gateway}} exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": unsupported tour version "2"`
    );
  });

  it("fails when the tour title is missing", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The {{api_gateway}} exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": title is required`
    );
  });

  it("fails when the tour diagram path is missing", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Missing Diagram",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The {{api_gateway}} exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": diagram path is required`
    );
  });

  it("fails when the tour has no steps", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: ["version: 1", "title: No Steps", "diagram: ./diagram.mmd", "", "steps: []"].join(
        "\n"
      )
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": steps must be a non-empty array`
    );
  });

  it("fails when a focus node does not exist in the mermaid diagram", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Invalid Focus",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - missing_node",
        "    text: >",
        "      The {{api_gateway}} exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": step 1 focus references unknown Mermaid node id "missing_node"`
    );
  });

  it("fails when a text reference does not exist in the mermaid diagram", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Invalid Text Reference",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - api_gateway",
        "    text: >",
        "      The {{missing_node}} does not exist."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": step 1 text references unknown Mermaid node id "missing_node"`
    );
  });

  it("loads a valid sequence tour with participant and message references", async () => {
    const tourPath = await createTempTour({
      mermaid: [
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway",
        "  user->>api: [request_sent] Send request"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Sequence Tour",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - user",
        "      - request_sent",
        "    text: >",
        "      {{user}} triggers {{request_sent}}."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).resolves.toEqual({
      version: 1,
      sourceKind: "authored",
      title: "Sequence Tour",
      diagram: {
        elements: [
          { id: "user", kind: "participant", label: "User" },
          { id: "api", kind: "participant", label: "API Gateway" },
          { id: "request_sent", kind: "message", label: "Send request" }
        ],
        path: "./diagram.mmd",
        source: [
          "sequenceDiagram",
          "  participant user as User",
          "  participant api as API Gateway",
          "  user->>api: Send request"
        ].join("\n"),
        type: "sequence"
      },
      steps: [
        {
          focus: [
            { id: "user", kind: "participant", label: "User" },
            { id: "request_sent", kind: "message", label: "Send request" }
          ],
          index: 1,
          text: "User triggers Send request.\n"
        }
      ]
    });
  });

  it("uses the participant id as the label when a sequence participant has no alias", async () => {
    const tourPath = await createTempTour({
      mermaid: [
        "sequenceDiagram",
        "  participant api",
        "  api->>api: [self_check] Self check"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Bare Participant",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - api",
        "    text: >",
        "      {{api}} owns {{self_check}}."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).resolves.toMatchObject({
      diagram: {
        elements: [
          { id: "api", kind: "participant", label: "api" },
          { id: "self_check", kind: "message", label: "Self check" }
        ]
      },
      steps: [
        {
          text: "api owns Self check.\n"
        }
      ]
    });
  });

  it("fails when a sequence focus reference uses an unknown participant or message id", async () => {
    const tourPath = await createTempTour({
      mermaid: [
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Broken Sequence Tour",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - missing_message",
        "    text: >",
        "      Overview."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": step 1 focus references unknown Mermaid participant or message id "missing_message"`
    );
  });

  it("fails when a sequence text reference uses an unknown participant or message id", async () => {
    const tourPath = await createTempTour({
      mermaid: [
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Broken Sequence Tour",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus:",
        "      - user",
        "    text: >",
        "      {{missing_message}} is not valid."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": step 1 text references unknown Mermaid participant or message id "missing_message"`
    );
  });

  it("fails when a sequence diagram reuses a participant or message id", async () => {
    const tourPath = await createTempTour({
      mermaid: [
        "sequenceDiagram",
        "  participant user as User",
        "  user->>user: [user] Recursive"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Duplicate Sequence Id",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      Overview."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": diagram contains duplicate Mermaid sequence id "user"`
    );
  });

  it("wraps underlying file-system errors with tour context", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Missing Diagram File",
        "diagram: ./missing-diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The API Gateway exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": ENOENT: no such file or directory`
    );
  });

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
      resolve(EXAMPLES_ROOT, "./payment-flow/payment-flow.mmd")
    );

    expect(collection.entries).toHaveLength(1);
    expect(collection.entries[0]).toMatchObject({
      slug: "payment-flow",
      sourcePath: "payment-flow.mmd",
      title: "Payment Flow",
      tour: {
        sourceKind: "generated"
      }
    });
    expect(collection.entries[0]?.tour.steps.map((step) => step.text)).toEqual([
      "Overview of Payment Flow.",
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

    expect(collection.entries).toHaveLength(1);
    expect(collection.entries[0]?.tour.diagram.type).toBe("sequence");
    expect(collection.entries[0]?.tour.steps.map((step) => step.text)).toEqual([
      "Overview of Order Sequence.",
      "Focus on User.",
      "Focus on API Gateway.",
      "Focus on Send request."
    ]);
    expect(collection.entries[0]?.tour.diagram.source).toContain("user->>api: Send request");
    expect(collection.entries[0]?.tour.diagram.source).not.toContain("[request_sent]");
  });

  it("builds a generated collection from a single markdown diagram file target", async () => {
    const markdownRoot = await createTempDiagramDirectory({
      "docs/checklist.md": [
        "# Country Implementation Checklist",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> finish[Finish]",
        "```"
      ].join("\n")
    });

    const collection = await loadResolvedTourCollection(resolve(markdownRoot, "./docs/checklist.md"));

    expect(collection.entries).toHaveLength(1);
    expect(collection.entries[0]).toMatchObject({
      slug: "checklist",
      sourcePath: "checklist.md",
      title: "Country Implementation Checklist",
      tour: {
        diagram: {
          path: "checklist.md"
        },
        sourceKind: "generated"
      }
    });
    expect(collection.entries[0]?.tour.steps.map((step) => step.text)).toEqual([
      "Overview of Country Implementation Checklist.",
      "Focus on Start.",
      "Focus on Finish."
    ]);
  });

  it("discovers multiple generated entries from a markdown file with multiple mermaid blocks", async () => {
    const markdownRoot = await createTempDiagramDirectory({
      "docs/checklist.md": [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> review[Review]",
        "```",
        "",
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  build[Build] --> deploy[Deploy]",
        "```",
        "",
        "~~~~md",
        "```mermaid",
        "flowchart TD",
        "  ignored[Ignored] --> nested[Nested]",
        "```",
        "~~~~",
        "",
        "## Details",
        "",
        "```mermaid",
        "flowchart TD",
        "  detail[Detail] --> done[Done]",
        "```"
      ].join("\n")
    });

    const collection = await loadResolvedTourCollection(markdownRoot);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "docs/checklist/details",
      "docs/checklist/overview",
      "docs/checklist/overview-2"
    ]);
    expect(collection.entries.map((entry) => entry.sourcePath)).toEqual([
      "docs/checklist.md#details",
      "docs/checklist.md#overview",
      "docs/checklist.md#overview-2"
    ]);
    expect(collection.entries.map((entry) => entry.title)).toEqual([
      "Details",
      "Overview",
      "Overview (2)"
    ]);
  });

  it("falls back to the markdown file title when blocks have no heading", async () => {
    const markdownRoot = await createTempDiagramDirectory({
      "docs/release-checklist.md": [
        "Contributor notes",
        "",
        "```mermaid",
        "flowchart TD",
        "  plan[Plan] --> ship[Ship]",
        "```",
        "",
        "```mermaid",
        "flowchart TD",
        "  verify[Verify] --> close[Close]",
        "```"
      ].join("\n")
    });

    const collection = await loadResolvedTourCollection(markdownRoot);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "docs/release-checklist/release-checklist",
      "docs/release-checklist/release-checklist-2"
    ]);
    expect(collection.entries.map((entry) => entry.title)).toEqual([
      "Release Checklist",
      "Release Checklist (2)"
    ]);
  });

  it("falls back to the markdown file title when a heading is empty", async () => {
    const markdownRoot = await createTempDiagramDirectory({
      "docs/release-checklist.md": [
        "#   ",
        "",
        "```mermaid",
        "flowchart TD",
        "  plan[Plan] --> ship[Ship]",
        "```"
      ].join("\n")
    });

    const collection = await loadResolvedTourCollection(markdownRoot);

    expect(collection.entries.map((entry) => entry.slug)).toEqual(["docs/release-checklist"]);
    expect(collection.entries.map((entry) => entry.title)).toEqual(["Release Checklist"]);
  });

  it("uses a stable fallback fragment id when a markdown heading has no slug characters", async () => {
    const markdownRoot = await createTempDiagramDirectory({
      "docs/release-checklist.md": [
        "# !!!",
        "",
        "```mermaid",
        "flowchart TD",
        "  plan[Plan] --> ship[Ship]",
        "```",
        "",
        "# Follow Up",
        "",
        "```mermaid",
        "flowchart TD",
        "  verify[Verify] --> close[Close]",
        "```"
      ].join("\n")
    });

    const collection = await loadResolvedTourCollection(markdownRoot);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "docs/release-checklist/diagram",
      "docs/release-checklist/follow-up"
    ]);
    expect(collection.entries.map((entry) => entry.sourcePath)).toEqual([
      "docs/release-checklist.md#diagram",
      "docs/release-checklist.md#follow-up"
    ]);
    expect(collection.entries.map((entry) => entry.title)).toEqual(["!!!", "Follow Up"]);
  });

  it("fails when a markdown diagram file has no mermaid blocks", async () => {
    const markdownRoot = await createTempDiagramDirectory({
      "docs/notes.md": "# Notes\n\nNo diagrams here."
    });

    await expect(loadResolvedTourCollection(resolve(markdownRoot, "./docs/notes.md"))).rejects.toThrow(
      `Markdown diagram "${normalizePath(resolve(markdownRoot, "./docs/notes.md"))}" does not contain any Mermaid fenced blocks.`
    );
  });

  it("loads an authored tour that targets a single-block markdown diagram", async () => {
    const tourPath = await createTempTour({
      diagramPath: "diagram.md",
      mermaid: [
        "# Checklist",
        "",
        "```mermaid",
        "flowchart TD",
        "  api_gateway[API Gateway] --> done[Done]",
        "```"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Markdown Tour",
        "diagram: ./diagram.md",
        "",
        "steps:",
        "  - focus:",
        "      - api_gateway",
        "    text: >",
        "      Focus on {{api_gateway}}."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).resolves.toMatchObject({
      title: "Markdown Tour",
      diagram: {
        path: "./diagram.md",
        source: "flowchart TD\n  api_gateway[API Gateway] --> done[Done]"
      },
      steps: [
        {
          index: 1,
          text: "Focus on API Gateway.\n"
        }
      ]
    });
  });

  it("fails when an authored tour targets a multi-block markdown diagram without a fragment", async () => {
    const tourPath = await createTempTour({
      diagramPath: "diagram.md",
      mermaid: [
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
      yaml: [
        "version: 1",
        "title: Markdown Tour",
        "diagram: ./diagram.md",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      Overview."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": diagram markdown file "./diagram.md" contains multiple Mermaid blocks; use a #fragment to select one`
    );
  });

  it("loads an authored tour that selects a markdown block by fragment", async () => {
    const tourPath = await createTempTour({
      diagramPath: "diagram.md",
      mermaid: [
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
      yaml: [
        "version: 1",
        "title: Markdown Tour",
        "diagram: ./diagram.md#details",
        "",
        "steps:",
        "  - focus:",
        "      - detail",
        "    text: >",
        "      Focus on {{detail}}."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).resolves.toMatchObject({
      diagram: {
        path: "./diagram.md#details",
        source: "flowchart TD\n  detail[Detail] --> done[Done]"
      },
      steps: [
        {
          text: "Focus on Detail.\n"
        }
      ]
    });
  });

  it("loads an authored tour that selects a markdown sequence block by fragment", async () => {
    const tourPath = await createTempTour({
      diagramPath: "diagram.md",
      mermaid: [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> finish[Finish]",
        "```",
        "",
        "# Sequence",
        "",
        "```mermaid",
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway",
        "  user->>api: [request_sent] Send request",
        "```"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Markdown Sequence Tour",
        "diagram: ./diagram.md#sequence",
        "",
        "steps:",
        "  - focus:",
        "      - request_sent",
        "    text: >",
        "      Focus on {{request_sent}}."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).resolves.toMatchObject({
      diagram: {
        path: "./diagram.md#sequence",
        type: "sequence"
      },
      steps: [
        {
          text: "Focus on Send request.\n"
        }
      ]
    });
  });

  it("fails when a markdown fragment does not exist", async () => {
    const tourPath = await createTempTour({
      diagramPath: "diagram.md",
      mermaid: [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> review[Review]",
        "```"
      ].join("\n"),
      yaml: [
        "version: 1",
        "title: Markdown Tour",
        "diagram: ./diagram.md#missing-block",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      Overview."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": diagram markdown fragment "missing-block" was not found in "./diagram.md"`
    );
  });

  it("discovers matching .tour.yaml files from a directory target", async () => {
    const collection = await loadResolvedTourCollection(DISCOVERY_FIXTURE_ROOT);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "alpha-tour/alpha",
      "invalid-tour/invalid",
      "nested/beta-tour/beta"
    ]);
    expect(collection.skipped).toEqual([
      {
        sourcePath: "invalid-tour/invalid.tour.yaml",
        error: `Tour "${normalizePath(resolve(DISCOVERY_FIXTURE_ROOT, "./invalid-tour/invalid.tour.yaml"))}": step 1 focus references unknown Mermaid node id "missing_node"`
      }
    ]);
  });

  it("discovers generated fallback tours from standalone mermaid files", async () => {
    const fallbackRoot = await createTempDiagramDirectory({
      "payments/refund.mmd": "flowchart LR\n  customer[Customer] --> receipt[Receipt]",
      "ops/release.mermaid": "flowchart LR\n  build[Build] --> deploy[Deploy]",
      "ops/--release-candidate.mmd": "flowchart LR\n  build[Build] --> approve[Approve]"
    });

    const collection = await loadResolvedTourCollection(fallbackRoot);

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
    expect(collection.entries[1]?.tour.steps).toHaveLength(3);
    expect(collection.entries[1]?.tour.steps[0]).toEqual({
      focus: [],
      index: 1,
      text: "Overview of Release."
    });
    expect(collection.entries[0]?.tour.title).toBe("Release Candidate");
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

    expect(collection.entries[0]?.tour.title).toBe("Diagram");
    expect(collection.entries[0]?.tour.steps[0]?.text).toBe("Overview of Diagram.");
  });

  it("keeps skipped authored tour errors while still generating a fallback from the diagram", async () => {
    const collection = await loadResolvedTourCollection(INVALID_ONLY_FIXTURE_ROOT);

    expect(collection.entries.map((entry) => `${entry.slug}:${entry.tour.sourceKind}`)).toEqual([
      "broken:generated"
    ]);
    expect(collection.skipped).toHaveLength(1);
    expect(collection.skipped[0]?.sourcePath).toBe("broken.tour.yaml");
  });

  it("treats dot as the current working directory discovery root", async () => {
    process.chdir(DISCOVERY_FIXTURE_ROOT);

    const collection = await loadResolvedTourCollection(".");

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "alpha-tour/alpha",
      "invalid-tour/invalid",
      "nested/beta-tour/beta"
    ]);
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
      "decision-flow",
      "huge-system",
      "incident-response",
      "order-sequence",
      "parallel-onboarding",
      "payment-flow",
      "refund-flow",
      "release-pipeline",
      "support-decision-tree",
      "support-handoff",
      "viewport-centering",
      "viewport-stability"
    ]);
  });

  it("wraps unexpected non-error throws with tour context", async () => {
    vi.resetModules();
    vi.doMock("yaml", () => ({
      parse() {
        throw "bad yaml";
      }
    }));

    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: "version: 1"
    });
    const parser = await import("../src/index");

    await expect(parser.loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": failed unexpectedly`
    );

    vi.doUnmock("yaml");
    vi.resetModules();
  });

  it("rethrows unexpected markdown discovery errors", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

      return {
        ...actual,
        async readFile(
          path: Parameters<typeof actual.readFile>[0],
          options?: Parameters<typeof actual.readFile>[1]
        ) {
          if (String(path).endsWith("diagram.md")) {
            throw new Error("boom");
          }

          return actual.readFile(path, options as never);
        }
      };
    });

    const discoveryRoot = await createTempDiagramDirectory({
      "docs/diagram.md": [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> finish[Finish]",
        "```"
      ].join("\n")
    });
    const parser = await import("../src/index");

    await expect(parser.loadResolvedTourCollection(discoveryRoot)).rejects.toThrow("boom");

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });
});

async function createTempTour(input: {
  diagramPath?: string;
  mermaid: string;
  yaml: string;
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "diagram-tour-parser-"));
  const diagramPath = join(dir, input.diagramPath ?? "diagram.mmd");
  const tourPath = join(dir, "tour.yaml");

  await import("node:fs/promises").then(async ({ mkdir }) => {
    await mkdir(dirname(diagramPath), { recursive: true });
  });
  await writeFile(diagramPath, input.mermaid);
  await writeFile(tourPath, input.yaml);

  return tourPath;
}

async function createTempDiagramDirectory(input: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "diagram-tour-parser-discovery-"));

  await Promise.all(
    Object.entries(input).map(async ([relativePath, source]) => {
      const absolutePath = join(dir, relativePath);
      const parent = dirname(absolutePath);

      await import("node:fs/promises").then(async ({ mkdir }) => {
        await mkdir(parent, { recursive: true });
      });
      await writeFile(absolutePath, source);
    })
  );

  return dir;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
