import { stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { ResolvedDiagramTourCollection, ResolvedDiagramTourCollectionEntry, SkippedResolvedDiagramTour } from "@diagram-tour/core";

import { loadAuthoredTourDocument } from "./authored-tour-loader.js";
import { loadGeneratedCollectionEntries } from "./generated-tours.js";
import {
  NO_VALID_TOURS_MESSAGE,
  TOUR_FILE_SUFFIX,
  type LoadedCollectionEntry
} from "./parser-contracts.js";
import { createSkippedTourEntry } from "./skipped-tour.js";
import { collectSourcePaths } from "./source-path-discovery.js";
import { createSlug, shouldIgnoreGeneratedDiscoveryError } from "./tour-file-naming.js";
import { createTourContext, invariant, normalizePath } from "./tour-context.js";

export async function loadResolvedTourCollection(
  sourceTarget: string
): Promise<ResolvedDiagramTourCollection> {
  const absoluteTarget = resolve(sourceTarget);
  const targetStats = await stat(absoluteTarget);

  if (targetStats.isFile()) {
    return createSingleEntryCollection(absoluteTarget);
  }

  const collection = await readDiscoveredTourCollection(absoluteTarget);

  invariant(
    collection.entries.length > 0,
    `${NO_VALID_TOURS_MESSAGE} in source target "${normalizePath(absoluteTarget)}".`
  );

  return collection;
}

export async function readDiscoveredTourCollection(
  sourceRoot: string
): Promise<ResolvedDiagramTourCollection> {
  return createDiscoveredTourCollection(sourceRoot);
}

async function createSingleEntryCollection(
  absolutePath: string
): Promise<ResolvedDiagramTourCollection> {
  const entries = await createCollectionEntries({
    absolutePath,
    sourceRoot: dirname(absolutePath)
  });

  return {
    entries: entries.map((item) => item.entry),
    skipped: []
  };
}

async function createDiscoveredTourCollection(
  sourceRoot: string
): Promise<ResolvedDiagramTourCollection> {
  const discoveredPaths = await collectSourcePaths(sourceRoot);
  const result = createDiscoveredCollectionResult();
  const authoredDiagramPaths = await appendAuthoredDiscoveryResults({
    result,
    sourceRoot,
    tourPaths: discoveredPaths.tourPaths
  });

  await appendGeneratedDiscoveryResults({
    authoredDiagramPaths,
    diagramPaths: discoveredPaths.diagramPaths,
    result,
    sourceRoot
  });
  result.entries.sort((left, right) => left.slug.localeCompare(right.slug));

  return result;
}

function createDiscoveredCollectionResult(): {
  entries: ResolvedDiagramTourCollectionEntry[];
  skipped: SkippedResolvedDiagramTour[];
} {
  return {
    entries: [],
    skipped: []
  };
}

async function appendAuthoredDiscoveryResults(input: {
  result: {
    entries: ResolvedDiagramTourCollectionEntry[];
    skipped: SkippedResolvedDiagramTour[];
  };
  sourceRoot: string;
  tourPaths: string[];
}): Promise<Set<string>> {
  const authoredDiagramPaths = new Set<string>();

  for (const absoluteTourPath of input.tourPaths) {
    const ownedDiagramSourceIds = await appendDiscoveredTourResult({
      absolutePath: absoluteTourPath,
      result: input.result,
      sourceRoot: input.sourceRoot
    });

    addOwnedDiagramPaths(authoredDiagramPaths, ownedDiagramSourceIds);
  }

  return authoredDiagramPaths;
}

function addOwnedDiagramPaths(
  authoredDiagramPaths: Set<string>,
  ownedDiagramSourceIds: string[] | null
): void {
  if (ownedDiagramSourceIds === null) {
    return;
  }

  for (const ownedDiagramSourceId of ownedDiagramSourceIds) {
    authoredDiagramPaths.add(ownedDiagramSourceId);
  }
}

async function appendGeneratedDiscoveryResults(input: {
  authoredDiagramPaths: Set<string>;
  diagramPaths: string[];
  result: {
    entries: ResolvedDiagramTourCollectionEntry[];
    skipped: SkippedResolvedDiagramTour[];
  };
  sourceRoot: string;
}): Promise<void> {
  for (const absoluteDiagramPath of input.diagramPaths) {
    const loadedEntries = await tryLoadGeneratedDiscoveryEntries({
      absoluteDiagramPath,
      sourceRoot: input.sourceRoot
    });

    if (loadedEntries === null) {
      continue;
    }

    input.result.entries.push(
      ...loadedEntries
        .filter((item) => !input.authoredDiagramPaths.has(item.sourceId))
        .map((item) => item.entry)
    );
  }
}

async function tryLoadGeneratedDiscoveryEntries(input: {
  absoluteDiagramPath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[] | null> {
  try {
    return await loadGeneratedCollectionEntries({
      absolutePath: input.absoluteDiagramPath,
      sourceRoot: input.sourceRoot
    });
  } catch (error) {
    if (shouldIgnoreGeneratedDiscoveryError(input.absoluteDiagramPath, error)) {
      return null;
    }

    throw error;
  }
}

async function appendDiscoveredTourResult(input: {
  absolutePath: string;
  result: {
    entries: ResolvedDiagramTourCollectionEntry[];
    skipped: SkippedResolvedDiagramTour[];
  };
  sourceRoot: string;
}): Promise<string[] | null> {
  try {
    const loadedEntries = await createCollectionEntries({
      absolutePath: input.absolutePath,
      sourceRoot: input.sourceRoot
    });

    input.result.entries.push(...loadedEntries.map((item) => item.entry));

    return loadedEntries.map((item) => item.sourceId);
  } catch (error) {
    input.result.skipped.push(createSkippedTourEntry(input.absolutePath, input.sourceRoot, error));

    return null;
  }
}

async function createCollectionEntries(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[]> {
  return input.absolutePath.endsWith(TOUR_FILE_SUFFIX)
    ? [await createAuthoredCollectionEntry(input)]
    : await loadGeneratedCollectionEntries(input);
}

async function createAuthoredCollectionEntry(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry> {
  const sourcePath = normalizePath(relative(input.sourceRoot, input.absolutePath));
  const loadedTour = await loadAuthoredTourDocument({
    absoluteTourPath: input.absolutePath,
    context: createTourContext(input.absolutePath)
  });

  return {
    entry: {
      slug: createSlug(sourcePath),
      sourcePath,
      title: loadedTour.tour.title,
      tour: loadedTour.tour
    },
    sourceId: loadedTour.ownedDiagramSourceId
  };
}
