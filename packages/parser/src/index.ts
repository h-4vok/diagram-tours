import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

import {
  SUPPORTED_TOUR_VERSION,
  type DiagramTour,
  type MermaidNode,
  type ResolvedDiagramTour,
  type ResolvedDiagramTourCollection,
  type ResolvedDiagramTourCollectionEntry,
  type SkippedResolvedDiagramTour,
  type TourStep
} from "@diagram-tour/core";
import { parse as parseYaml } from "yaml";

const MERMAID_NODE_PATTERN = /([A-Za-z][A-Za-z0-9_]*)\[([^\]]+)\]/g;
const NODE_REFERENCE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;
const TOUR_FILE_SUFFIX = ".tour.yaml";
const NO_VALID_TOURS_MESSAGE = "No valid tours were discovered";

type NodeIndex = Map<string, MermaidNode>;
type ReferenceKind = "focus" | "text";

export async function loadResolvedTour(tourPath: string): Promise<ResolvedDiagramTour> {
  const absoluteTourPath = resolve(tourPath);
  const context = createTourContext(absoluteTourPath);

  return runWithContext(context, async () => {
    const tourSource = await readTextFile(absoluteTourPath);
    const rawTour = parseTourDocument({
      source: tourSource,
      context
    });
    const absoluteDiagramPath = resolve(dirname(absoluteTourPath), rawTour.diagram);
    const diagramSource = await readTextFile(absoluteDiagramPath);
    const nodeIndex = createNodeIndex(diagramSource);

    return {
      version: rawTour.version,
      title: rawTour.title,
      diagram: {
        path: normalizePath(rawTour.diagram),
        source: diagramSource,
        nodes: Array.from(nodeIndex.values())
      },
      steps: rawTour.steps.map((step, index) =>
        resolveTourStep({
          step,
          stepIndex: index + 1,
          nodeIndex,
          context
        })
      )
    };
  });
}

export async function loadResolvedTourCollection(
  sourceTarget: string
): Promise<ResolvedDiagramTourCollection> {
  const absoluteTarget = resolve(sourceTarget);
  const targetStats = await stat(absoluteTarget);

  if (targetStats.isFile()) {
    return createSingleTourCollection(absoluteTarget);
  }

  return createDiscoveredTourCollection(absoluteTarget);
}

async function createSingleTourCollection(
  absoluteTourPath: string
): Promise<ResolvedDiagramTourCollection> {
  const entry = await createCollectionEntry({
    absoluteTourPath,
    sourceRoot: dirname(absoluteTourPath)
  });

  return {
    entries: [entry],
    skipped: []
  };
}

async function createDiscoveredTourCollection(
  sourceRoot: string
): Promise<ResolvedDiagramTourCollection> {
  const tourPaths = await collectTourPaths(sourceRoot);
  const entries: ResolvedDiagramTourCollectionEntry[] = [];
  const skipped: SkippedResolvedDiagramTour[] = [];

  for (const absoluteTourPath of tourPaths) {
    try {
      entries.push(
        await createCollectionEntry({
          absoluteTourPath,
          sourceRoot
        })
      );
    } catch (error) {
      skipped.push({
        sourcePath: normalizePath(relative(sourceRoot, absoluteTourPath)),
        error: (error as Error).message
      });
    }
  }

  invariant(
    entries.length > 0,
    `${NO_VALID_TOURS_MESSAGE} in source target "${normalizePath(sourceRoot)}".`
  );

  return {
    entries,
    skipped
  };
}

async function createCollectionEntry(input: {
  absoluteTourPath: string;
  sourceRoot: string;
}): Promise<ResolvedDiagramTourCollectionEntry> {
  const sourcePath = normalizePath(relative(input.sourceRoot, input.absoluteTourPath));
  const tour = await loadResolvedTour(input.absoluteTourPath);

  return {
    slug: createSlug(sourcePath),
    sourcePath,
    title: tour.title,
    tour
  };
}

async function collectTourPaths(sourceRoot: string): Promise<string[]> {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const nestedPaths = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? collectTourPaths(resolve(sourceRoot, entry.name))
        : collectTourFilePath(sourceRoot, entry.name)
    )
  );

  return nestedPaths.flat().sort();
}

function collectTourFilePath(sourceRoot: string, name: string): string[] {
  if (!name.endsWith(TOUR_FILE_SUFFIX)) {
    return [];
  }

  return [resolve(sourceRoot, name)];
}

async function readTextFile(path: string): Promise<string> {
  const source = await readFile(path, "utf8");

  return normalizeNewlines(source);
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

function toDiagramTour(input: { value: unknown; context: TourContext }): DiagramTour {
  invariant(isRecord(input.value), createTourMessage(input.context, "document must be an object"));

  const version = input.value.version;
  const title = asNonEmptyString(
    input.value.title,
    createTourMessage(input.context, "title is required")
  );
  const diagram = asNonEmptyString(
    input.value.diagram,
    createTourMessage(input.context, "diagram path is required")
  );
  const steps = asNonEmptyArray(
    input.value.steps,
    createTourMessage(input.context, "steps must be a non-empty array")
  );

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
    ).map((value) => toFocusNodeId(value, input)),
    text: asNonEmptyString(input.value.text, createStepFieldMessage(input, "text", "is required"))
  };
}

function toFocusNodeId(
  value: unknown,
  input: { stepIndex: number; context: TourContext }
): string {
  return asNonEmptyString(
    value,
    createStepFieldMessage(input, "focus", "must contain only non-empty node ids")
  );
}

function createNodeIndex(source: string): NodeIndex {
  const nodes = new Map<string, MermaidNode>();

  for (const match of source.matchAll(MERMAID_NODE_PATTERN)) {
    nodes.set(match[1], {
      id: match[1],
      label: match[2].trim()
    });
  }

  return nodes;
}

function resolveTourStep(input: {
  step: TourStep;
  stepIndex: number;
  nodeIndex: NodeIndex;
  context: TourContext;
}) {
  return {
    index: input.stepIndex,
    focus: resolveFocusNodes(input),
    text: resolveTextReferences(input)
  };
}

function resolveFocusNodes(input: {
  step: TourStep;
  stepIndex: number;
  nodeIndex: NodeIndex;
  context: TourContext;
}): MermaidNode[] {
  return input.step.focus.map((nodeId) =>
    resolveNode({
      id: nodeId,
      nodeIndex: input.nodeIndex,
      message: createUnknownNodeMessage({
        nodeId,
        stepIndex: input.stepIndex,
        kind: "focus",
        context: input.context
      })
    })
  );
}

function resolveTextReferences(input: {
  step: TourStep;
  stepIndex: number;
  nodeIndex: NodeIndex;
  context: TourContext;
}): string {
  return input.step.text.replaceAll(NODE_REFERENCE_PATTERN, (_match, nodeId: string) =>
    resolveNode({
      id: nodeId,
      nodeIndex: input.nodeIndex,
      message: createUnknownNodeMessage({
        nodeId,
        stepIndex: input.stepIndex,
        kind: "text",
        context: input.context
      })
    }).label
  );
}

function resolveNode(input: {
  id: string;
  nodeIndex: NodeIndex;
  message: string;
}): MermaidNode {
  const node = input.nodeIndex.get(input.id);

  invariant(node !== undefined, input.message);

  return node;
}

function createUnknownNodeMessage(input: {
  nodeId: string;
  stepIndex: number;
  kind: ReferenceKind;
  context: TourContext;
}): string {
  return createStepFieldMessage(
    input,
    input.kind,
    `references unknown Mermaid node id "${input.nodeId}"`
  );
}

function createSlug(sourcePath: string): string {
  const normalizedPath = normalizePath(sourcePath);
  const fileStem = basename(normalizedPath, TOUR_FILE_SUFFIX);
  const directoryPath = normalizePath(dirname(normalizedPath));

  if (directoryPath === "." || basename(directoryPath) !== fileStem) {
    return normalizedPath.replace(TOUR_FILE_SUFFIX, "");
  }

  return directoryPath;
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
