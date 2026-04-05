import type * as FsPromises from "node:fs/promises";
import type * as YamlModule from "yaml";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadResolvedTour } from "../src/index.js";
import {
  FIXTURE_TOUR_PATH,
  createTempTour,
  normalizePath,
  restoreParserTestState
} from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser loadResolvedTour", () => {
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
      mermaid: ["sequenceDiagram", "  participant api", "  api->>api: [self_check] Self check"].join(
        "\n"
      ),
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
      mermaid: ["sequenceDiagram", "  participant user as User", "  participant api as API Gateway"].join(
        "\n"
      ),
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
      mermaid: ["sequenceDiagram", "  participant user as User", "  participant api as API Gateway"].join(
        "\n"
      ),
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
      mermaid: ["sequenceDiagram", "  participant user as User", "  user->>user: [user] Recursive"].join(
        "\n"
      ),
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

  it("fails when the tour version is missing", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "title: Missing Version",
        "diagram: ./diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The {{api_gateway}} exists."
      ].join("\n")
    });

    await expect(loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": unsupported tour version "undefined"`
    );
  });

  it("wraps file-system errors without a diagnostic code", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async () => {
      const actual = (await vi.importActual("node:fs/promises")) as typeof FsPromises;

      return {
        ...actual,
        async readFile(
          path: Parameters<typeof actual.readFile>[0],
          options?: Parameters<typeof actual.readFile>[1]
        ) {
          if (String(path).endsWith("tour.yaml")) {
            throw new Error("boom");
          }

          return actual.readFile(path, options as never);
        }
      };
    });
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: [
        "version: 1",
        "title: Missing File Error Code",
        "diagram: ./missing-diagram.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      The API Gateway exists."
      ].join("\n")
    });

    const parser = await import("../src/index.js");

    await expect(parser.loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": boom`
    );
    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });

  it("wraps unexpected non-error throws with tour context", async () => {
    vi.resetModules();
    vi.doMock("yaml", async () => {
      const actual = await vi.importActual<YamlModule>("yaml");

      return {
        ...actual,
        parseDocument() {
          throw "bad yaml";
        }
      };
    });

    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: "version: 1"
    });
    const parser = await import("../src/index.js");

    await expect(parser.loadResolvedTour(tourPath)).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": failed unexpectedly`
    );

    vi.doUnmock("yaml");
    vi.resetModules();
  });

  it("preserves location metadata when wrapping parser errors", async () => {
    vi.resetModules();
    vi.doMock("yaml", async () => {
      const actual = await vi.importActual<YamlModule>("yaml");

      return {
        ...actual,
        parseDocument() {
          const error = new Error("broken yaml");

          (error as Error & { code?: string; location?: { column: number; line: number } }).code =
            "YAML_ERR";
          (error as Error & { code?: string; location?: { column: number; line: number } }).location =
            { column: 3, line: 2 };
          throw error;
        }
      };
    });

    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: "version: 1"
    });
    const parser = await import("../src/index.js");

    await expect(parser.loadResolvedTour(tourPath)).rejects.toMatchObject({
      code: "YAML_ERR",
      location: { column: 3, line: 2 },
      message: `Tour "${normalizePath(tourPath)}": broken yaml`
    });

    vi.doUnmock("yaml");
    vi.resetModules();
  });
});
