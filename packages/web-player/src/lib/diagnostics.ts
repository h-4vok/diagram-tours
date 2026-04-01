import type { DiagnosticLocation, SkippedResolvedDiagramTour } from "@diagram-tour/core";

export interface DiagnosticDisplayIssue {
  code: string | null;
  detail: string | null;
  location: DiagnosticLocation | null;
  reference: string;
  summary: string;
}

export interface DiagnosticDisplayGroup {
  issueCount: number;
  issues: DiagnosticDisplayIssue[];
  path: string;
}

export function createDiagnosticDisplayGroups(
  skippedTours: SkippedResolvedDiagramTour[]
): DiagnosticDisplayGroup[] {
  return skippedTours.map((skipped) => createDiagnosticDisplayGroup(skipped));
}

export function countDiagnosticIssues(groups: DiagnosticDisplayGroup[]): number {
  return groups.reduce((total, group) => total + group.issueCount, 0);
}

function createDiagnosticDisplayGroup(
  skipped: SkippedResolvedDiagramTour
): DiagnosticDisplayGroup {
  return {
    issueCount: skipped.diagnostics.length,
    issues: skipped.diagnostics.map((diagnostic) => createDiagnosticDisplayIssue(skipped.sourcePath, diagnostic)),
    path: skipped.sourcePath
  };
}

function createDiagnosticDisplayIssue(
  path: string,
  diagnostic: SkippedResolvedDiagramTour["diagnostics"][number]
): DiagnosticDisplayIssue {
  const summary = createDiagnosticSummary(diagnostic.message);

  return {
    code: diagnostic.code,
    detail: readDiagnosticDetail(diagnostic.message, summary, diagnostic.code),
    location: diagnostic.location,
    reference: createDiagnosticReference(path, diagnostic.location),
    summary
  };
}

function createDiagnosticReference(path: string, location: DiagnosticLocation | null): string {
  if (location === null) {
    return path;
  }

  return `${path}:${location.line}:${location.column}`;
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
