import type { SkippedResolvedDiagramTour } from "@diagram-tour/core";

export interface DiagnosticDisplayItem {
  detail: string | null;
  path: string;
  summary: string;
  title: string;
}

export function createDiagnosticDisplayItems(
  skippedTours: SkippedResolvedDiagramTour[]
): DiagnosticDisplayItem[] {
  return skippedTours.map((skipped) => createDiagnosticDisplayItem(skipped));
}

function createDiagnosticDisplayItem(
  skipped: SkippedResolvedDiagramTour
): DiagnosticDisplayItem {
  const message = stripTourPrefix(skipped.error);
  const summary = createDiagnosticSummary(message);

  return {
    detail: summary === message ? null : message,
    path: skipped.sourcePath,
    summary,
    title: readDiagnosticTitle(skipped.sourcePath)
  };
}

function stripTourPrefix(error: string): string {
  return error.replace(/^Tour\s+".+?":\s*/u, "").trim();
}

function createDiagnosticSummary(message: string): string {
  return message.length <= 120 ? message : `${message.slice(0, 117).trimEnd()}...`;
}

function readDiagnosticTitle(sourcePath: string): string {
  return sourcePath.split("/").slice(-1)[0];
}
