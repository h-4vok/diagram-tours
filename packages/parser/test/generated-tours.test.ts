import { resolve } from "node:path";

import { afterEach, expect, it, vi } from "vitest";
import type * as DiagramModelModule from "../src/diagram-model.js";

import { createTempDiagramDirectory, restoreParserTestState } from "./parser-test-support.js";

vi.mock("../src/diagram-model.js", async (importOriginal) => {
  const actual = await importOriginal<typeof DiagramModelModule>();
  return {
    ...actual,
    createDiagramModel: vi.fn(() => { throw new Error("unexpected model failure"); })
  };
});

import { loadGeneratedCollectionEntries } from "../src/generated-tours.js";

afterEach(restoreParserTestState);

it("does not turn an unrelated Markdown model failure into a skipped Architecture block", async () => {
  const sourceRoot = await createTempDiagramDirectory({
    "unexpected.md": ["# Unexpected", "", "```mermaid", "flowchart LR", "  start[Start]", "```"].join("\n")
  });
  const onSkippedMarkdownBlock = vi.fn();

  await expect(loadGeneratedCollectionEntries({
    absolutePath: resolve(sourceRoot, "unexpected.md"),
    onSkippedMarkdownBlock,
    sourceRoot
  })).rejects.toThrow("unexpected model failure");
  expect(onSkippedMarkdownBlock).not.toHaveBeenCalled();
});
