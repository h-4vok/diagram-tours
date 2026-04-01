import type { DiagnosticLocation, TourDiagnostic } from "@diagram-tour/core";

type ErrorWithLocation = Error & {
  code?: unknown;
  diagnostics?: TourDiagnostic[] | null;
  linePos?: Array<{ col: number; line: number } | null | undefined>;
  location?: DiagnosticLocation | null;
};

export function createTourDiagnostic(error: unknown): TourDiagnostic {
  return createTourDiagnostics(error)[0] ?? {
    code: null,
    location: null,
    message: "failed unexpectedly"
  };
}

export function createTourDiagnostics(error: unknown): TourDiagnostic[] {
  const directDiagnostics = readDirectDiagnostics(error);

  if (directDiagnostics !== null) {
    return directDiagnostics;
  }

  const message = stripTourPrefix(readErrorMessage(error));

  return [{
    code: readDiagnosticCode(error, message),
    location: readDiagnosticLocation(error),
    message
  }];
}

export function formatTourDiagnostic(
  sourcePath: string,
  diagnostic: TourDiagnostic
): string {
  const location = diagnostic.location === null ? "" : `:${diagnostic.location.line}:${diagnostic.location.column}`;

  return `${sourcePath}${location} ${diagnostic.message}`;
}

export function formatTourDiagnostics(
  sourcePath: string,
  diagnostics: TourDiagnostic[]
): string[] {
  return diagnostics.map((diagnostic) => formatTourDiagnostic(sourcePath, diagnostic));
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "failed unexpectedly";
}

function readDirectDiagnostics(error: unknown): TourDiagnostic[] | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const diagnostics = (error as ErrorWithLocation).diagnostics;

  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return null;
  }

  return diagnostics;
}

function stripTourPrefix(message: string): string {
  return message.replace(/^Tour\s+".+?":\s*/u, "").trim();
}

function readDiagnosticCode(error: unknown, message: string): string | null {
  return normalizeDiagnosticCode(readErrorCode(error) ?? readLastQuotedCode(message));
}

function readErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const rawCode = (error as ErrorWithLocation).code;

  return typeof rawCode === "string" ? rawCode : undefined;
}

function readLastQuotedCode(message: string): string | undefined {
  return [...message.matchAll(/(["'`])([^"'`]+)\1/gu)].at(-1)?.[2];
}

function readDiagnosticLocation(error: unknown): DiagnosticLocation | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const typedError = error as ErrorWithLocation;

  const directLocation = readDirectDiagnosticLocation(typedError);

  if (directLocation !== null) {
    return directLocation;
  }

  return readLinePosDiagnosticLocation(typedError.linePos);
}

function readDirectDiagnosticLocation(error: ErrorWithLocation): DiagnosticLocation | null {
  if (error.location === undefined) {
    return null;
  }

  return error.location;
}

function readLinePosDiagnosticLocation(
  linePos: ErrorWithLocation["linePos"]
): DiagnosticLocation | null {
  if (!Array.isArray(linePos)) {
    return null;
  }

  return readFirstLinePosition(linePos);
}

function readFirstLinePosition(
  linePos: Array<{ col: number; line: number } | null | undefined>
): DiagnosticLocation | null {
  if (linePos.length === 0) {
    return null;
  }

  return readLinePosition(linePos[0]);
}

function readLinePosition(
  position: { col: number; line: number } | null | undefined
): DiagnosticLocation | null {
  if (position === undefined || position === null) {
    return null;
  }

  return {
    column: position.col,
    line: position.line
  };
}

function normalizeDiagnosticCode(code: string | undefined): string | null {
  if (code === undefined) {
    return null;
  }

  const trimmedCode = code.trim();

  return trimmedCode.length === 0 ? null : trimmedCode;
}
