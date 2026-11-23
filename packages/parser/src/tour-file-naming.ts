import { basename, dirname } from "node:path";

import {
  DIAGRAM_FILE_SUFFIXES,
  MARKDOWN_DIAGRAM_FILE_SUFFIX,
  NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE,
  TOUR_FILE_SUFFIX
} from "./parser-contracts.js";
import { normalizePath } from "./tour-context.js";

export function readFileStem(sourcePath: string): string {
  return removeKnownSuffix(basename(sourcePath));
}

export function removeKnownSuffix(sourcePath: string): string {
  if (sourcePath.endsWith(TOUR_FILE_SUFFIX)) {
    return sourcePath.replace(TOUR_FILE_SUFFIX, "");
  }

  return DIAGRAM_FILE_SUFFIXES.reduce((result, suffix) => {
    return result.endsWith(suffix) ? result.slice(0, -suffix.length) : result;
  }, sourcePath);
}

export function createGeneratedTitle(absoluteDiagramPath: string): string {
  const words = readFileStem(basename(absoluteDiagramPath))
    .split(/[-_]+/u)
    .filter((word) => word.length > 0)
    .map(capitalizeWord)
    .join(" ");

  return words.length > 0 ? words : "Diagram";
}

export function createSlug(sourcePath: string): string {
  const normalizedPath = normalizePath(sourcePath);
  const fileStem = readFileStem(normalizedPath);
  const directoryPath = normalizePath(dirname(normalizedPath));

  if (directoryPath === "." || basename(directoryPath) !== fileStem) {
    return removeKnownSuffix(normalizedPath);
  }

  return directoryPath;
}

export function shouldIgnoreGeneratedDiscoveryError(
  absoluteDiagramPath: string,
  error: unknown
): boolean {
  return (
    absoluteDiagramPath.endsWith(MARKDOWN_DIAGRAM_FILE_SUFFIX) &&
    error instanceof Error &&
    error.message.includes(NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE)
  );
}

function capitalizeWord(input: string): string {
  return input.replace(/^./u, (character) => character.toUpperCase());
}
