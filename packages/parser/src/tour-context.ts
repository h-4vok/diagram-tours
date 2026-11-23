import { readFile } from "node:fs/promises";

import { LineCounter, isScalar } from "yaml";

import type { DiagnosticLocation, TourDiagnostic } from "@diagram-tour/core";

import type {
  ParsedYamlDocument,
  StepValueNode,
  TourValidationCollector
} from "./parser-contracts.js";
import { createTourDiagnostic } from "./diagnostics.js";

export interface TourContext {
  sourcePath: string;
}

export function createTourContext(sourcePath: string): TourContext {
  return {
    sourcePath: normalizePath(sourcePath)
  };
}

export function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n");
}

export async function readTextFile(path: string): Promise<string> {
  const source = await readFile(path, "utf8");

  return normalizeNewlines(source);
}

export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function createTourMessage(context: TourContext, message: string): string {
  return `Tour "${context.sourcePath}": ${message}`;
}

export function createStepMessage(
  input: { context: TourContext; stepIndex: number },
  message: string
): string {
  return createTourMessage(input.context, `step ${input.stepIndex} ${message}`);
}

export function createStepFieldMessage(
  input: { context: TourContext; stepIndex: number },
  field: "focus" | "text",
  message: string
): string {
  return createTourMessage(input.context, `step ${input.stepIndex} ${field} ${message}`);
}

export async function runWithContext<T>(
  context: TourContext,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw ensureContextualError(error, context);
  }
}

export function ensureContextualError(error: unknown, context: TourContext): Error {
  if (!(error instanceof Error)) {
    return new Error(createTourMessage(context, "failed unexpectedly"));
  }

  if (error.message.startsWith(`Tour "${context.sourcePath}"`)) {
    return error;
  }

  return createContextualError(error, context);
}

export function createTourValidationCollector(): TourValidationCollector {
  return {
    diagnostics: [],
    seen: new Set<string>()
  };
}

export function appendDiagnostic(
  collector: TourValidationCollector,
  diagnostic: Omit<TourDiagnostic, "code"> & { code?: string | null }
): void {
  const normalizedDiagnostic = normalizeCollectedDiagnostic(diagnostic);
  const diagnosticId = createCollectedDiagnosticId(normalizedDiagnostic);

  if (collector.seen.has(diagnosticId)) {
    return;
  }

  collector.seen.add(diagnosticId);
  collector.diagnostics.push(normalizedDiagnostic);
}

export function readDiagnosticLocationKey(diagnostic: TourDiagnostic): string {
  if (diagnostic.location === null) {
    return ":";
  }

  return `${diagnostic.location.line}:${diagnostic.location.column}`;
}

export function createTourValidationError(
  context: TourContext,
  diagnostics: TourDiagnostic[]
): Error {
  const error = new Error(createTourMessage(context, diagnostics[0]!.message));

  (error as Error & { diagnostics?: TourDiagnostic[] }).diagnostics = diagnostics;

  return error;
}

export function readFieldLocation(
  node: unknown,
  parsedDocument: ParsedYamlDocument,
  lineCounter: LineCounter
): DiagnosticLocation | null {
  return readNodeLocation(node, lineCounter) ?? readDocumentLocation(parsedDocument, lineCounter);
}

export function readDocumentLocation(
  parsedDocument: ParsedYamlDocument,
  lineCounter: LineCounter
): DiagnosticLocation | null {
  return toDiagnosticLocation(parsedDocument.range![0], lineCounter);
}

export function readNodeLocation(
  node: unknown,
  lineCounter: LineCounter
): DiagnosticLocation | null {
  const offset = readNodeStartOffset(node);

  if (offset === null) {
    return null;
  }

  return toDiagnosticLocation(offset, lineCounter);
}

export function createSourceLineCounter(source: string): LineCounter {
  const lineCounter = new LineCounter();

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      lineCounter.addNewLine(index);
    }
  }

  return lineCounter;
}

export function isNonEmptyScalarString(value: unknown): value is StepValueNode {
  return isScalar(value) && typeof value.value === "string" && value.value.length > 0;
}

export function readSupportedVersionValue(node: unknown): number | null {
  if (node === null) {
    return null;
  }

  if (!isNumericScalar(node)) {
    return null;
  }

  return node.value;
}

export function readNodeValue(node: unknown): unknown {
  if (!isScalar(node)) {
    return undefined;
  }

  return node.value;
}

function createContextualError(error: Error, context: TourContext): Error {
  const diagnostic = createTourDiagnostic(error);
  const contextualError = new Error(createTourMessage(context, diagnostic.message));

  attachContextualLocation(contextualError, diagnostic.location);
  attachContextualCode(contextualError, diagnostic.code);

  return contextualError;
}

function attachContextualLocation(
  error: Error,
  location: DiagnosticLocation | null
): void {
  if (location === null) {
    return;
  }

  (error as Error & { location?: DiagnosticLocation | null }).location = location;
}

function attachContextualCode(error: Error, code: string | null): void {
  if (code === null) {
    return;
  }

  (error as Error & { code?: string | null }).code = code;
}

function normalizeCollectedDiagnostic(
  diagnostic: Omit<TourDiagnostic, "code"> & { code?: string | null }
): TourDiagnostic {
  return {
    code: diagnostic.code ?? null,
    location: diagnostic.location,
    message: stripTourContextPrefix(diagnostic.message)
  };
}

function createCollectedDiagnosticId(diagnostic: TourDiagnostic): string {
  return `${diagnostic.message}:${readDiagnosticLocationKey(diagnostic)}`;
}

function stripTourContextPrefix(message: string): string {
  return message.replace(/^Tour\s+".+?":\s*/u, "").trim();
}

function readNodeStartOffset(node: unknown): number | null {
  const range = readNodeRange(node);

  if (range === null) {
    return null;
  }

  return range[0];
}

function readNodeRange(node: unknown): [number, number, number] | null {
  return hasConcreteNodeRange(node) ? node.range : null;
}

function hasConcreteNodeRange(node: unknown): node is { range: [number, number, number] } {
  return typeof node === "object"
    && node !== null
    && Array.isArray((node as { range?: unknown }).range);
}

function toDiagnosticLocation(
  offset: number,
  lineCounter: LineCounter
): DiagnosticLocation {
  const position = lineCounter.linePos(offset);

  return {
    column: position.col,
    line: position.line
  };
}

function isNumericScalar(node: unknown): node is StepValueNode & { value: number } {
  return isScalar(node) && typeof node.value === "number";
}
