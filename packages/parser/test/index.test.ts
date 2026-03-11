import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadResolvedTour,
  parseMermaid,
  parseTourYaml,
  validateTourShape
} from "../src/index";

describe("@diagram-tour/parser", () => {
  it("loads a resolved linear tour from the payment flow fixture", async () => {
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
          focusNodeIds: ["api_gateway"],
          text: "The API Gateway is the public entry point for incoming requests from Client.\n",
          rawText: "The {{api_gateway}} is the public entry point for incoming requests from {{client}}.\n"
        },
        {
          index: 2,
          focusNodeIds: ["validation_service"],
          text: "The Validation Service checks the request before it moves to Payment Service.\n",
          rawText: "The {{validation_service}} checks the request before it moves to {{payment_service}}.\n"
        },
        {
          index: 3,
          focusNodeIds: ["payment_service", "payment_provider"],
          text: "The Payment Service coordinates the transaction with Payment Provider.\n",
          rawText: "The {{payment_service}} coordinates the transaction with {{payment_provider}}.\n"
        },
        {
          index: 4,
          focusNodeIds: ["response"],
          text: "Finally, the system returns the result in Response.\n",
          rawText: "Finally, the system returns the result in {{response}}.\n"
        }
      ]
    });
  });

  it("parses mermaid source into a diagram asset", () => {
    const result = parseMermaid("flowchart LR", "fixtures/diagram.mmd");

    expect(result).toEqual({
      asset: {
        path: "fixtures/diagram.mmd",
        source: "flowchart LR"
      }
    });
  });

  it("parses tour yaml into a tour asset", () => {
    const result = parseTourYaml("version: 1", "fixtures/tour.yaml");

    expect(result).toEqual({
      asset: {
        path: "fixtures/tour.yaml",
        source: "version: 1"
      }
    });
  });

  it("returns the provided tour unchanged during validation", () => {
    const tour = {
      version: 1,
      title: "Payment Flow",
      diagram: "./payment-flow.mmd",
      steps: [
        {
          focus: ["api_gateway"],
          text: "Gateway step"
        }
      ]
    };

    expect(validateTourShape(tour)).toBe(tour);
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
