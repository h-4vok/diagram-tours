import type { DiagnosticLocation, SkippedResolvedDiagramTour } from "@diagram-tour/core";

export interface DiagnosticDisplayItem {
  code: string | null;
  detail: string | null;
  location: DiagnosticLocation | null;
  path: string;
  summary: string;
}

export function createDiagnosticDisplayItems(
  skippedTours: SkippedResolvedDiagramTour[]
): DiagnosticDisplayItem[] {
  return skippedTours.map((skipped) => createDiagnosticDisplayItem(skipped));
}

function createDiagnosticDisplayItem(
  skipped: SkippedResolvedDiagramTour
): DiagnosticDisplayItem {
  const diagnostic = skipped.diagnostic;
  const summary = createDiagnosticSummary(diagnostic.message);

  return {
    code: diagnostic.code,
    detail: readDiagnosticDetail(diagnostic.message, summary, diagnostic.code),
    location: diagnostic.location,
    path: skipped.sourcePath,
    summary
  };
}

function createDiagnosticSummary(message: string): string {
  return summarizeDiagnosticText(readSummarySource(message));
}

function stripQuotedCode(message: string): string {
  return message.replace(/\s*(["'`])([^"'`]+)\1/gu, "").trim();
}

function readSummarySource(message: string): string {
  const withoutCode = stripQuotedCode(message);

  return withoutCode.length > 0 ? withoutCode : message;
}

function readDiagnosticDetail(
  message: string,
  summary: string,
  code: string | null
): string | null {
  const detail = message.trim();

  return shouldOmitDiagnosticDetail(detail, summary, code) ? null : detail;
}

function summarizeDiagnosticText(message: string): string {
  return message.length <= 120 ? message : `${message.slice(0, 117).trimEnd()}...`;
}

function shouldOmitDiagnosticDetail(detail: string, summary: string, code: string | null): boolean {
  return detail === summary || detail === createSummaryWithCode(summary, code);
}

function createSummaryWithCode(summary: string, code: string | null): string {
  return `${summary} ${code ?? ""}`.trim();
}
