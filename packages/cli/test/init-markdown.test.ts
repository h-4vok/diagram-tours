import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ORIGINAL_CWD,
  createIo,
  createMultiBlockMarkdown,
  createTempRoot,
  writeMarkdown
} from "./init-test-support.js";

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runInitCommand markdown sources", () => {
  it("creates a sibling starter tour for a markdown diagram with one mermaid block", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(
      diagramPath,
      ["# Checklist", "", "```mermaid", "flowchart TD", "  start[Start] --> done[Done]", "```"].join("\n")
    );
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md" }, createIo())).resolves.toBe(0);

    const scaffold = await readFile(resolve(root, "docs/checklist.tour.yaml"), "utf8");

    expect(scaffold).toContain('title: "Checklist"');
    expect(scaffold).toContain('diagram: "./checklist.md"');
  });

  it("creates a markdown starter tour from an explicit fragment target", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(diagramPath, createMultiBlockMarkdown());
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md#details" }, createIo())).resolves.toBe(
      0
    );

    const scaffold = await readFile(resolve(root, "docs/checklist-details.tour.yaml"), "utf8");

    expect(scaffold).toContain('title: "Details"');
    expect(scaffold).toContain('diagram: "./checklist.md#details"');
    expect(scaffold).toContain("- detail");
  });

  it("prompts for a markdown block when a markdown target has multiple mermaid blocks", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(diagramPath, createMultiBlockMarkdown());
    process.chdir(root);

    const io = createIo(["wat", "9", "2"]);
    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md" }, io)).resolves.toBe(0);

    const scaffold = await readFile(resolve(root, "docs/checklist-details.tour.yaml"), "utf8");

    expect(scaffold).toContain('diagram: "./checklist.md#details"');
    expect(io.question).toHaveBeenCalledWith("Select a Mermaid block to scaffold: ");
    expect(io.write).toHaveBeenCalledWith(expect.stringContaining("1. Overview"));
    expect(io.write).toHaveBeenCalledWith(expect.stringContaining("2. Details"));
    expect(io.write).toHaveBeenCalledWith("Enter a number between 1 and 2.\n");
  });

  it("fails when a markdown fragment target does not match any scaffoldable entry", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(diagramPath, createMultiBlockMarkdown());
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(
      runInitCommand({ overwrite: true, target: "./docs/checklist.md#missing" }, createIo())
    ).rejects.toThrow('Expected exactly one scaffoldable diagram entry for init target');
  });

  it("fails when a markdown target has no scaffoldable mermaid entries", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(diagramPath, "# Checklist");
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: true, target: "./docs/checklist.md" }, createIo())).rejects.toThrow(
      "does not contain any Mermaid fenced blocks"
    );
  });

  it("throws an interactive-input error when multiple markdown blocks require selection and no io is provided", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(diagramPath, createMultiBlockMarkdown());
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md" })).rejects.toThrow(
      "Interactive input is required to choose a Markdown Mermaid block."
    );
  });
});
