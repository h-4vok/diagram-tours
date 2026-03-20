import type { Dirent } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

import {
  SUPPORTED_TOUR_VERSION,
  type DiagramElement,
  type DiagramTour,
  type DiagramType,
  type ResolvedDiagramTour,
  type ResolvedDiagramTourCollection,
  type ResolvedDiagramTourCollectionEntry,
  type SkippedResolvedDiagramTour,
  type TourStep
} from "@diagram-tour/core";
import { parse as parseYaml } from "yaml";

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

  return createDiscoveredTourCollection(absoluteTarget);
}

export async function validateDiscoveredTours(sourceTarget: string): Promise<{
  invalid: SkippedResolvedDiagramTour[];
  valid: string[];
}> {
  const absoluteTarget = resolve(sourceTarget);
  const targetStats = await stat(absoluteTarget);

  return targetStats.isFile()
    ? await validateSingleDiscoveredTour(absoluteTarget)
    : await validateDiscoveredTourDirectory(absoluteTarget);
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
  assertDiscoveredEntries(result.entries.length, sourceRoot);

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

async function validateSingleDiscoveredTour(absolutePath: string): Promise<{
  invalid: SkippedResolvedDiagramTour[];
  valid: string[];
}> {
  const sourceRoot = dirname(absolutePath);

  return absolutePath.endsWith(TOUR_FILE_SUFFIX)
    ? await validateAuthoredTourPaths({
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

  return await validateAuthoredTourPaths({
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
  } satisfies {
    invalid: SkippedResolvedDiagramTour[];
    valid: string[];
  };

  for (const absoluteTourPath of input.tourPaths) {
    await appendValidatedTourPath(absoluteTourPath, input.sourceRoot, result);
  }

  result.valid.sort();

  return result;
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

function createSkippedTourEntry(
  absoluteTourPath: string,
  sourceRoot: string,
  error: unknown
): SkippedResolvedDiagramTour {
  return {
    sourcePath: normalizePath(relative(sourceRoot, absoluteTourPath)),
    error: (error as Error).message
  };
}

async function readTextFile(path: string): Promise<string> {
  const source = await readFile(path, "utf8");

  return normalizeNewlines(source);
}

async function readRawTourDocument(input: {
  absoluteTourPath: string;
  context: TourContext;
}): Promise<DiagramTour> {
  const tourSource = await readTextFile(input.absoluteTourPath);

  return parseTourDocument({
    source: tourSource,
    context: input.context
  });
}

function parseTourDocument(input: { source: string; context: TourContext }): DiagramTour {
  return toDiagramTour({
    value: parseYaml(input.source),
    context: input.context
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

function toDiagramTour(input: { value: unknown; context: TourContext }): DiagramTour {
  invariant(isRecord(input.value), createTourMessage(input.context, "document must be an object"));

  const version = input.value.version;
  const title = readTourTitle(input.value, input.context);
  const diagram = readTourDiagramPath(input.value, input.context);
  const steps = readTourSteps(input.value, input.context);

  invariant(
    version === SUPPORTED_TOUR_VERSION,
    createTourMessage(input.context, `unsupported tour version "${String(version)}"`)
  );

  return {
    version: SUPPORTED_TOUR_VERSION,
    title,
    diagram,
    steps: steps.map((step, index) =>
      toTourStep({
        value: step,
        stepIndex: index + 1,
        context: input.context
      })
    )
  };
}

function readTourTitle(value: Record<string, unknown>, context: TourContext): string {
  return asNonEmptyString(value.title, createTourMessage(context, "title is required"));
}

function readTourDiagramPath(value: Record<string, unknown>, context: TourContext): string {
  return asNonEmptyString(value.diagram, createTourMessage(context, "diagram path is required"));
}

function readTourSteps(value: Record<string, unknown>, context: TourContext): unknown[] {
  return asNonEmptyArray(
    value.steps,
    createTourMessage(context, "steps must be a non-empty array")
  );
}

function toTourStep(input: {
  value: unknown;
  stepIndex: number;
  context: TourContext;
}): TourStep {
  invariant(isRecord(input.value), createStepMessage(input, "must be an object"));

  return {
    focus: asArray(
      input.value.focus,
      createStepFieldMessage(input, "focus", "must be an array")
    ).map((value) => toFocusElementId(value, input)),
    text: asNonEmptyString(input.value.text, createStepFieldMessage(input, "text", "is required"))
  };
}

function toFocusElementId(
  value: unknown,
  input: { stepIndex: number; context: TourContext }
): string {
  return asNonEmptyString(
    value,
    createStepFieldMessage(input, "focus", "must contain only non-empty diagram element ids")
  );
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
  const rawTour = await readRawTourDocument(input);
  const loadedDiagram = await readDiagramSource({
    absoluteTourPath: input.absoluteTourPath,
    context: input.context,
    diagramPath: rawTour.diagram
  });

  return {
    ownedDiagramSourceId: loadedDiagram.ownedDiagramSourceId,
    tour: resolveLoadedTour({
      context: input.context,
      diagramPath: rawTour.diagram,
      diagramSource: loadedDiagram.source,
      rawTour
    })
  };
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

function asNonEmptyString(value: unknown, message: string): string {
  invariant(typeof value === "string" && value.length > 0, message);

  return value;
}

function asArray(value: unknown, message: string): unknown[] {
  invariant(Array.isArray(value), message);

  return value;
}

function asNonEmptyArray(value: unknown, message: string): unknown[] {
  const array = asArray(value, message);

  invariant(array.length > 0, message);

  return array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  return new Error(createTourMessage(context, error.message));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n");
}
