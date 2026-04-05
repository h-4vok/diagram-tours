import { afterEach, describe, expect, it } from "vitest";

import {
  createDiagramSourceId,
  parseDiagramReference,
  readDiagramSource,
  readMarkdownBlocks
} from "../src/markdown-blocks.js";
import { createTourContext } from "../src/tour-context.js";
import { createTempTour, normalizePath, restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser markdown blocks", () => {
  it("parses diagram references with and without fragments", () => {
    expect(parseDiagramReference("./docs/checklist.md")).toEqual({
      fragment: null,
      path: "./docs/checklist.md"
    });
    expect(parseDiagramReference("./docs/checklist.md#details")).toEqual({
      fragment: "details",
      path: "./docs/checklist.md"
    });
  });

  it("extracts mermaid blocks and stable fallback ids", () => {
    expect(
      readMarkdownBlocks(
        [
          "# !!!",
          "",
          "```mermaid",
          "flowchart TD",
          "  start[Start] --> finish[Finish]",
          "```",
          "",
          "# Details",
          "",
          "```mermaid",
          "flowchart TD",
          "  detail[Detail] --> done[Done]",
          "```"
        ].join("\n"),
        "/tmp/diagram.md"
      )
    ).toEqual([
      {
        id: "diagram",
        source: "flowchart TD\n  start[Start] --> finish[Finish]",
        title: "!!!"
      },
      {
        id: "details",
        source: "flowchart TD\n  detail[Detail] --> done[Done]",
        title: "Details"
      }
    ]);
  });

  it("loads a selected markdown fragment source", async () => {
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
      yaml: "version: 1\ntitle: Unused\ndiagram: ./diagram.md#details\nsteps:\n  - focus: []\n    text: Test"
    });

    await expect(
      readDiagramSource({
        absoluteTourPath: tourPath,
        context: createTourContext(tourPath),
        diagramPath: "./diagram.md#details"
      })
    ).resolves.toEqual({
      ownedDiagramSourceId: createDiagramSourceId(
        normalizePath(tourPath.replace("tour.tour.yaml", "diagram.md")),
        "details"
      ),
      source: "flowchart TD\n  detail[Detail] --> done[Done]"
    });
  });

  it("fails when a non-markdown diagram uses a fragment", async () => {
    const tourPath = await createTempTour({
      mermaid: "flowchart LR\n  api_gateway[API Gateway]",
      yaml: "version: 1\ntitle: Unused\ndiagram: ./diagram.mmd#details\nsteps:\n  - focus: []\n    text: Test"
    });

    await expect(
      readDiagramSource({
        absoluteTourPath: tourPath,
        context: createTourContext(tourPath),
        diagramPath: "./diagram.mmd#details"
      })
    ).rejects.toThrow(
      `Tour "${normalizePath(tourPath)}": diagram fragment "details" is only supported for Markdown diagrams`
    );
  });
});
