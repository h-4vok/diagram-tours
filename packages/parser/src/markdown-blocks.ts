import { dirname, resolve } from "node:path";

import type { MarkdownBlock, MarkdownBlockAccumulator, MarkdownFallback, MarkdownFence, MarkdownFenceState, MarkdownHeading } from "./parser-contracts.js";
import {
  MARKDOWN_DIAGRAM_FILE_SUFFIX
} from "./parser-contracts.js";
import { createGeneratedTitle } from "./tour-file-naming.js";
import {
  createTourMessage,
  invariant,
  normalizePath,
  readTextFile,
  type TourContext
} from "./tour-context.js";

export function parseDiagramReference(diagramPath: string): {
  fragment: string | null;
  path: string;
} {
  const hashIndex = diagramPath.lastIndexOf("#");

  if (hashIndex === -1) {
    return {
      fragment: null,
      path: diagramPath
    };
  }

  return {
    fragment: diagramPath.slice(hashIndex + 1),
    path: diagramPath.slice(0, hashIndex)
  };
}

export function createDiagramSourceId(absoluteDiagramPath: string, blockId: string | null = null): string {
  return blockId === null
    ? normalizePath(absoluteDiagramPath)
    : `${normalizePath(absoluteDiagramPath)}#${blockId}`;
}

export function assertDiagramFragmentAllowed(
  reference: { fragment: string | null },
  context: TourContext
): void {
  invariant(
    reference.fragment === null,
    createTourMessage(context, `diagram fragment "${reference.fragment}" is only supported for Markdown diagrams`)
  );
}

export async function readDiagramSource(input: {
  absoluteTourPath: string;
  context: TourContext;
  diagramPath: string;
}): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  const reference = parseDiagramReference(input.diagramPath);
  const absoluteDiagramPath = resolve(dirname(input.absoluteTourPath), reference.path);

  if (!absoluteDiagramPath.endsWith(MARKDOWN_DIAGRAM_FILE_SUFFIX)) {
    assertDiagramFragmentAllowed(reference, input.context);

    return {
      ownedDiagramSourceId: createDiagramSourceId(absoluteDiagramPath),
      source: await readTextFile(absoluteDiagramPath)
    };
  }

  return readMarkdownDiagramSource({
    absoluteDiagramPath,
    context: input.context,
    diagramPath: input.diagramPath,
    reference
  });
}

export async function readMarkdownDiagramSource(input: {
  absoluteDiagramPath: string;
  context: TourContext;
  diagramPath: string;
  reference: {
    fragment: string | null;
    path: string;
  };
}): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  const source = await readTextFile(input.absoluteDiagramPath);
  const blocks = readMarkdownBlocks(source, input.absoluteDiagramPath);
  assertMarkdownBlocks(blocks, input.context, input.reference.path);

  return readSelectedMarkdownDiagramBlock({
    absoluteDiagramPath: input.absoluteDiagramPath,
    blocks,
    context: input.context,
    diagramPath: input.diagramPath,
    reference: input.reference
  });
}

export function readMarkdownBlocks(source: string, absolutePath: string): MarkdownBlock[] {
  const fallback = createMarkdownFallback(absolutePath);
  const lines = source.split("\n");
  const accumulator = createMarkdownBlockAccumulator();
  let currentHeading: MarkdownHeading | null = null;
  let fenceState: MarkdownFenceState | null = null;

  for (const line of lines) {
    ({ currentHeading, fenceState } = readNextMarkdownLine({
      accumulator,
      currentHeading,
      fallback,
      fenceState,
      line
    }));
  }

  return accumulator.blocks;
}

function readSelectedMarkdownDiagramBlock(input: {
  absoluteDiagramPath: string;
  blocks: MarkdownBlock[];
  context: TourContext;
  diagramPath: string;
  reference: {
    fragment: string | null;
    path: string;
  };
}): {
  ownedDiagramSourceId: string;
  source: string;
} {
  return input.reference.fragment === null
    ? readDefaultMarkdownDiagramBlock(input)
    : readFragmentMarkdownDiagramBlock(input);
}

function readDefaultMarkdownDiagramBlock(input: {
  absoluteDiagramPath: string;
  blocks: MarkdownBlock[];
  context: TourContext;
  diagramPath: string;
}): {
  ownedDiagramSourceId: string;
  source: string;
} {
  invariant(
    input.blocks.length === 1,
    createTourMessage(
      input.context,
      `diagram markdown file "${normalizePath(input.diagramPath)}" contains multiple Mermaid blocks; use a #fragment to select one`
    )
  );

  return {
    ownedDiagramSourceId: createDiagramSourceId(input.absoluteDiagramPath, input.blocks[0]!.id),
    source: input.blocks[0]!.source
  };
}

function readFragmentMarkdownDiagramBlock(input: {
  absoluteDiagramPath: string;
  blocks: MarkdownBlock[];
  context: TourContext;
  reference: {
    fragment: string | null;
    path: string;
  };
}): {
  ownedDiagramSourceId: string;
  source: string;
} {
  const fragment = input.reference.fragment!;
  const block = input.blocks.find((candidate) => candidate.id === fragment);

  invariant(
    block !== undefined,
    createTourMessage(
      input.context,
      `diagram markdown fragment "${fragment}" was not found in "${normalizePath(input.reference.path)}"`
    )
  );

  return {
    ownedDiagramSourceId: createDiagramSourceId(input.absoluteDiagramPath, block.id),
    source: block.source
  };
}

function readMarkdownFenceState(
  line: string,
  currentHeading: MarkdownHeading | null,
  fallback: MarkdownFallback
): MarkdownFenceState | null {
  const fence = readMarkdownFence(line);

  if (fence === null) {
    return null;
  }

  return {
    ...fence,
    block: currentHeading ?? {
      baseId: fallback.id,
      baseTitle: fallback.title
    },
    lines: [],
    mermaid: readMarkdownFenceInfoToken(fence.info) === "mermaid"
  };
}

function readMarkdownHeading(line: string): MarkdownHeading | null {
  const match = line.match(/^\s*#{1,6}\s+(.+?)\s*$/u);

  if (match === null) {
    return null;
  }

  const title = match[1].replace(/\s+#+\s*$/u, "").trim();

  return title.length === 0
    ? null
    : {
        baseId: createHeadingSlug(title),
        baseTitle: title
      };
}

function readMarkdownFence(line: string): MarkdownFence | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(`{3,}|~{3,})(.*)$/u);

  if (match === null) {
    return null;
  }

  return {
    character: match[1][0] as "`" | "~",
    info: match[2].trim(),
    length: match[1].length
  };
}

function readNextMarkdownFenceState(
  line: string,
  fenceState: MarkdownFenceState,
  accumulator: MarkdownBlockAccumulator
): MarkdownFenceState | null {
  if (tryCloseMarkdownFence(line, fenceState, accumulator)) {
    return null;
  }

  appendMarkdownFenceLine(fenceState, line);

  return fenceState;
}

function isMarkdownFenceClose(line: string, fence: MarkdownFence): boolean {
  const trimmed = line.trim();

  return (
    trimmed.length >= fence.length &&
    Array.from(trimmed).every((value) => value === fence.character)
  );
}

function createMarkdownFallback(absolutePath: string): MarkdownFallback {
  const title = createGeneratedTitle(absolutePath);

  return {
    id: createHeadingSlug(title),
    title
  };
}

function createMarkdownBlockAccumulator(): MarkdownBlockAccumulator {
  return {
    blocks: [],
    counts: new Map<string, number>()
  };
}

function createMarkdownBlock(
  fenceState: MarkdownFenceState,
  counts: Map<string, number>
): MarkdownBlock {
  const count = (counts.get(fenceState.block.baseId) ?? 0) + 1;

  counts.set(fenceState.block.baseId, count);

  return {
    id: createMarkdownBlockId(fenceState.block.baseId, count),
    source: fenceState.lines.join("\n").trim(),
    title: createMarkdownBlockTitle(fenceState.block.baseTitle, count)
  };
}

function assertMarkdownBlocks(
  blocks: MarkdownBlock[],
  context: TourContext,
  referencePath: string
): void {
  invariant(
    blocks.length > 0,
    createTourMessage(
      context,
      `diagram markdown file "${normalizePath(referencePath)}" does not contain any Mermaid fenced blocks`
    )
  );
}

function readNextMarkdownLine(input: {
  accumulator: MarkdownBlockAccumulator;
  currentHeading: MarkdownHeading | null;
  fallback: MarkdownFallback;
  fenceState: MarkdownFenceState | null;
  line: string;
}): {
  currentHeading: MarkdownHeading | null;
  fenceState: MarkdownFenceState | null;
} {
  if (input.fenceState !== null) {
    return {
      currentHeading: input.currentHeading,
      fenceState: readNextMarkdownFenceState(input.line, input.fenceState, input.accumulator)
    };
  }

  const currentHeading = readMarkdownHeading(input.line) ?? input.currentHeading;

  return {
    currentHeading,
    fenceState: readMarkdownFenceState(input.line, currentHeading, input.fallback)
  };
}

function tryCloseMarkdownFence(
  line: string,
  fenceState: MarkdownFenceState,
  accumulator: MarkdownBlockAccumulator
): boolean {
  if (!isMarkdownFenceClose(line, fenceState)) {
    return false;
  }

  if (fenceState.mermaid) {
    accumulator.blocks.push(createMarkdownBlock(fenceState, accumulator.counts));
  }

  return true;
}

function appendMarkdownFenceLine(fenceState: MarkdownFenceState, line: string): void {
  if (fenceState.mermaid) {
    fenceState.lines.push(line);
  }
}

function createMarkdownBlockId(baseId: string, count: number): string {
  return count === 1 ? baseId : `${baseId}-${count}`;
}

function createMarkdownBlockTitle(baseTitle: string, count: number): string {
  return count === 1 ? baseTitle : `${baseTitle} (${count})`;
}

function readMarkdownFenceInfoToken(info: string): string {
  const [token] = info.split(/\s+/u);

  return token;
}

function createHeadingSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug.length > 0 ? slug : "diagram";
}
