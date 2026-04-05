import { relative } from "node:path";

import type { SkippedResolvedDiagramTour } from "@diagram-tour/core";

import { createTourDiagnostics } from "./diagnostics.js";
import { normalizePath } from "./tour-context.js";

export function createSkippedTourEntry(
  absoluteTourPath: string,
  sourceRoot: string,
  error: unknown
): SkippedResolvedDiagramTour {
  const diagnostics = createTourDiagnostics(error);

  return {
    diagnostics,
    sourceId: normalizePath(absoluteTourPath),
    sourcePath: normalizePath(relative(sourceRoot, absoluteTourPath))
  };
}
