import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadResolvedTour } from "../src/index";

describe("@diagram-tour/parser", () => {
  it("loads a valid linear tour into a resolved player-ready model", async () => {
    const result = await loadResolvedTour(
      join(process.cwd(), "..", "..", "fixtures", "payment-flow.tour.yaml")
    );

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
          text: "The API Gateway is the public entry point for incoming requests from Client.\n"
        },
        {
          index: 2,
          focus: [{ id: "validation_service", label: "Validation Service" }],
          text: "The Validation Service checks the request before it moves to Payment Service.\n"
        },
        {
          index: 3,
          focus: [
            { id: "payment_service", label: "Payment Service" },
            { id: "payment_provider", label: "Payment Provider" }
          ],
          text: "The Payment Service coordinates the transaction with Payment Provider.\n"
        },
        {
          index: 4,
          focus: [{ id: "response", label: "Response" }],
          text: "Finally, the system returns the result in Response.\n"
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

    await expect(loadResolvedTour(tourPath)).rejects.toThrow('Unsupported tour version "2"');
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

    await expect(loadResolvedTour(tourPath)).rejects.toThrow("Tour title is required");
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

    await expect(loadResolvedTour(tourPath)).rejects.toThrow("Tour diagram path is required");
  });

  it("fails when the tour has no steps", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: No Steps",
        "diagram: ./diagram.mmd",
        "",
        "steps: []"
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      "Tour steps must be a non-empty array"
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
      'Unknown Mermaid node id "missing_node" referenced in focus for step 1'
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
      'Unknown Mermaid node id "missing_node" referenced in text for step 1'
    );
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
