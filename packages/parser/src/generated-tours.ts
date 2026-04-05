import { basename, relative } from "node:path";

import type { ResolvedDiagramTour } from "@diagram-tour/core";

import { createDiagramModel, createGeneratedSteps, createResolvedDiagram } from "./diagram-model.js";
import { createDiagramSourceId, readMarkdownBlocks } from "./markdown-blocks.js";
import {
  MARKDOWN_DIAGRAM_FILE_SUFFIX,
  NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE,
  type LoadedCollectionEntry
} from "./parser-contracts.js";
import { createGeneratedTitle, createSlug } from "./tour-file-naming.js";
import { createTourContext, invariant, normalizePath, readTextFile } from "./tour-context.js";

export async function loadGeneratedDiagramTour(absoluteDiagramPath: string): Promise<ResolvedDiagramTour> {
  const diagramSource = await readTextFile(absoluteDiagramPath);

  return createGeneratedDiagramTour({
    diagramPath: normalizePath(basename(absoluteDiagramPath)),
    diagramSource,
    title: createGeneratedTitle(absoluteDiagramPath)
  });
}

export function createGeneratedDiagramTour(input: {
  diagramPath: string;
  diagramSource: string;
  title: string;
}): ResolvedDiagramTour {
  const diagramModel = createDiagramModel(
    input.diagramSource,
    createTourContext(normalizePath(input.diagramPath))
  );

  return {
    sourceKind: "generated",
    version: 1,
    title: input.title,
    diagram: createResolvedDiagram(input.diagramPath, diagramModel),
    steps: createGeneratedSteps(diagramModel.elements, input.title)
  };
}

export async function loadGeneratedCollectionEntries(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[]> {
  return input.absolutePath.endsWith(MARKDOWN_DIAGRAM_FILE_SUFFIX)
    ? createGeneratedMarkdownCollectionEntries(input)
    : [await createGeneratedRawCollectionEntry(input)];
}

async function createGeneratedRawCollectionEntry(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry> {
  const sourcePath = normalizePath(relative(input.sourceRoot, input.absolutePath));
  const tour = await loadGeneratedDiagramTour(input.absolutePath);

  return {
    entry: {
      slug: createSlug(sourcePath),
      sourcePath,
      title: tour.title,
      tour
    },
    sourceId: createDiagramSourceId(input.absolutePath)
  };
}

async function createGeneratedMarkdownCollectionEntries(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[]> {
  const source = await readTextFile(input.absolutePath);
  const relativePath = normalizePath(relative(input.sourceRoot, input.absolutePath));
  const blockEntries = readMarkdownBlocks(source, input.absolutePath);

  invariant(
    blockEntries.length > 0,
    `Markdown diagram "${normalizePath(input.absolutePath)}" ${NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE}`
  );

  return blockEntries.map((block) =>
    createGeneratedMarkdownCollectionEntry({
      absolutePath: input.absolutePath,
      block,
      fileSlug: createSlug(relativePath),
      relativePath,
      useBlockSuffix: blockEntries.length > 1
    })
  );
}

function createGeneratedMarkdownCollectionEntry(input: {
  absolutePath: string;
  block: {
    id: string;
    source: string;
    title: string;
  };
  fileSlug: string;
  relativePath: string;
  useBlockSuffix: boolean;
}): LoadedCollectionEntry {
  const entryPaths = readGeneratedMarkdownEntryPaths(input);

  return {
    entry: {
      slug: entryPaths.slug,
      sourcePath: entryPaths.sourcePath,
      title: input.block.title,
      tour: createGeneratedDiagramTour({
        diagramPath: entryPaths.diagramPath,
        diagramSource: input.block.source,
        title: input.block.title
      })
    },
    sourceId: createDiagramSourceId(input.absolutePath, input.block.id)
  };
}

function readGeneratedMarkdownEntryPaths(input: {
  absolutePath: string;
  block: {
    id: string;
  };
  fileSlug: string;
  relativePath: string;
  useBlockSuffix: boolean;
}): {
  diagramPath: string;
  slug: string;
  sourcePath: string;
} {
  const suffix = readGeneratedMarkdownBlockSuffix(input.useBlockSuffix, input.block.id);

  return {
    diagramPath: `${normalizePath(basename(input.absolutePath))}${suffix.hash}`,
    slug: `${input.fileSlug}${suffix.slug}`,
    sourcePath: `${input.relativePath}${suffix.hash}`
  };
}

function readGeneratedMarkdownBlockSuffix(useBlockSuffix: boolean, blockId: string): {
  hash: string;
  slug: string;
} {
  if (!useBlockSuffix) {
    return {
      hash: "",
      slug: ""
    };
  }

  return {
    hash: `#${blockId}`,
    slug: `/${blockId}`
  };
}
