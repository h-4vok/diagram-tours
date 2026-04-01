import type { Dirent } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

import {
  SUPPORTED_TOUR_VERSION,
  type DiagnosticLocation,
  type DiagramElement,
  type DiagramTour,
  type DiagramType,
  type ResolvedDiagramTour,
  type ResolvedDiagramTourCollection,
  type ResolvedDiagramTourCollectionEntry,
  type SkippedResolvedDiagramTour,
  type TourDiagnostic,
  type TourStep
} from "@diagram-tour/core";
import {
  LineCounter,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type ParsedNode,
  type Scalar,
  type YAMLMap,
  type YAMLSeq
} from "yaml";
import { createTourDiagnostic, createTourDiagnostics } from "./diagnostics.js";

const FLOWCHART_NODE_PATTERN = /([A-Za-z][A-Za-z0-9_]*)\[([^\]]+)\]/g;
const NODE_REFERENCE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;
const SEQUENCE_DIAGRAM_PATTERN = /^\s*sequenceDiagram\b/mu;
const SEQUENCE_PARTICIPANT_PATTERN =
  /^\s*(?:create\s+)?(participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+as\s+(.+?))?\s*$/u;
const SEQUENCE_MESSAGE_PATTERN =
  /:\s*\[([A-Za-z][A-Za-z0-9_]*)\]\s+(.+?)\s*(?:;+\s*)?$/u;
const DIAGRAM_FILE_SUFFIXES = [".mmd", ".md", ".mermaid"];
const MARKDOWN_DIAGRAM_FILE_SUFFIX = ".md";
const TOUR_FILE_SUFFIX = ".tour.yaml";
const NO_VALID_TOURS_MESSAGE = "No valid tours or diagrams were discovered";
const NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE = "does not contain any Mermaid fenced blocks.";

type ElementIndex = Map<string, DiagramElement>;
type ReferenceKind = "focus" | "text";
type DiagramReference = {
  fragment: string | null;
  path: string;
};
type LoadedAuthoredTour = {
  ownedDiagramSourceId: string;
  tour: ResolvedDiagramTour;
};
type AuthoredTourDraft = {
  diagram: string;
  diagramNode: StepValueNode;
  steps: StepDraft[];
  title: string;
  version: number;
};
type LoadedCollectionEntry = {
  entry: ResolvedDiagramTourCollectionEntry;
  sourceId: string;
};
type MarkdownBlock = {
  id: string;
  source: string;
  title: string;
};
type MarkdownFence = {
  character: "`" | "~";
  info: string;
  length: number;
};
type MarkdownFenceState = MarkdownFence & {
  block: MarkdownBlockIdentity;
  lines: string[];
  mermaid: boolean;
};
type MarkdownBlockIdentity = {
  baseId: string;
  baseTitle: string;
};
type MarkdownHeading = MarkdownBlockIdentity;
type MarkdownFallback = {
  id: string;
  title: string;
};
type MarkdownBlockAccumulator = {
  blocks: MarkdownBlock[];
  counts: Map<string, number>;
};
type SourcePaths = {
  diagramPaths: string[];
  tourPaths: string[];
};
type DiagramModel = {
  elements: DiagramElement[];
  renderSource: string;
  type: DiagramType;
};
type SequenceDiagramModel = {
  messages: DiagramElement[];
  participants: DiagramElement[];
  renderSource: string;
};
type SemanticValidationContext = {
  lineCounter: LineCounter;
  parsedDocument: ParsedYamlDocument;
};
type StepValueNode = Scalar.Parsed<string>;
type StepDraft = {
  focus: string[];
  focusNodes: StepValueNode[];
  text: string;
  textNode: StepValueNode;
};
type TourField = "diagram" | "steps" | "text" | "title" | "version";
type TourValidationCollector = {
  diagnostics: TourDiagnostic[];
  seen: Set<string>;
};
type ParsedYamlDocument = ReturnType<typeof parseDocument>;
type YamlMapNode = YAMLMap.Parsed<ParsedNode, ParsedNode | null>;
type YamlSeqNode = YAMLSeq.Parsed<ParsedNode>;
export interface TourValidationIssue {
  diagnostic: TourDiagnostic;
  sourceId: string;
  sourcePath: string;
}

export interface TourValidationReport {
  issues: TourValidationIssue[];
  total: number;
  valid: number;
}

type ValidationTargetState = Exclude<Awaited<ReturnType<typeof resolveValidationTarget>>, null>;
type ValidationTargetReport = {
  countedSourceIds: string[];
  invalidSourceIds: string[];
  issues: TourValidationIssue[];
};

export async function loadResolvedTour(tourPath: string): Promise<ResolvedDiagramTour> {
  const absoluteTourPath = resolve(tourPath);
  const context = createTourContext(absoluteTourPath);

  return runWithContext(context, async () => {
    return (await loadAuthoredTourDocument({
      absoluteTourPath,
      context
    })).tour;
  });
}

export async function loadResolvedTourCollection(
  sourceTarget: string
): Promise<ResolvedDiagramTourCollection> {
  const absoluteTarget = resolve(sourceTarget);
  const targetStats = await stat(absoluteTarget);

  if (targetStats.isFile()) {
    return createSingleEntryCollection(absoluteTarget);
  }

  const collection = await createDiscoveredTourCollection(absoluteTarget);

  assertDiscoveredEntries(collection.entries.length, absoluteTarget);

  return collection;
}

export async function validateResolvedTourTargets(
  sourceTargets: string[]
): Promise<TourValidationReport> {
  const issues: TourValidationIssue[] = [];
  const countedSourceIds = new Set<string>();
  const invalidSourceIds = new Set<string>();
  const seenIssueIds = new Set<string>();

  for (const target of readValidationTargets(sourceTargets)) {
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

async function validateResolvedTourTarget(target: string): Promise<ValidationTargetReport> {
  const absoluteTarget = resolve(target);
  const targetState = await resolveValidationTarget(absoluteTarget);

  if (targetState === null) {
    return createMissingValidationTargetReport(absoluteTarget, target);
  }

  if (targetState.kind === "unsupported") {
    return createUnsupportedValidationTargetReport(targetState.absolutePath, target);
  }

  return await readValidationTargetIssues(targetState, target);
}

async function readValidationTargetIssues(
  targetState: ValidationTargetState,
  target: string
): Promise<ValidationTargetReport> {
  try {
    const collection = await readValidationTargetCollection(targetState);

    const noValidToursReport = readNoValidToursReport(collection, targetState.absolutePath, target);

    if (noValidToursReport !== null) {
      return noValidToursReport;
    }

    return readValidationCollectionReport(collection, targetState);
  } catch (error) {
    return createUnexpectedValidationReport(targetState.absolutePath, target, error);
  }
}

function readNoValidToursReport(
  collection: ResolvedDiagramTourCollection,
  absoluteTarget: string,
  target: string
): ValidationTargetReport | null {
  if (collection.entries.length === 0 && collection.skipped.length === 0) {
    return createNoValidToursReport(absoluteTarget, target);
  }

  return null;
}

function readValidationCollectionReport(
  collection: ResolvedDiagramTourCollection,
  targetState: ValidationTargetState
): ValidationTargetReport {
  return {
    countedSourceIds: [
      ...collection.entries.map((entry) => readValidationEntrySourceId(targetState, entry.sourcePath)),
      ...collection.skipped.map((skipped) => skipped.sourceId)
    ],
    invalidSourceIds: collection.skipped.map((skipped) => skipped.sourceId),
    issues: collection.skipped.flatMap((skipped) =>
      skipped.diagnostics.map((diagnostic) => ({
        diagnostic,
        sourceId: skipped.sourceId,
        sourcePath: skipped.sourcePath
      }))
    )
  };
}

function readValidationEntrySourceId(
  targetState: ValidationTargetState,
  sourcePath: string
): string {
  return normalizePath(resolve(readValidationTargetSourceRoot(targetState), sourcePath));
}

function readValidationTargetSourceRoot(targetState: ValidationTargetState): string {
  return targetState.kind === "directory" ? targetState.absolutePath : dirname(targetState.absolutePath);
}

function createMissingValidationTargetReport(
  absoluteTarget: string,
  target: string
): ValidationTargetReport {
  return {
    countedSourceIds: [],
    invalidSourceIds: [],
    issues: [createMissingValidationTargetIssue(absoluteTarget, target)]
  };
}

function createUnsupportedValidationTargetReport(
  absoluteTarget: string,
  target: string
): ValidationTargetReport {
  return {
    countedSourceIds: [],
    invalidSourceIds: [],
    issues: [createUnsupportedValidationTargetIssue(absoluteTarget, target)]
  };
}

async function readValidationTargetCollection(
  targetState: Exclude<Awaited<ReturnType<typeof resolveValidationTarget>>, null>
): Promise<ResolvedDiagramTourCollection> {
  if (targetState.kind === "directory") {
    return await createDiscoveredTourCollection(targetState.absolutePath);
  }

  return await createValidationSingleEntryCollection(targetState.absolutePath);
}

async function createValidationSingleEntryCollection(
  absolutePath: string
): Promise<ResolvedDiagramTourCollection> {
  try {
    return await createSingleEntryCollection(absolutePath);
  } catch (error) {
    return {
      entries: [],
      skipped: [createSkippedTourEntry(absolutePath, dirname(absolutePath), error)]
    };
  }
}

function createNoValidToursReport(absoluteTarget: string, target: string): ValidationTargetReport {
  return {
    countedSourceIds: [],
    invalidSourceIds: [],
    issues: [createNoValidToursIssue(absoluteTarget, target)]
  };
}

function createUnexpectedValidationReport(
  absoluteTarget: string,
  target: string,
  error: unknown
): ValidationTargetReport {
  return {
    countedSourceIds: [],
    invalidSourceIds: [],
    issues: [createUnexpectedValidationIssue(absoluteTarget, target, error)]
  };
}

function readValidationTargets(sourceTargets: string[]): string[] {
  return sourceTargets.length > 0 ? sourceTargets : ["."];
}

function appendValidationReport(input: {
  countedSourceIds: Set<string>;
  invalidSourceIds: Set<string>;
  issues: TourValidationIssue[];
  seenIssueIds: Set<string>;
  targetReport: ValidationTargetReport;
}): void {
  for (const countedSourceId of input.targetReport.countedSourceIds) {
    input.countedSourceIds.add(countedSourceId);
  }

  for (const invalidSourceId of input.targetReport.invalidSourceIds) {
    input.invalidSourceIds.add(invalidSourceId);
  }

  appendValidationIssues(input.issues, input.seenIssueIds, input.targetReport.issues);
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

function appendValidationIssue(
  issues: TourValidationIssue[],
  seenIssueIds: Set<string>,
  issue: TourValidationIssue
): void {
  const issueId = createValidationIssueId(issue);

  if (hasSeenValidationIssue(seenIssueIds, issueId)) {
    return;
  }

  markValidationIssueSeen(seenIssueIds, issueId);
  issues.push(issue);
}

function createValidationIssueId(issue: TourValidationIssue): string {
  return `${issue.sourceId}:${issue.diagnostic.message}:${readDiagnosticLocationKey(issue.diagnostic)}`;
}

function hasSeenValidationIssue(seenIssueIds: Set<string>, issueId: string): boolean {
  return seenIssueIds.has(issueId);
}

function markValidationIssueSeen(seenIssueIds: Set<string>, issueId: string): void {
  seenIssueIds.add(issueId);
}

async function createSingleEntryCollection(
  absolutePath: string
): Promise<ResolvedDiagramTourCollection> {
  const entries = await createCollectionEntries({
    absolutePath,
    sourceRoot: dirname(absolutePath)
  });

  return {
    entries: entries.map((item) => item.entry),
    skipped: []
  };
}

async function createDiscoveredTourCollection(
  sourceRoot: string
): Promise<ResolvedDiagramTourCollection> {
  const discoveredPaths = await collectSourcePaths(sourceRoot);
  const result = createDiscoveredCollectionResult();
  const authoredDiagramPaths = await appendAuthoredDiscoveryResults({
    result,
    sourceRoot,
    tourPaths: discoveredPaths.tourPaths
  });

  await appendGeneratedDiscoveryResults({
    authoredDiagramPaths,
    diagramPaths: discoveredPaths.diagramPaths,
    result,
    sourceRoot
  });
  result.entries.sort((left, right) => left.slug.localeCompare(right.slug));

  return result;
}

async function createCollectionEntries(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[]> {
  return input.absolutePath.endsWith(TOUR_FILE_SUFFIX)
    ? [await createAuthoredCollectionEntry(input)]
    : await loadGeneratedCollectionEntries(input);
}

async function collectSourcePaths(sourceRoot: string): Promise<SourcePaths> {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const nestedPaths = await Promise.all(entries.map((entry) => collectNestedSourcePaths(sourceRoot, entry)));

  return sortSourcePaths(mergeSourcePaths(nestedPaths));
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

function createDiscoveredCollectionResult(): {
  entries: ResolvedDiagramTourCollectionEntry[];
  skipped: SkippedResolvedDiagramTour[];
} {
  return {
    entries: [],
    skipped: []
  };
}

async function appendDiscoveredTourResult(input: {
  absolutePath: string;
  result: {
    entries: ResolvedDiagramTourCollectionEntry[];
    skipped: SkippedResolvedDiagramTour[];
  };
  sourceRoot: string;
}): Promise<string[] | null> {
  try {
    const loadedEntries = await createCollectionEntries({
      absolutePath: input.absolutePath,
      sourceRoot: input.sourceRoot
    });

    input.result.entries.push(...loadedEntries.map((item) => item.entry));

    return loadedEntries.map((item) => item.sourceId);
  } catch (error) {
    input.result.skipped.push(createSkippedTourEntry(input.absolutePath, input.sourceRoot, error));

    return null;
  }
}

function createSkippedTourEntry(
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

async function readTextFile(path: string): Promise<string> {
  const source = await readFile(path, "utf8");

  return normalizeNewlines(source);
}

async function readRawTourDocument(input: {
  absoluteTourPath: string;
  context: TourContext;
}): Promise<{
  draft: AuthoredTourDraft;
  source: string;
}> {
  const tourSource = await readTextFile(input.absoluteTourPath);

  return {
    draft: parseTourDocument({
      source: tourSource,
      context: input.context
    }),
    source: tourSource
  };
}

function parseTourDocument(input: { source: string; context: TourContext }): AuthoredTourDraft {
  const parsedDocument = parseDocument<ParsedNode>(input.source);

  if (parsedDocument.errors.length > 0) {
    throw parsedDocument.errors[0];
  }

  return validateParsedTourDocument({
    context: input.context,
    lineCounter: createSourceLineCounter(input.source),
    parsedDocument
  });
}

interface TourContext {
  sourcePath: string;
}

function createTourContext(sourcePath: string): TourContext {
  return {
    sourcePath: normalizePath(sourcePath)
  };
}

async function readDiagramSource(input: {
  absoluteTourPath: string;
  diagramPath: string;
  context: TourContext;
}): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  const reference = parseDiagramReference(input.diagramPath);
  const absoluteDiagramPath = resolve(dirname(input.absoluteTourPath), reference.path);

  if (!absoluteDiagramPath.endsWith(MARKDOWN_DIAGRAM_FILE_SUFFIX)) {
    assertDiagramFragmentAllowed(reference, input.context);

    return {
      ownedDiagramSourceId: createDiagramSourceId(absoluteDiagramPath),
      source: await readTextFile(absoluteDiagramPath)
    };
  }

  return readMarkdownDiagramSource({
    absoluteDiagramPath,
    context: input.context,
    diagramPath: input.diagramPath,
    reference
  });
}

function resolveLoadedTour(input: {
  context: TourContext;
  diagramPath: string;
  diagramSource: string;
  rawTour: DiagramTour;
}): ResolvedDiagramTour {
  const diagramModel = createDiagramModel(input.diagramSource, input.context);
  const elementIndex = createElementIndex(diagramModel.elements);

  return {
    sourceKind: "authored",
    version: input.rawTour.version,
    title: input.rawTour.title,
    diagram: createResolvedDiagram(input.diagramPath, diagramModel),
    steps: resolveLoadedTourSteps(input.rawTour.steps, {
      context: input.context,
      diagramType: diagramModel.type,
      elementIndex
    })
  };
}

async function loadGeneratedDiagramTour(absoluteDiagramPath: string): Promise<ResolvedDiagramTour> {
  const diagramSource = await readTextFile(absoluteDiagramPath);

  return createGeneratedDiagramTour({
    diagramPath: normalizePath(basename(absoluteDiagramPath)),
    diagramSource,
    title: createGeneratedTitle(absoluteDiagramPath)
  });
}

async function appendAuthoredDiscoveryResults(input: {
  result: {
    entries: ResolvedDiagramTourCollectionEntry[];
    skipped: SkippedResolvedDiagramTour[];
  };
  sourceRoot: string;
  tourPaths: string[];
}): Promise<Set<string>> {
  const authoredDiagramPaths = new Set<string>();

  for (const absoluteTourPath of input.tourPaths) {
    const ownedDiagramSourceIds = await appendDiscoveredTourResult({
      absolutePath: absoluteTourPath,
      result: input.result,
      sourceRoot: input.sourceRoot
    });

    addOwnedDiagramPath(authoredDiagramPaths, ownedDiagramSourceIds);
  }

  return authoredDiagramPaths;
}

async function appendGeneratedDiscoveryResults(input: {
  authoredDiagramPaths: Set<string>;
  diagramPaths: string[];
  result: {
    entries: ResolvedDiagramTourCollectionEntry[];
    skipped: SkippedResolvedDiagramTour[];
  };
  sourceRoot: string;
}): Promise<void> {
  for (const absoluteDiagramPath of input.diagramPaths) {
    const loadedEntries = await tryLoadGeneratedDiscoveryEntries({
      absoluteDiagramPath,
      sourceRoot: input.sourceRoot
    });

    if (loadedEntries === null) {
      continue;
    }

    input.result.entries.push(
      ...loadedEntries
        .filter((item) => !input.authoredDiagramPaths.has(item.sourceId))
        .map((item) => item.entry)
    );
  }
}

async function tryLoadGeneratedDiscoveryEntries(input: {
  absoluteDiagramPath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[] | null> {
  try {
    return await loadGeneratedCollectionEntries({
      absolutePath: input.absoluteDiagramPath,
      sourceRoot: input.sourceRoot
    });
  } catch (error) {
    if (shouldIgnoreGeneratedDiscoveryError(input.absoluteDiagramPath, error)) {
      return null;
    }

    throw error;
  }
}

function assertDiscoveredEntries(count: number, sourceRoot: string): void {
  invariant(count > 0, `${NO_VALID_TOURS_MESSAGE} in source target "${normalizePath(sourceRoot)}".`);
}

async function collectNestedSourcePaths(sourceRoot: string, entry: Dirent): Promise<SourcePaths> {
  return entry.isDirectory()
    ? collectSourcePaths(resolve(sourceRoot, entry.name))
    : collectSourceFilePath(sourceRoot, entry.name);
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

function addOwnedDiagramPath(
  authoredDiagramPaths: Set<string>,
  ownedDiagramSourceIds: string[] | null
): void {
  if (ownedDiagramSourceIds === null) {
    return;
  }

  for (const ownedDiagramSourceId of ownedDiagramSourceIds) {
    authoredDiagramPaths.add(ownedDiagramSourceId);
  }
}

function createGeneratedSteps(
  elements: DiagramElement[],
  title: string
): ResolvedDiagramTour["steps"] {
  return [
    {
      focus: [],
      index: 1,
      text: `Overview of ${title}.`
    },
    ...elements.map((element, index) => ({
      focus: [element],
      index: index + 2,
      text: `Focus on ${element.label}.`
    }))
  ];
}

function createResolvedDiagram(
  diagramPath: string,
  model: DiagramModel
): ResolvedDiagramTour["diagram"] {
  return {
    elements: model.elements,
    path: normalizePath(diagramPath),
    source: model.renderSource,
    type: model.type
  };
}

function resolveLoadedTourSteps(
  steps: TourStep[],
  input: {
    context: TourContext;
    diagramType: DiagramType;
    elementIndex: ElementIndex;
  }
): ResolvedDiagramTour["steps"] {
  return steps.map((step, index) =>
    resolveTourStep({
      context: input.context,
      diagramType: input.diagramType,
      elementIndex: input.elementIndex,
      step,
      stepIndex: index + 1
    })
  );
}

function validateParsedTourDocument(input: {
  context: TourContext;
  lineCounter: LineCounter;
  parsedDocument: ParsedYamlDocument;
}): AuthoredTourDraft {
  const collector = createTourValidationCollector();
  const draft = readAuthoredTourDraft(input, collector);

  if (collector.diagnostics.length > 0) {
    throw createTourValidationError(input.context, collector.diagnostics);
  }

  invariant(draft !== null, createTourMessage(input.context, "failed unexpectedly"));

  return draft;
}

function createTourValidationCollector(): TourValidationCollector {
  return {
    diagnostics: [],
    seen: new Set<string>()
  };
}

function readAuthoredTourDraft(
  input: SemanticValidationContext & {
    context: TourContext;
  },
  collector: TourValidationCollector
): AuthoredTourDraft | null {
  const documentMap = readTourRootMap(input, collector);

  if (documentMap === null) {
    return null;
  }

  const fields = readAuthoredTourFieldNodes(documentMap);
  return createAuthoredTourDraftFromFields(input, collector, fields);
}

function createAuthoredTourDraftFromFields(
  input: SemanticValidationContext & { context: TourContext },
  collector: TourValidationCollector,
  fields: {
    diagramNode: ParsedNode | null;
    stepsNode: ParsedNode | null;
    titleNode: ParsedNode | null;
    versionNode: ParsedNode | null;
  }
): AuthoredTourDraft | null {
  const version = readVersionField(input, collector, fields.versionNode);
  const title = readTitleField(input, collector, fields.titleNode);
  const diagram = readDiagramField(input, collector, fields.diagramNode);
  const steps = readStepsFieldValue(input, collector, fields.stepsNode);

  if (hasMissingDraftFields({ diagram, steps, title, version })) {
    return null;
  }

  return {
    diagram,
    diagramNode: fields.diagramNode as StepValueNode,
    steps,
    title,
    version
  };
}

function hasMissingDraftFields(
  fields: {
    diagram: string | null;
    steps: StepDraft[] | null;
    title: string | null;
    version: number | null;
  }
): boolean {
  return Object.values(fields).some((value) => value === null);
}

function readAuthoredTourFieldNodes(documentMap: YamlMapNode): {
  diagramNode: ParsedNode | null;
  stepsNode: ParsedNode | null;
  titleNode: ParsedNode | null;
  versionNode: ParsedNode | null;
} {
  return {
    diagramNode: readMapField(documentMap, "diagram"),
    stepsNode: readMapField(documentMap, "steps"),
    titleNode: readMapField(documentMap, "title"),
    versionNode: readMapField(documentMap, "version")
  };
}

function readTitleField(
  input: SemanticValidationContext & { context: TourContext },
  collector: TourValidationCollector,
  node: ParsedNode | null
): string | null {
  return readRequiredStringField({
    collector,
    context: input.context,
    lineCounter: input.lineCounter,
    message: createTourMessage(input.context, "title is required"),
    node,
    parsedDocument: input.parsedDocument
  });
}

function readDiagramField(
  input: SemanticValidationContext & { context: TourContext },
  collector: TourValidationCollector,
  node: ParsedNode | null
): string | null {
  return readRequiredStringField({
    collector,
    context: input.context,
    lineCounter: input.lineCounter,
    message: createTourMessage(input.context, "diagram path is required"),
    node,
    parsedDocument: input.parsedDocument
  });
}

function readStepsFieldValue(
  input: SemanticValidationContext & { context: TourContext },
  collector: TourValidationCollector,
  node: ParsedNode | null
): StepDraft[] | null {
  return readStepsField({
    collector,
    context: input.context,
    lineCounter: input.lineCounter,
    node,
    parsedDocument: input.parsedDocument
  });
}

function readTourRootMap(
  input: SemanticValidationContext & {
    context: TourContext;
  },
  collector: TourValidationCollector
): YamlMapNode | null {
  const contents = input.parsedDocument.contents;

  if (isYamlMapNode(contents)) {
    return contents;
  }

  appendDiagnostic(collector, {
    location: readDocumentRootLocation(input, contents),
    message: createTourMessage(input.context, "document must be an object")
  });

  return null;
}

function readMapField(map: YamlMapNode, key: TourField): ParsedNode | null {
  for (const item of map.items) {
    if (isMatchingMapKey(item.key, key)) {
      return item.value;
    }
  }

  return null;
}

function isYamlMapNode(value: ParsedNode | null): value is YamlMapNode {
  return value !== null && isMap(value);
}

function readDocumentRootLocation(
  input: SemanticValidationContext & { context: TourContext },
  contents: ParsedNode | null
): DiagnosticLocation | null {
  return readNodeLocation(contents, input.lineCounter) ?? readDocumentLocation(input.parsedDocument, input.lineCounter);
}

function isMatchingMapKey(keyNode: unknown, key: TourField): boolean {
  return isScalar(keyNode) && keyNode.value === key;
}

function readVersionField(
  input: SemanticValidationContext & {
    context: TourContext;
  },
  collector: TourValidationCollector,
  node: ParsedNode | null
): number | null {
  const value = readSupportedVersionValue(node);

  if (value === SUPPORTED_TOUR_VERSION) {
    return value;
  }

  appendDiagnostic(collector, {
    location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
    message: createTourMessage(input.context, `unsupported tour version "${String(readNodeValue(node))}"`)
  });

  return null;
}

function readRequiredStringField(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: LineCounter;
  message: string;
  node: ParsedNode | null;
  parsedDocument: ParsedYamlDocument;
}): string | null {
  if (isNonEmptyScalarString(input.node)) {
    return input.node.value;
  }

  appendDiagnostic(input.collector, {
    location: readFieldLocation(input.node, input.parsedDocument, input.lineCounter),
    message: input.message
  });

  return null;
}

function readStepsField(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: LineCounter;
  node: ParsedNode | null;
  parsedDocument: ParsedYamlDocument;
}): StepDraft[] | null {
  const stepsNode = readNonEmptyStepsNode(input);

  if (stepsNode === null) {
    return null;
  }

  return stepsNode.items.map((stepNode, index) =>
    readStepDraft({
      collector: input.collector,
      context: input.context,
      lineCounter: input.lineCounter,
      node: stepNode,
      parsedDocument: input.parsedDocument,
      stepIndex: index + 1
    })
  ).filter((step): step is StepDraft => step !== null);
}

function readNonEmptyStepsNode(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: LineCounter;
  node: ParsedNode | null;
  parsedDocument: ParsedYamlDocument;
}): YamlSeqNode | null {
  if (isNonEmptyStepsSequence(input.node)) {
    return input.node;
  }

  appendStepsArrayDiagnostic(input);

  return null;
}

function isNonEmptyStepsSequence(node: ParsedNode | null): node is YamlSeqNode {
  return isSeq(node) && node.items.length > 0;
}

function appendStepsArrayDiagnostic(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: LineCounter;
  node: ParsedNode | null;
  parsedDocument: ParsedYamlDocument;
}): void {
  appendDiagnostic(input.collector, {
    location: readFieldLocation(input.node, input.parsedDocument, input.lineCounter),
    message: createTourMessage(input.context, "steps must be a non-empty array")
  });
}

function readStepDraft(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: LineCounter;
  node: unknown;
  parsedDocument: ParsedYamlDocument;
  stepIndex: number;
}): StepDraft | null {
  const stepNode = readStepMapNode(input);

  if (stepNode === null) {
    return null;
  }

  return readStepDraftContent(input, stepNode);
}

function readStepDraftContent(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  stepNode: YamlMapNode
): StepDraft | null {
  const focus = readFocusField(input, readMapField(stepNode, "focus"));
  const text = readTextField(input, readMapField(stepNode, "text"));

  if (focus === null || text === null) {
    return null;
  }

  return {
    focus: focus.values,
    focusNodes: focus.nodes,
    text: text.value,
    textNode: text.node
  };
}

function readStepMapNode(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: LineCounter;
  node: unknown;
  parsedDocument: ParsedYamlDocument;
  stepIndex: number;
}): YamlMapNode | null {
  if (isMap(input.node)) {
    return input.node;
  }

  appendDiagnostic(input.collector, {
    location: readFieldLocation(input.node, input.parsedDocument, input.lineCounter),
    message: createStepMessage(input, "must be an object")
  });

  return null;
}

function readFocusField(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  node: unknown
): { nodes: StepValueNode[]; values: string[] } | null {
  const focusNode = readFocusSequenceNode(input, node);

  if (focusNode === null) {
    return null;
  }

  return collectFocusValues(input, focusNode);
}

function collectFocusValues(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  focusNode: YamlSeqNode
): { nodes: StepValueNode[]; values: string[] } {
  const values = createFocusAccumulator();

  for (const item of focusNode.items) {
    appendFocusValue(input, values, item);
  }

  return values;
}

function appendFocusValue(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  accumulator: { nodes: StepValueNode[]; values: string[] },
  item: unknown
): void {
  if (!isNonEmptyScalarString(item)) {
    appendInvalidFocusValueDiagnostic(input, item);

    return;
  }

  accumulator.values.push(item.value);
  accumulator.nodes.push(item);
}

function createFocusAccumulator(): { nodes: StepValueNode[]; values: string[] } {
  return {
    nodes: [],
    values: []
  };
}

function readFocusSequenceNode(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  node: unknown
): YamlSeqNode | null {
  if (isSeq(node)) {
    return node;
  }

  appendDiagnostic(input.collector, {
    location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
    message: createStepFieldMessage(input, "focus", "must be an array")
  });

  return null;
}

function appendInvalidFocusValueDiagnostic(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  item: unknown
): void {
  appendDiagnostic(input.collector, {
    location: readFieldLocation(item, input.parsedDocument, input.lineCounter),
    message: createStepFieldMessage(input, "focus", "must contain only non-empty diagram element ids")
  });
}

function readTextField(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: LineCounter;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  node: unknown
): { node: StepValueNode; value: string } | null {
  if (!isNonEmptyScalarString(node)) {
    appendDiagnostic(input.collector, {
      location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
      message: createStepFieldMessage(input, "text", "is required")
    });

    return null;
  }

  return {
    node,
    value: node.value
  };
}

function validateResolvedTourDraft(input: {
  context: TourContext;
  diagramModel: DiagramModel;
  draft: AuthoredTourDraft;
  source: string;
}): TourDiagnostic[] {
  const collector = createTourValidationCollector();
  const elementIndex = createElementIndex(input.diagramModel.elements);
  const lineCounter = createSourceLineCounter(input.source);

  input.draft.steps.forEach((step, index) =>
    validateResolvedDraftStep({
      collector,
      context: input.context,
      diagramType: input.diagramModel.type,
      elementIndex,
      lineCounter,
      step,
      stepIndex: index + 1
    })
  );

  return collector.diagnostics;
}

function validateResolvedDraftStep(input: {
  collector: TourValidationCollector;
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  lineCounter: LineCounter;
  step: StepDraft;
  stepIndex: number;
}): void {
  validateFocusReferences({
    collector: input.collector,
    context: input.context,
    diagramType: input.diagramType,
    elementIndex: input.elementIndex,
    focus: input.step.focus,
    focusNodes: input.step.focusNodes,
    lineCounter: input.lineCounter,
    stepIndex: input.stepIndex
  });
  validateTextReferences({
    collector: input.collector,
    context: input.context,
    diagramType: input.diagramType,
    elementIndex: input.elementIndex,
    lineCounter: input.lineCounter,
    stepIndex: input.stepIndex,
    text: input.step.text,
    textNode: input.step.textNode
  });
}

function validateFocusReferences(input: {
  collector: TourValidationCollector;
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  focus: string[];
  focusNodes: StepValueNode[];
  lineCounter: LineCounter;
  stepIndex: number;
}): void {
  input.focus.forEach((elementId, index) => {
    if (input.elementIndex.has(elementId)) {
      return;
    }

    appendDiagnostic(input.collector, {
      location: readNodeLocation(input.focusNodes[index] ?? null, input.lineCounter),
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "focus",
        stepIndex: input.stepIndex
      })
    });
  });
}

function validateTextReferences(input: {
  collector: TourValidationCollector;
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  lineCounter: LineCounter;
  stepIndex: number;
  text: string;
  textNode: StepValueNode;
}): void {
  for (const match of input.text.matchAll(NODE_REFERENCE_PATTERN)) {
    const elementId = match[1];

    if (input.elementIndex.has(elementId)) {
      continue;
    }

    appendDiagnostic(input.collector, {
      location: readNodeLocation(input.textNode, input.lineCounter),
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "text",
        stepIndex: input.stepIndex
      })
    });
  }
}

function toDiagramTour(draft: AuthoredTourDraft): DiagramTour {
  return {
    version: draft.version,
    title: draft.title,
    diagram: draft.diagram,
    steps: draft.steps.map((step) => ({
      focus: step.focus,
      text: step.text
    }))
  };
}

function createDiagramModel(source: string, context: TourContext): DiagramModel {
  const type = detectDiagramType(source);

  return type === "sequence"
    ? createSequenceDiagramModel(source, context)
    : createFlowchartDiagramModel(source);
}

function detectDiagramType(source: string): DiagramType {
  return SEQUENCE_DIAGRAM_PATTERN.test(source) ? "sequence" : "flowchart";
}

function createFlowchartDiagramModel(source: string): DiagramModel {
  return {
    elements: extractFlowchartElements(source),
    renderSource: source,
    type: "flowchart"
  };
}

function createSequenceDiagramModel(source: string, context: TourContext): DiagramModel {
  const sequenceModel = extractSequenceDiagramModel(source, context);

  return {
    elements: [...sequenceModel.participants, ...sequenceModel.messages],
    renderSource: sequenceModel.renderSource,
    type: "sequence"
  };
}

function extractFlowchartElements(source: string): DiagramElement[] {
  const elements = new Map<string, DiagramElement>();

  for (const match of source.matchAll(FLOWCHART_NODE_PATTERN)) {
    elements.set(match[1], {
      id: match[1],
      kind: "node",
      label: match[2].trim()
    });
  }

  return Array.from(elements.values());
}

function extractSequenceDiagramModel(source: string, context: TourContext): SequenceDiagramModel {
  const elements = new Map<string, DiagramElement>();
  const participants: DiagramElement[] = [];
  const messages: DiagramElement[] = [];
  const renderLines = source.split("\n").map((line) =>
    readSequenceRenderLine({
      context,
      elements,
      line,
      messages,
      participants
    })
  );

  return {
    messages,
    participants,
    renderSource: renderLines.join("\n")
  };
}

function readSequenceRenderLine(input: {
  context: TourContext;
  elements: Map<string, DiagramElement>;
  line: string;
  messages: DiagramElement[];
  participants: DiagramElement[];
}): string {
  const participant = readSequenceParticipant(input.line);

  if (participant !== null) {
    return registerSequenceParticipantLine(input, participant);
  }

  const message = readSequenceMessage(input.line);

  if (message === null) {
    return input.line;
  }

  return registerSequenceMessageLine(input, message);
}

function registerSequenceParticipantLine(
  input: {
    context: TourContext;
    elements: Map<string, DiagramElement>;
    line: string;
    participants: DiagramElement[];
  },
  participant: DiagramElement
): string {
  registerSequenceElement({
    context: input.context,
    element: participant,
    elements: input.elements
  });
  input.participants.push(participant);

  return input.line;
}

function registerSequenceMessageLine(
  input: {
    context: TourContext;
    elements: Map<string, DiagramElement>;
    line: string;
    messages: DiagramElement[];
  },
  message: { element: DiagramElement; label: string }
): string {
  registerSequenceElement({
    context: input.context,
    element: message.element,
    elements: input.elements
  });
  input.messages.push(message.element);

  return replaceSequenceMessageLabel(input.line, message.label);
}

function readSequenceParticipant(line: string): DiagramElement | null {
  const match = line.match(SEQUENCE_PARTICIPANT_PATTERN);

  if (match === null) {
    return null;
  }

  return {
    id: match[2],
    kind: "participant",
    label: readSequenceParticipantLabel(match)
  };
}

function readSequenceParticipantLabel(match: RegExpMatchArray): string {
  const alias = match.at(3);

  return alias === undefined ? match[2]! : alias.trim();
}

function readSequenceMessage(line: string): { element: DiagramElement; label: string } | null {
  const match = line.match(SEQUENCE_MESSAGE_PATTERN);

  if (match === null) {
    return null;
  }

  const label = match[2].trim();

  return {
    element: {
      id: match[1],
      kind: "message",
      label
    },
    label
  };
}

function replaceSequenceMessageLabel(line: string, label: string): string {
  return line.replace(SEQUENCE_MESSAGE_PATTERN, `: ${label}`);
}

function registerSequenceElement(input: {
  context: TourContext;
  element: DiagramElement;
  elements: Map<string, DiagramElement>;
}): void {
  const existing = input.elements.get(input.element.id);

  invariant(
    existing === undefined,
    createTourMessage(
      input.context,
      `diagram contains duplicate Mermaid sequence id "${input.element.id}"`
    )
  );
  input.elements.set(input.element.id, input.element);
}

function createElementIndex(elements: DiagramElement[]): ElementIndex {
  return new Map(elements.map((element) => [element.id, element]));
}

function resolveTourStep(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  step: TourStep;
  stepIndex: number;
}) {
  return {
    index: input.stepIndex,
    focus: resolveFocusElements(input),
    text: resolveTextReferences(input)
  };
}

function resolveFocusElements(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  step: TourStep;
  stepIndex: number;
}): DiagramElement[] {
  return input.step.focus.map((elementId) =>
    resolveElement({
      diagramType: input.diagramType,
      elementId,
      elementIndex: input.elementIndex,
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "focus",
        stepIndex: input.stepIndex
      })
    })
  );
}

function resolveTextReferences(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  step: TourStep;
  stepIndex: number;
}): string {
  return input.step.text.replaceAll(NODE_REFERENCE_PATTERN, (_match, elementId: string) =>
    resolveElement({
      diagramType: input.diagramType,
      elementId,
      elementIndex: input.elementIndex,
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "text",
        stepIndex: input.stepIndex
      })
    }).label
  );
}

function resolveElement(input: {
  diagramType: DiagramType;
  elementId: string;
  elementIndex: ElementIndex;
  message: string;
}): DiagramElement {
  const element = input.elementIndex.get(input.elementId);

  invariant(element !== undefined, input.message);

  return element;
}

function createUnknownElementMessage(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementId: string;
  kind: ReferenceKind;
  stepIndex: number;
}): string {
  return createStepFieldMessage(
    input,
    input.kind,
    `references unknown Mermaid ${readUnknownElementTarget(input.diagramType)} "${input.elementId}"`
  );
}

function readUnknownElementTarget(diagramType: DiagramType): string {
  return diagramType === "sequence" ? "participant or message id" : "node id";
}

function createSlug(sourcePath: string): string {
  const normalizedPath = normalizePath(sourcePath);
  const fileStem = readFileStem(normalizedPath);
  const directoryPath = normalizePath(dirname(normalizedPath));

  if (directoryPath === "." || basename(directoryPath) !== fileStem) {
    return removeKnownSuffix(normalizedPath);
  }

  return directoryPath;
}

async function createAuthoredCollectionEntry(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry> {
  const sourcePath = normalizePath(relative(input.sourceRoot, input.absolutePath));
  const loadedTour = await loadAuthoredTourDocument({
    absoluteTourPath: input.absolutePath,
    context: createTourContext(input.absolutePath)
  });

  return {
    entry: {
      slug: createSlug(sourcePath),
      sourcePath,
      title: loadedTour.tour.title,
      tour: loadedTour.tour
    },
    sourceId: loadedTour.ownedDiagramSourceId
  };
}

async function loadGeneratedCollectionEntries(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[]> {
  return input.absolutePath.endsWith(MARKDOWN_DIAGRAM_FILE_SUFFIX)
    ? createGeneratedMarkdownCollectionEntries(input)
    : [await createGeneratedRawCollectionEntry(input)];
}

async function createGeneratedRawCollectionEntry(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry> {
  const sourcePath = normalizePath(relative(input.sourceRoot, input.absolutePath));
  const tour = await loadGeneratedDiagramTour(input.absolutePath);

  return {
    entry: {
      slug: createSlug(sourcePath),
      sourcePath,
      title: tour.title,
      tour
    },
    sourceId: createDiagramSourceId(input.absolutePath)
  };
}

async function createGeneratedMarkdownCollectionEntries(input: {
  absolutePath: string;
  sourceRoot: string;
}): Promise<LoadedCollectionEntry[]> {
  const source = await readTextFile(input.absolutePath);
  const relativePath = normalizePath(relative(input.sourceRoot, input.absolutePath));
  const blockEntries = readMarkdownBlocks(source, input.absolutePath);

  invariant(
    blockEntries.length > 0,
    `Markdown diagram "${normalizePath(input.absolutePath)}" ${NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE}`
  );

  return blockEntries.map((block) =>
    createGeneratedMarkdownCollectionEntry({
      absolutePath: input.absolutePath,
      block,
      fileSlug: createSlug(relativePath),
      relativePath,
      useBlockSuffix: blockEntries.length > 1
    })
  );
}

function parseDiagramReference(diagramPath: string): DiagramReference {
  const hashIndex = diagramPath.lastIndexOf("#");

  if (hashIndex === -1) {
    return {
      fragment: null,
      path: diagramPath
    };
  }

  return {
    fragment: diagramPath.slice(hashIndex + 1),
    path: diagramPath.slice(0, hashIndex)
  };
}

function assertDiagramFragmentAllowed(reference: DiagramReference, context: TourContext): void {
  invariant(
    reference.fragment === null,
    createTourMessage(context, `diagram fragment "${reference.fragment}" is only supported for Markdown diagrams`)
  );
}

async function readMarkdownDiagramSource(input: {
  absoluteDiagramPath: string;
  context: TourContext;
  diagramPath: string;
  reference: DiagramReference;
}): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  const source = await readTextFile(input.absoluteDiagramPath);
  const blocks = readMarkdownBlocks(source, input.absoluteDiagramPath);

  invariant(
    blocks.length > 0,
    createTourMessage(
      input.context,
      `diagram markdown file "${normalizePath(input.reference.path)}" does not contain any Mermaid fenced blocks`
    )
  );

  return readSelectedMarkdownDiagramBlock({
    absoluteDiagramPath: input.absoluteDiagramPath,
    blocks,
    context: input.context,
    diagramPath: input.diagramPath,
    reference: input.reference
  });
}

function readSelectedMarkdownDiagramBlock(input: {
  absoluteDiagramPath: string;
  blocks: MarkdownBlock[];
  context: TourContext;
  diagramPath: string;
  reference: DiagramReference;
}): {
  ownedDiagramSourceId: string;
  source: string;
} {
  if (input.reference.fragment === null) {
    return readDefaultMarkdownDiagramBlock(input);
  }

  return readFragmentMarkdownDiagramBlock(input);
}

function readDefaultMarkdownDiagramBlock(input: {
  absoluteDiagramPath: string;
  blocks: MarkdownBlock[];
  context: TourContext;
  diagramPath: string;
}): {
  ownedDiagramSourceId: string;
  source: string;
} {
  invariant(
    input.blocks.length === 1,
    createTourMessage(
      input.context,
      `diagram markdown file "${normalizePath(input.diagramPath)}" contains multiple Mermaid blocks; use a #fragment to select one`
    )
  );

  return {
    ownedDiagramSourceId: createDiagramSourceId(input.absoluteDiagramPath, input.blocks[0]!.id),
    source: input.blocks[0]!.source
  };
}

function readFragmentMarkdownDiagramBlock(input: {
  absoluteDiagramPath: string;
  blocks: MarkdownBlock[];
  context: TourContext;
  diagramPath: string;
  reference: DiagramReference;
}): {
  ownedDiagramSourceId: string;
  source: string;
} {
  const block = input.blocks.find((candidate) => candidate.id === input.reference.fragment);

  invariant(
    block !== undefined,
    createTourMessage(
      input.context,
      `diagram markdown fragment "${input.reference.fragment}" was not found in "${normalizePath(input.reference.path)}"`
    )
  );

  return {
    ownedDiagramSourceId: createDiagramSourceId(input.absoluteDiagramPath, block.id),
    source: block.source
  };
}

function readMarkdownBlocks(source: string, absolutePath: string): MarkdownBlock[] {
  const fallback = createMarkdownFallback(absolutePath);
  const lines = source.split("\n");
  const accumulator = createMarkdownBlockAccumulator();
  let currentHeading: MarkdownHeading | null = null;
  let fenceState: MarkdownFenceState | null = null;

  for (const line of lines) {
    if (fenceState === null) {
      currentHeading = updateMarkdownHeading(currentHeading, line);
      fenceState = readMarkdownFenceState(line, currentHeading, fallback);
      continue;
    }

    fenceState = readNextMarkdownFenceState(line, fenceState, accumulator);
  }

  return accumulator.blocks;
}

function readMarkdownFenceState(
  line: string,
  currentHeading: MarkdownHeading | null,
  fallback: MarkdownFallback
): MarkdownFenceState | null {
  const fence = readMarkdownFence(line);

  if (fence === null) {
    return null;
  }

  return {
    ...fence,
    block: readMarkdownBlockIdentity(currentHeading, fallback.id, fallback.title),
    lines: [],
    mermaid: readMarkdownFenceInfoToken(fence.info) === "mermaid"
  };
}

function readMarkdownHeading(line: string): MarkdownHeading | null {
  const match = line.match(/^\s*#{1,6}\s+(.+?)\s*$/u);

  if (match === null) {
    return null;
  }

  const title = match[1].replace(/\s+#+\s*$/u, "").trim();

  return title.length === 0
    ? null
    : {
        baseId: createHeadingSlug(title),
        baseTitle: title
      };
}

function readMarkdownFence(line: string): MarkdownFence | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(`{3,}|~{3,})(.*)$/u);

  if (match === null) {
    return null;
  }

  return {
    character: match[1][0] as "`" | "~",
    info: match[2].trim(),
    length: match[1].length
  };
}

function isMarkdownFenceClose(line: string, fence: MarkdownFence): boolean {
  const trimmed = line.trim();

  return trimmed.length >= fence.length && hasOnlyMarkdownFenceCharacters(trimmed, fence.character);
}

function hasOnlyMarkdownFenceCharacters(input: string, character: "`" | "~"): boolean {
  return Array.from(input).every((value) => value === character);
}

function createMarkdownFallback(absolutePath: string): MarkdownFallback {
  const title = createGeneratedTitle(absolutePath);

  return {
    id: createHeadingSlug(title),
    title
  };
}

function createMarkdownBlockAccumulator(): MarkdownBlockAccumulator {
  return {
    blocks: [],
    counts: new Map<string, number>()
  };
}

function updateMarkdownHeading(
  currentHeading: MarkdownHeading | null,
  line: string
): MarkdownHeading | null {
  return readMarkdownHeading(line) ?? currentHeading;
}

function readNextMarkdownFenceState(
  line: string,
  fenceState: MarkdownFenceState,
  accumulator: MarkdownBlockAccumulator
): MarkdownFenceState | null {
  if (tryCloseMarkdownFence(line, fenceState, accumulator)) {
    return null;
  }

  appendMarkdownFenceLine(fenceState, line);

  return fenceState;
}

function tryCloseMarkdownFence(
  line: string,
  fenceState: MarkdownFenceState,
  accumulator: MarkdownBlockAccumulator
): boolean {
  if (!isMarkdownFenceClose(line, fenceState)) {
    return false;
  }

  if (fenceState.mermaid) {
    accumulator.blocks.push(createMarkdownBlock(fenceState, accumulator.counts));
  }

  return true;
}

function appendMarkdownFenceLine(fenceState: MarkdownFenceState, line: string): void {
  if (fenceState.mermaid) {
    fenceState.lines.push(line);
  }
}

function createMarkdownBlock(
  fenceState: MarkdownFenceState,
  counts: Map<string, number>
): MarkdownBlock {
  const count = (counts.get(fenceState.block.baseId) ?? 0) + 1;

  counts.set(fenceState.block.baseId, count);

  return {
    id: createMarkdownBlockId(fenceState.block.baseId, count),
    source: fenceState.lines.join("\n").trim(),
    title: createMarkdownBlockTitle(fenceState.block.baseTitle, count)
  };
}

function createMarkdownBlockId(baseId: string, count: number): string {
  return count === 1 ? baseId : `${baseId}-${count}`;
}

function createMarkdownBlockTitle(baseTitle: string, count: number): string {
  return count === 1 ? baseTitle : `${baseTitle} (${count})`;
}

function readMarkdownBlockIdentity(
  heading: MarkdownHeading | null,
  fallbackId: string,
  fallbackTitle: string
): MarkdownBlockIdentity {
  return heading ?? {
    baseId: fallbackId,
    baseTitle: fallbackTitle
  };
}

function readMarkdownFenceInfoToken(info: string): string {
  const [token] = info.split(/\s+/u);

  return token;
}

function createHeadingSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug.length > 0 ? slug : "diagram";
}

function createDiagramSourceId(absoluteDiagramPath: string, blockId: string | null = null): string {
  return blockId === null
    ? normalizePath(absoluteDiagramPath)
    : `${normalizePath(absoluteDiagramPath)}#${blockId}`;
}

function createGeneratedMarkdownSlug(fileSlug: string, blockId: string, useBlockSuffix: boolean): string {
  return useBlockSuffix ? `${fileSlug}/${blockId}` : fileSlug;
}

function createGeneratedMarkdownSourcePath(
  relativePath: string,
  blockId: string,
  useBlockSuffix: boolean
): string {
  return useBlockSuffix ? `${relativePath}#${blockId}` : relativePath;
}

function createGeneratedMarkdownDiagramPath(
  fileName: string,
  blockId: string,
  useBlockSuffix: boolean
): string {
  return useBlockSuffix ? `${normalizePath(fileName)}#${blockId}` : normalizePath(fileName);
}

function createGeneratedMarkdownCollectionEntry(input: {
  absolutePath: string;
  block: MarkdownBlock;
  fileSlug: string;
  relativePath: string;
  useBlockSuffix: boolean;
}): LoadedCollectionEntry {
  return {
    entry: {
      slug: createGeneratedMarkdownSlug(input.fileSlug, input.block.id, input.useBlockSuffix),
      sourcePath: createGeneratedMarkdownSourcePath(
        input.relativePath,
        input.block.id,
        input.useBlockSuffix
      ),
      title: input.block.title,
      tour: createGeneratedDiagramTour({
        diagramPath: createGeneratedMarkdownDiagramPath(
          basename(input.absolutePath),
          input.block.id,
          input.useBlockSuffix
        ),
        diagramSource: input.block.source,
        title: input.block.title
      })
    },
    sourceId: createDiagramSourceId(input.absolutePath, input.block.id)
  };
}

async function loadAuthoredTourDocument(input: {
  absoluteTourPath: string;
  context: TourContext;
}): Promise<LoadedAuthoredTour> {
  const rawTourDocument = await readRawTourDocument(input);
  const loadedDiagram = await loadAuthoredDiagramSource(input, rawTourDocument);
  const validationDiagnostics = readResolvedDraftDiagnostics({
    context: input.context,
    diagramSource: loadedDiagram.source,
    draft: rawTourDocument.draft,
    source: rawTourDocument.source
  });

  if (validationDiagnostics.length > 0) {
    throw createTourValidationError(input.context, validationDiagnostics);
  }

  return {
    ownedDiagramSourceId: loadedDiagram.ownedDiagramSourceId,
    tour: resolveLoadedTour({
      context: input.context,
      diagramPath: rawTourDocument.draft.diagram,
      diagramSource: loadedDiagram.source,
      rawTour: toDiagramTour(rawTourDocument.draft)
    })
  };
}

async function loadAuthoredDiagramSource(
  input: { absoluteTourPath: string; context: TourContext },
  rawTourDocument: { draft: AuthoredTourDraft; source: string }
): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  return await readDiagramSourceWithLocation({
    absoluteTourPath: input.absoluteTourPath,
    context: input.context,
    diagramNode: rawTourDocument.draft.diagramNode,
    diagramPath: rawTourDocument.draft.diagram,
    source: rawTourDocument.source
  });
}

function readResolvedDraftDiagnostics(input: {
  context: TourContext;
  diagramSource: string;
  draft: AuthoredTourDraft;
  source: string;
}): TourDiagnostic[] {
  return validateResolvedTourDraft({
    context: input.context,
    diagramModel: createDiagramModel(input.diagramSource, input.context),
    draft: input.draft,
    source: input.source
  });
}

async function readDiagramSourceWithLocation(input: {
  absoluteTourPath: string;
  context: TourContext;
  diagramNode: StepValueNode;
  diagramPath: string;
  source: string;
}): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  try {
    return await readDiagramSource({
      absoluteTourPath: input.absoluteTourPath,
      context: input.context,
      diagramPath: input.diagramPath
    });
  } catch (error) {
    const diagnostics = createTourDiagnostics(error).map((diagnostic) => ({
      ...diagnostic,
      location:
        diagnostic.location ??
        readNodeLocation(input.diagramNode, createSourceLineCounter(input.source))
    }));

    throw createTourValidationError(input.context, diagnostics);
  }
}

function createGeneratedDiagramTour(input: {
  diagramPath: string;
  diagramSource: string;
  title: string;
}): ResolvedDiagramTour {
  const diagramModel = createDiagramModel(
    input.diagramSource,
    createTourContext(normalizePath(input.diagramPath))
  );

  return {
    sourceKind: "generated",
    version: SUPPORTED_TOUR_VERSION,
    title: input.title,
    diagram: createResolvedDiagram(input.diagramPath, diagramModel),
    steps: createGeneratedSteps(diagramModel.elements, input.title)
  };
}

function readFileStem(sourcePath: string): string {
  return removeKnownSuffix(basename(sourcePath));
}

function removeKnownSuffix(sourcePath: string): string {
  if (sourcePath.endsWith(TOUR_FILE_SUFFIX)) {
    return sourcePath.replace(TOUR_FILE_SUFFIX, "");
  }

  return DIAGRAM_FILE_SUFFIXES.reduce((result, suffix) => {
    return result.endsWith(suffix) ? result.slice(0, -suffix.length) : result;
  }, sourcePath);
}

function createGeneratedTitle(absoluteDiagramPath: string): string {
  const words = readFileStem(basename(absoluteDiagramPath))
    .split(/[-_]+/u)
    .filter((word) => word.length > 0)
    .map(capitalizeWord)
    .join(" ");

  return words.length > 0 ? words : "Diagram";
}

function shouldIgnoreGeneratedDiscoveryError(absoluteDiagramPath: string, error: unknown): boolean {
  return (
    absoluteDiagramPath.endsWith(MARKDOWN_DIAGRAM_FILE_SUFFIX) &&
    error instanceof Error &&
    error.message.includes(NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE)
  );
}

function capitalizeWord(input: string): string {
  return input.replace(/^./u, (character) => character.toUpperCase());
}

function isNonEmptyScalarString(value: unknown): value is StepValueNode {
  return isScalar(value) && typeof value.value === "string" && value.value.length > 0;
}

function readSupportedVersionValue(node: ParsedNode | null): number | null {
  if (!isScalar(node) || typeof node.value !== "number") {
    return null;
  }

  return node.value;
}

function readNodeValue(node: unknown): unknown {
  if (!isScalar(node)) {
    return undefined;
  }

  return node.value;
}

function appendDiagnostic(
  collector: TourValidationCollector,
  diagnostic: Omit<TourDiagnostic, "code"> & { code?: string | null }
): void {
  const normalizedDiagnostic = normalizeCollectedDiagnostic(diagnostic);
  const diagnosticId = createCollectedDiagnosticId(normalizedDiagnostic);

  if (hasCollectedDiagnostic(collector, diagnosticId)) {
    return;
  }

  recordCollectedDiagnostic(collector, diagnosticId, normalizedDiagnostic);
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

function readDiagnosticLocationKey(diagnostic: TourDiagnostic): string {
  if (diagnostic.location === null) {
    return ":";
  }

  return `${diagnostic.location.line}:${diagnostic.location.column}`;
}

function hasCollectedDiagnostic(collector: TourValidationCollector, diagnosticId: string): boolean {
  return collector.seen.has(diagnosticId);
}

function recordCollectedDiagnostic(
  collector: TourValidationCollector,
  diagnosticId: string,
  diagnostic: TourDiagnostic
): void {
  collector.seen.add(diagnosticId);
  collector.diagnostics.push(diagnostic);
}

function stripTourContextPrefix(message: string): string {
  return message.replace(/^Tour\s+".+?":\s*/u, "").trim();
}

function createTourValidationError(context: TourContext, diagnostics: TourDiagnostic[]): Error {
  const error = new Error(createTourMessage(context, diagnostics[0]?.message ?? "failed unexpectedly"));

  (error as Error & { diagnostics?: TourDiagnostic[] }).diagnostics = diagnostics;

  return error;
}

function readFieldLocation(
  node: { range?: [number, number, number] | null } | null | undefined,
  parsedDocument: ParsedYamlDocument,
  lineCounter: LineCounter
): DiagnosticLocation | null {
  return readNodeLocation(node, lineCounter) ?? readDocumentLocation(parsedDocument, lineCounter);
}

function readDocumentLocation(
  parsedDocument: ParsedYamlDocument,
  lineCounter: LineCounter
): DiagnosticLocation | null {
  if (parsedDocument.range === undefined) {
    return null;
  }

  return toDiagnosticLocation(parsedDocument.range[0], lineCounter);
}

function readNodeLocation(
  node: { range?: [number, number, number] | null } | null | undefined,
  lineCounter: LineCounter
): DiagnosticLocation | null {
  const offset = readNodeStartOffset(node);

  if (offset === null) {
    return null;
  }

  return toDiagnosticLocation(offset, lineCounter);
}

function readNodeStartOffset(node: { range?: [number, number, number] | null } | null | undefined): number | null {
  const range = readNodeRange(node);

  if (range === null) {
    return null;
  }

  return range[0];
}

function readNodeRange(
  node: { range?: [number, number, number] | null } | null | undefined
): [number, number, number] | null {
  if (isMissingNode(node)) {
    return null;
  }

  const range = node.range;

  if (isMissingNodeRange(range)) {
    return null;
  }

  return range;
}

function isMissingNode(
  node: { range?: [number, number, number] | null } | null | undefined
): node is null | undefined {
  return node === null || node === undefined;
}

function isMissingNodeRange(
  range: [number, number, number] | null | undefined
): range is null | undefined {
  return range === null || range === undefined;
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

function createSourceLineCounter(source: string): LineCounter {
  const lineCounter = new LineCounter();

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      lineCounter.addNewLine(index);
    }
  }

  return lineCounter;
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createTourMessage(context: TourContext, message: string): string {
  return `Tour "${context.sourcePath}": ${message}`;
}

function createStepMessage(
  input: { stepIndex: number; context: TourContext },
  message: string
): string {
  return createTourMessage(input.context, `step ${input.stepIndex} ${message}`);
}

function createStepFieldMessage(
  input: { stepIndex: number; context: TourContext },
  field: ReferenceKind | "focus" | "text",
  message: string
): string {
  return createTourMessage(input.context, `step ${input.stepIndex} ${field} ${message}`);
}

async function runWithContext<T>(
  context: TourContext,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw ensureContextualError(error, context);
  }
}

function ensureContextualError(error: unknown, context: TourContext): Error {
  if (!(error instanceof Error)) {
    return new Error(createTourMessage(context, "failed unexpectedly"));
  }

  if (error.message.startsWith(`Tour "${context.sourcePath}"`)) {
    return error;
  }

  return createContextualError(error, context);
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

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n");
}

async function resolveValidationTarget(
  absolutePath: string
): Promise<
  | {
      absolutePath: string;
      kind: "directory" | "file";
    }
  | {
      absolutePath: string;
      kind: "unsupported";
    }
  | null
> {
  try {
    const stats = await stat(absolutePath);

    return readValidationTargetStats(absolutePath, stats);
  } catch {
    return null;
  }
}

function readValidationTargetStats(
  absolutePath: string,
  stats: Awaited<ReturnType<typeof stat>>
):
  | {
      absolutePath: string;
      kind: "directory" | "file";
    }
  | {
      absolutePath: string;
      kind: "unsupported";
    } {
  if (stats.isDirectory()) {
    return {
      absolutePath,
      kind: "directory"
    };
  }

  return readValidationTargetFile(absolutePath);
}

function readValidationTargetFile(
  absolutePath: string
):
  | {
      absolutePath: string;
      kind: "file";
    }
  | {
      absolutePath: string;
      kind: "unsupported";
    } {
  if (isSupportedValidationFile(absolutePath)) {
    return {
      absolutePath,
      kind: "file"
    };
  }

  return {
    absolutePath,
    kind: "unsupported"
  };
}

function isSupportedValidationFile(absolutePath: string): boolean {
  return [TOUR_FILE_SUFFIX, ...DIAGRAM_FILE_SUFFIXES].some((suffix) => absolutePath.endsWith(suffix));
}
