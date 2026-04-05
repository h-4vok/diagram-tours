import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DIAGRAM_FILE_SUFFIXES,
  TOUR_FILE_SUFFIX,
  type SourcePaths
} from "./parser-contracts.js";

export async function collectSourcePaths(sourceRoot: string): Promise<SourcePaths> {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const nestedPaths = await Promise.all(entries.map((entry) => collectNestedSourcePaths(sourceRoot, entry)));

  return sortSourcePaths(mergeSourcePaths(nestedPaths));
}

async function collectNestedSourcePaths(sourceRoot: string, entry: Dirent): Promise<SourcePaths> {
  return entry.isDirectory()
    ? collectSourcePaths(resolve(sourceRoot, entry.name))
    : collectSourceFilePath(sourceRoot, entry.name);
}

function collectSourceFilePath(sourceRoot: string, name: string): SourcePaths {
  if (!name.endsWith(TOUR_FILE_SUFFIX)) {
    return {
      diagramPaths: collectDiagramFilePath(sourceRoot, name),
      tourPaths: []
    };
  }

  return {
    diagramPaths: [],
    tourPaths: [resolve(sourceRoot, name)]
  };
}

function collectDiagramFilePath(sourceRoot: string, name: string): string[] {
  if (!DIAGRAM_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return [];
  }

  return [resolve(sourceRoot, name)];
}

function mergeSourcePaths(items: SourcePaths[]): SourcePaths {
  return items.reduce(
    (result, item) => {
      result.diagramPaths.push(...item.diagramPaths);
      result.tourPaths.push(...item.tourPaths);

      return result;
    },
    {
      diagramPaths: [],
      tourPaths: []
    } satisfies SourcePaths
  );
}

function sortSourcePaths(paths: SourcePaths): SourcePaths {
  paths.diagramPaths.sort();
  paths.tourPaths.sort();

  return paths;
}
