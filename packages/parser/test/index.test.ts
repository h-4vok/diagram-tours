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
      title: "Payment Flow",
      diagram: {
        path: "./payment-flow.mmd",
        source: [
          "flowchart LR",
          "  client[Client] --> api_gateway[API Gateway]",
          "  api_gateway --> validation_service[Validation Service]",
          "  validation_service --> payment_service[Payment Service]",
          "  payment_service --> payment_provider[Payment Provider]",
          "  payment_provider --> response[Response]"
        ].join("\n"),
        nodes: [
          { id: "client", label: "Client" },
          { id: "api_gateway", label: "API Gateway" },
          { id: "validation_service", label: "Validation Service" },
          { id: "payment_service", label: "Payment Service" },
          { id: "payment_provider", label: "Payment Provider" },
          { id: "response", label: "Response" }
        ]
      },
      steps: [
        {
          index: 1,
          focus: [{ id: "api_gateway", label: "API Gateway" }],
          text:
            "The API Gateway is the public edge of the checkout system. It receives untrusted traffic from Client and normalizes the request before any payment work begins.\n"
        },
        {
          index: 2,
          focus: [{ id: "validation_service", label: "Validation Service" }],
          text:
            "The Validation Service protects the payment path by rejecting malformed amounts, expired intents, and requests that do not match business rules before they reach Payment Service.\n"
        },
        {
          index: 3,
          focus: [
            { id: "payment_service", label: "Payment Service" },
            { id: "payment_provider", label: "Payment Provider" }
          ],
          text:
            "The Payment Service owns the merchant-side transaction state while Payment Provider talks to the banking network. This split lets the product keep internal business logic separate from external settlement concerns.\n"
        },
        {
          index: 4,
          focus: [{ id: "response", label: "Response" }],
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
      title: "Empty Focus",
      diagram: {
        path: "./diagram.mmd",
        source: "flowchart LR\n  api_gateway[API Gateway]",
        nodes: [{ id: "api_gateway", label: "API Gateway" }]
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

  it("discovers matching .tour.yaml files from a directory target", async () => {
    const collection = await loadResolvedTourCollection(DISCOVERY_FIXTURE_ROOT);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "alpha-tour/alpha",
      "nested/beta-tour/beta"
    ]);
    expect(collection.skipped).toEqual([
      {
        sourcePath: "invalid-tour/invalid.tour.yaml",
        error: `Tour "${normalizePath(resolve(DISCOVERY_FIXTURE_ROOT, "./invalid-tour/invalid.tour.yaml"))}": step 1 focus references unknown Mermaid node id "missing_node"`
      }
    ]);
  });

  it("treats dot as the current working directory discovery root", async () => {
    process.chdir(DISCOVERY_FIXTURE_ROOT);

    const collection = await loadResolvedTourCollection(".");

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "alpha-tour/alpha",
      "nested/beta-tour/beta"
    ]);
  });

  it("fails when a single-file target is invalid", async () => {
    const invalidFilePath = resolve(DISCOVERY_FIXTURE_ROOT, "./invalid-tour/invalid.tour.yaml");

    await expect(loadResolvedTourCollection(invalidFilePath)).rejects.toThrow(
      `Tour "${normalizePath(invalidFilePath)}": step 1 focus references unknown Mermaid node id "missing_node"`
    );
  });

  it("fails when discovery finds no valid tours", async () => {
    await expect(loadResolvedTourCollection(INVALID_ONLY_FIXTURE_ROOT)).rejects.toThrow(
      `No valid tours were discovered in source target "${normalizePath(INVALID_ONLY_FIXTURE_ROOT)}".`
    );
  });

  it("uses the parent directory name as the slug when the file stem matches that directory", async () => {
    const collection = await loadResolvedTourCollection(EXAMPLES_ROOT);

    expect(collection.entries.map((entry) => entry.slug)).toEqual([
      "decision-flow",
      "incident-response",
      "parallel-onboarding",
      "payment-flow",
      "refund-flow",
      "release-pipeline",
      "support-decision-tree"
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
});

async function createTempTour(input: { mermaid: string; yaml: string }): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "diagram-tour-parser-"));
  const diagramPath = join(dir, "diagram.mmd");
  const tourPath = join(dir, "tour.yaml");

  await writeFile(diagramPath, input.mermaid);
  await writeFile(tourPath, input.yaml);

  return tourPath;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
