import { stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { SkippedResolvedDiagramTour } from "@diagram-tour/core";

import { loadAuthoredTourDocument } from "./authored-tour-loader.js";
import { createTourDiagnostic } from "./diagnostics.js";
import {
  DIAGRAM_FILE_SUFFIXES,
  TOUR_FILE_SUFFIX,
  type TourValidationIssue,
  type TourValidationReport,
  type ValidationTargetReport,
  type ValidationTargetState
} from "./parser-contracts.js";
import { createSkippedTourEntry } from "./skipped-tour.js";
import { collectSourcePaths } from "./source-path-discovery.js";
import { createTourContext, normalizePath, readDiagnosticLocationKey } from "./tour-context.js";
import { loadResolvedTourCollection, readDiscoveredTourCollection } from "./tour-collection.js";

export async function validateResolvedTourTargets(
  sourceTargets: string[]
): Promise<TourValidationReport> {
  const issues: TourValidationIssue[] = [];
  const countedSourceIds = new Set<string>();
  const invalidSourceIds = new Set<string>();
  const seenIssueIds = new Set<string>();

  for (const target of sourceTargets.length > 0 ? sourceTargets : ["."]) {
    appendValidationReport({
      countedSourceIds,
      invalidSourceIds,
      issues,
      seenIssueIds,
      targetReport: await validateResolvedTourTarget(target)
    });
  }

  issues.sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  return {
    issues,
    total: countedSourceIds.size,
    valid: countedSourceIds.size - invalidSourceIds.size
  };
}

export async function validateDiscoveredTours(sourceTarget: string): Promise<{
  invalid: SkippedResolvedDiagramTour[];
  valid: string[];
}> {
  const absoluteTarget = resolve(sourceTarget);
  const targetStats = await stat(absoluteTarget);

  return targetStats.isFile()
    ? validateSingleDiscoveredTour(absoluteTarget)
    : validateDiscoveredTourDirectory(absoluteTarget);
}

async function validateResolvedTourTarget(target: string): Promise<ValidationTargetReport> {
  const absoluteTarget = resolve(target);
  const targetState = await resolveValidationTarget(absoluteTarget);

  if (targetState === null) {
    return createSingleIssueValidationReport(createMissingValidationTargetIssue(absoluteTarget, target));
  }

  if (targetState.kind === "unsupported") {
    return createSingleIssueValidationReport(
      createUnsupportedValidationTargetIssue(targetState.absolutePath, target)
    );
  }

  return readResolvedValidationTargetReport(targetState, absoluteTarget, target);
}

async function readValidationTargetCollection(
  targetState: Exclude<ValidationTargetState, { kind: "unsupported" }>
) {
  if (targetState.kind === "directory") {
    return readDiscoveredTourCollection(targetState.absolutePath);
  }

  try {
    return await loadResolvedTourCollection(targetState.absolutePath);
  } catch (error) {
    return {
      entries: [],
      skipped: [createSkippedTourEntry(targetState.absolutePath, dirname(targetState.absolutePath), error)]
    };
  }
}

function readValidationEntrySourceId(
  targetState: Exclude<ValidationTargetState, { kind: "unsupported" }>,
  sourcePath: string
): string {
  return normalizePath(resolve(readValidationTargetSourceRoot(targetState), sourcePath));
}

function readValidationTargetSourceRoot(
  targetState: Exclude<ValidationTargetState, { kind: "unsupported" }>
): string {
  return targetState.kind === "directory" ? targetState.absolutePath : dirname(targetState.absolutePath);
}

function appendValidationReport(input: {
  countedSourceIds: Set<string>;
  invalidSourceIds: Set<string>;
  issues: TourValidationIssue[];
  seenIssueIds: Set<string>;
  targetReport: ValidationTargetReport;
}): void {
  appendSourceIds(input.countedSourceIds, input.targetReport.countedSourceIds);
  appendSourceIds(input.invalidSourceIds, input.targetReport.invalidSourceIds);
  appendValidationIssues(input.issues, input.seenIssueIds, input.targetReport.issues);
}

async function validateSingleDiscoveredTour(absolutePath: string): Promise<{
  invalid: SkippedResolvedDiagramTour[];
  valid: string[];
}> {
  const sourceRoot = dirname(absolutePath);

  return absolutePath.endsWith(TOUR_FILE_SUFFIX)
    ? validateAuthoredTourPaths({
        sourceRoot,
        tourPaths: [absolutePath]
      })
    : {
        invalid: [],
        valid: []
      };
}

async function validateDiscoveredTourDirectory(sourceRoot: string): Promise<{
  invalid: SkippedResolvedDiagramTour[];
  valid: string[];
}> {
  const discoveredPaths = await collectSourcePaths(sourceRoot);

  return validateAuthoredTourPaths({
    sourceRoot,
    tourPaths: discoveredPaths.tourPaths
  });
}

async function validateAuthoredTourPaths(input: {
  sourceRoot: string;
  tourPaths: string[];
}): Promise<{
  invalid: SkippedResolvedDiagramTour[];
  valid: string[];
}> {
  const result = {
    invalid: [],
    valid: []
  } as {
    invalid: SkippedResolvedDiagramTour[];
    valid: string[];
  };

  for (const absoluteTourPath of input.tourPaths) {
    await appendValidatedTourPath(absoluteTourPath, input.sourceRoot, result);
  }

  result.valid.sort();

  return result;
}

async function resolveValidationTarget(
  absolutePath: string
): Promise<ValidationTargetState | null> {
  try {
    return readValidationTargetStats(absolutePath, await stat(absolutePath));
  } catch {
    return null;
  }
}

function isSupportedValidationFile(absolutePath: string): boolean {
  return [TOUR_FILE_SUFFIX, ...DIAGRAM_FILE_SUFFIXES].some((suffix) => absolutePath.endsWith(suffix));
}

function createMissingValidationTargetIssue(absoluteTarget: string, target: string): TourValidationIssue {
  return {
    diagnostic: {
      code: null,
      location: null,
      message: `Path does not exist: ${normalizePath(absoluteTarget)}`
    },
    sourceId: normalizePath(absoluteTarget),
    sourcePath: normalizePath(target)
  };
}

function createUnsupportedValidationTargetIssue(
  absoluteTarget: string,
  target: string
): TourValidationIssue {
  return {
    diagnostic: {
      code: null,
      location: null,
      message: `Expected a .tour.yaml, .mmd, .mermaid, .md file, or a directory: ${normalizePath(absoluteTarget)}`
    },
    sourceId: normalizePath(absoluteTarget),
    sourcePath: normalizePath(target)
  };
}

function createNoValidToursIssue(absoluteTarget: string, target: string): TourValidationIssue {
  return {
    diagnostic: {
      code: null,
      location: null,
      message: `No valid tours or diagrams were discovered in source target "${normalizePath(absoluteTarget)}".`
    },
    sourceId: normalizePath(absoluteTarget),
    sourcePath: normalizePath(target)
  };
}

function createUnexpectedValidationIssue(
  absoluteTarget: string,
  target: string,
  error: unknown
): TourValidationIssue {
  return {
    diagnostic: createTourDiagnostic(error),
    sourceId: normalizePath(absoluteTarget),
    sourcePath: normalizePath(target)
  };
}

async function readResolvedValidationTargetReport(
  targetState: Exclude<ValidationTargetState, { kind: "unsupported" }>,
  absoluteTarget: string,
  target: string
): Promise<ValidationTargetReport> {
  try {
    const collection = await readValidationTargetCollection(targetState);

    return readValidationCollectionReport({
      absoluteTarget,
      collection,
      target,
      targetState
    });
  } catch (error) {
    return createSingleIssueValidationReport(createUnexpectedValidationIssue(absoluteTarget, target, error));
  }
}

function readValidationCollectionReport(
  input: {
    absoluteTarget: string;
    collection: Awaited<ReturnType<typeof loadResolvedTourCollection>>;
    target: string;
    targetState: Exclude<ValidationTargetState, { kind: "unsupported" }>;
  }
): ValidationTargetReport {
  if (input.collection.entries.length === 0 && input.collection.skipped.length === 0) {
    return createSingleIssueValidationReport(
      createNoValidToursIssue(input.absoluteTarget, input.target)
    );
  }

  return {
    countedSourceIds: [
      ...input.collection.entries.map((entry) =>
        readValidationEntrySourceId(input.targetState, entry.sourcePath)
      ),
      ...input.collection.skipped.map((skipped) => skipped.sourceId)
    ],
    invalidSourceIds: input.collection.skipped.map((skipped) => skipped.sourceId),
    issues: readSkippedValidationIssues(input.collection.skipped)
  };
}

function appendSourceIds(target: Set<string>, sourceIds: string[]): void {
  for (const sourceId of sourceIds) {
    target.add(sourceId);
  }
}

function appendValidationIssues(
  issues: TourValidationIssue[],
  seenIssueIds: Set<string>,
  targetIssues: TourValidationIssue[]
): void {
  for (const issue of targetIssues) {
    appendValidationIssue(issues, seenIssueIds, issue);
  }
}

function appendValidationIssue(
  issues: TourValidationIssue[],
  seenIssueIds: Set<string>,
  issue: TourValidationIssue
): void {
  const issueId = `${issue.sourceId}:${issue.diagnostic.message}:${readDiagnosticLocationKey(issue.diagnostic)}`;

  if (seenIssueIds.has(issueId)) {
    return;
  }

  seenIssueIds.add(issueId);
  issues.push(issue);
}

async function appendValidatedTourPath(
  absoluteTourPath: string,
  sourceRoot: string,
  result: {
    invalid: SkippedResolvedDiagramTour[];
    valid: string[];
  }
): Promise<void> {
  try {
    await loadAuthoredTourDocument({
      absoluteTourPath,
      context: createTourContext(absoluteTourPath)
    });
    result.valid.push(normalizePath(relative(sourceRoot, absoluteTourPath)));
  } catch (error) {
    result.invalid.push(createSkippedTourEntry(absoluteTourPath, sourceRoot, error));
  }
}

function readValidationTargetStats(
  absolutePath: string,
  targetStats: Awaited<ReturnType<typeof stat>>
): ValidationTargetState {
  if (targetStats.isDirectory()) {
    return {
      absolutePath,
      kind: "directory"
    };
  }

  return isSupportedValidationFile(absolutePath)
    ? {
        absolutePath,
        kind: "file"
      }
    : {
        absolutePath,
        kind: "unsupported"
      };
}

function createSingleIssueValidationReport(issue: TourValidationIssue): ValidationTargetReport {
  return {
    countedSourceIds: [],
    invalidSourceIds: [],
    issues: [issue]
  };
}

function readSkippedValidationIssues(
  skippedTours: Awaited<ReturnType<typeof loadResolvedTourCollection>>["skipped"]
): TourValidationIssue[] {
  return skippedTours.flatMap((skipped) =>
    skipped.diagnostics.map((diagnostic) => ({
      diagnostic,
      sourceId: skipped.sourceId,
      sourcePath: skipped.sourcePath
    }))
  );
}
