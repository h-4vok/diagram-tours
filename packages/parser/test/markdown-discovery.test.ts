import type * as FsPromises from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadResolvedTour, loadResolvedTourCollection } from "../src/index.js";
import {
  createTempDiagramDirectory,
  createTempTour,
  normalizePath,
  restoreParserTestState
} from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser markdown discovery", () => {
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

  it("rethrows unexpected markdown discovery errors", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async () => {
      const actual = (await vi.importActual("node:fs/promises")) as typeof FsPromises;

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
    const parser = await import("../src/index.js");

    await expect(parser.loadResolvedTourCollection(discoveryRoot)).rejects.toThrow("boom");

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });
});
