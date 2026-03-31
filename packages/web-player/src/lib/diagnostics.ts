import type { SkippedResolvedDiagramTour } from "@diagram-tour/core";

export interface DiagnosticDisplayItem {
  code: string | null;
  detail: string | null;
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
  const message = stripTourPrefix(skipped.error);
  const summary = createDiagnosticSummary(message);
  const code = readDiagnosticCode(message);

  return {
    code,
    detail: readDiagnosticDetail(message, summary, code),
    path: skipped.sourcePath,
    summary
  };
}

function stripTourPrefix(error: string): string {
  return error.replace(/^Tour\s+".+?":\s*/u, "").trim();
}

function createDiagnosticSummary(message: string): string {
  return summarizeDiagnosticText(readSummarySource(message));
}

function readDiagnosticCode(message: string): string | null {
  return normalizeDiagnosticCode(readLastQuotedCode(message));
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

function readLastQuotedCode(message: string): string | undefined {
  return [...message.matchAll(/(["'`])([^"'`]+)\1/gu)].at(-1)?.[2];
}

function normalizeDiagnosticCode(code: string | undefined): string | null {
  const trimmedCode = trimOptionalCode(code);

  return isPopulatedCode(trimmedCode) ? trimmedCode : null;
}

function trimOptionalCode(code: string | undefined): string | undefined {
  return code?.trim();
}

function isPopulatedCode(code: string | undefined): code is string {
  return code !== undefined && code.length > 0;
}
