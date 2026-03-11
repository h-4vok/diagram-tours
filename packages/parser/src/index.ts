import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  SUPPORTED_TOUR_VERSION,
  type DiagramAsset,
  type DiagramTour,
  type MermaidNode,
  type ResolvedDiagramTour,
  type TourAsset,
  type TourStep
} from "@diagram-tour/core";
import { parse as parseYaml } from "yaml";

const MERMAID_NODE_PATTERN = /([A-Za-z][A-Za-z0-9_]*)\[([^\]]+)\]/g;
const NODE_REFERENCE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;

type NodeIndex = Map<string, MermaidNode>;
type ReferenceKind = "focus" | "text";

export interface MermaidParseResult {
  asset: DiagramAsset;
}

export interface TourParseResult {
  asset: TourAsset;
}

export async function loadResolvedTour(tourPath: string): Promise<ResolvedDiagramTour> {
  const absoluteTourPath = resolve(tourPath);
  const tourSource = await readTextFile(absoluteTourPath);
  const rawTour = parseTourDocument(tourSource);
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
        nodeIndex
      })
    )
  };
}

export function parseMermaid(source: string, path = "diagram.mmd"): MermaidParseResult {
  return {
    asset: {
      path,
      source
    }
  };
}

export function parseTourYaml(source: string, path = "tour.yaml"): TourParseResult {
  return {
    asset: {
      path,
      source
    }
  };
}

export function validateTourShape(tour: DiagramTour): DiagramTour {
  return tour;
}

async function readTextFile(path: string): Promise<string> {
  const source = await readFile(path, "utf8");

  return normalizeNewlines(source);
}

function parseTourDocument(source: string): DiagramTour {
  return toDiagramTour(parseYaml(source));
}

function toDiagramTour(value: unknown): DiagramTour {
  invariant(isRecord(value), "Tour document must be an object");

  const version = value.version;
  const title = asNonEmptyString(value.title, "Tour title is required");
  const diagram = asNonEmptyString(value.diagram, "Tour diagram path is required");
  const steps = asNonEmptyArray(value.steps, "Tour steps must be a non-empty array");

  invariant(
    version === SUPPORTED_TOUR_VERSION,
    `Unsupported tour version "${String(version)}"`
  );

  return {
    version: SUPPORTED_TOUR_VERSION,
    title,
    diagram,
    steps: steps.map(toTourStep)
  };
}

function toTourStep(value: unknown): TourStep {
  invariant(isRecord(value), "Tour step must be an object");

  return {
    focus: asArray(value.focus, "Step focus must be an array").map(toFocusNodeId),
    text: asNonEmptyString(value.text, "Step text is required")
  };
}

function toFocusNodeId(value: unknown): string {
  return asNonEmptyString(value, "Focus node ids must be non-empty strings");
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
}) {
  validateFocusNodes(input);

  return {
    index: input.stepIndex,
    focusNodeIds: input.step.focus,
    rawText: input.step.text,
    text: resolveTextReferences(input)
  };
}

function validateFocusNodes(input: {
  step: TourStep;
  stepIndex: number;
  nodeIndex: NodeIndex;
}): void {
  for (const nodeId of input.step.focus) {
    resolveNode({
      id: nodeId,
      nodeIndex: input.nodeIndex,
      message: createUnknownNodeMessage({
        nodeId,
        stepIndex: input.stepIndex,
        kind: "focus"
      })
    });
  }
}

function resolveTextReferences(input: {
  step: TourStep;
  stepIndex: number;
  nodeIndex: NodeIndex;
}): string {
  return input.step.text.replaceAll(NODE_REFERENCE_PATTERN, (_match, nodeId: string) =>
    resolveNode({
      id: nodeId,
      nodeIndex: input.nodeIndex,
      message: createUnknownNodeMessage({
        nodeId,
        stepIndex: input.stepIndex,
        kind: "text"
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
}): string {
  return `Unknown Mermaid node id "${input.nodeId}" referenced in ${input.kind} for step ${input.stepIndex}`;
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

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n");
}
