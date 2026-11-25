import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const MINDMAP_HEADER_PATTERN = /^mindmap\b/u;
const MINDMAP_DIRECTIVE_PATTERN = /%%\{[\s\S]*?\}%%/gu;
const MINDMAP_FRONTMATTER_PATTERN = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u;
const MINDMAP_DECORATION_PATTERN = /^(?:::icon\(|:::)/iu;
const MINDMAP_COMMENT_PATTERN = /^%%/u;
const MINDMAP_WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const MINDMAP_CAMEL_BOUNDARY_PATTERN = /([a-z0-9])([A-Z])/gu;
const MINDMAP_NON_NODE_PATTERNS = [
  MINDMAP_DECORATION_PATTERN,
  MINDMAP_COMMENT_PATTERN
];

type MindmapNodeLine = {
  explicitId?: string;
  indent: number;
  label: string;
};

type MindmapNodeDefinition = Omit<MindmapNodeLine, "indent">;

type MindmapShape = {
  id: string;
  label: string;
  start: string;
};

type MindmapStackEntry = {
  indent: number;
  path: string[];
};

type MindmapSourceLineState = {
  lines: string[];
  multilineLineIndex: number | null;
  multilineEnd: string | null;
};

const MINDMAP_SHAPES = [
  ["((", "))"],
  ["{{", "}}"],
  ["))", "(("],
  [")", "("],
  ["[", "]"],
  ["(", ")"]
] as const;

export function createMindmapDiagramModel(source: string): DiagramModel {
  return {
    elements: extractMindmapElements(source),
    renderSource: source,
    type: "mindmap"
  };
}

function readMindmapSourceLines(source: string): string[] {
  const cleaned = source
    .replace(/^\uFEFF/u, "")
    .replace(MINDMAP_FRONTMATTER_PATTERN, "")
    .replace(MINDMAP_DIRECTIVE_PATTERN, "");
  const state: MindmapSourceLineState = { lines: [], multilineLineIndex: null, multilineEnd: null };
  const lines = cleaned.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => MINDMAP_HEADER_PATTERN.test(line.trimStart()));
  if (headerIndex >= 0) {
    lines[headerIndex] = readMindmapHeaderRoot(lines[headerIndex]);
  }
  lines.forEach((line) => {
    appendMindmapSourceLine(line, state);
  });

  return state.lines;
}

function readMindmapHeaderRoot(line: string): string {
  const match = /^([ \t]*)mindmap\b(.*)$/u.exec(line)!;
  return `${match[1]}${readMindmapHeaderContent(match[2])}`;
}

function readMindmapHeaderContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.startsWith("%%") ? "" : trimmed;
}

function appendMindmapSourceLine(line: string, state: MindmapSourceLineState): void {
  const multilineIndex = state.multilineLineIndex;
  if (multilineIndex !== null) {
    appendMindmapContinuation(line, state, multilineIndex);
    return;
  }

  appendMindmapFirstLine(line, state);
}

function appendMindmapFirstLine(line: string, state: MindmapSourceLineState): void {
  state.lines.push(line);
  if (isMindmapNonNodeLine(line.trim())) {
    return;
  }

  const shapeEnd = readMindmapUnclosedShape(line);
  if (shapeEnd !== null) {
    state.multilineLineIndex = state.lines.length - 1;
    state.multilineEnd = shapeEnd;
  }
}

function appendMindmapContinuation(line: string, state: MindmapSourceLineState, multilineIndex: number): void {
  state.lines[multilineIndex] += ` ${line.trim()}`;
  if (state.multilineEnd !== null && line.trimEnd().endsWith(state.multilineEnd)) {
    state.multilineLineIndex = null;
    state.multilineEnd = null;
  }
}

function readMindmapUnclosedShape(line: string): string | null {
  const candidate = readFirstMindmapShapeStart(line);
  if (candidate === null) {
    return null;
  }

  return isMindmapShapeClosed(line, candidate) ? null : readMindmapShapeClosing(line, candidate);
}

function readFirstMindmapShapeStart(line: string): { end: string; index: number; start: string } | null {
  return MINDMAP_SHAPES.map(([start, end]) => ({ end, index: line.indexOf(start), start }))
    .filter(({ index }) => index > 0)
    .sort((left, right) => left.index - right.index)
    .at(0) ?? null;
}

function isMindmapShapeClosed(line: string, shape: { end: string; index: number; start: string }): boolean {
  return line.trimEnd().endsWith(readMindmapShapeClosing(line, shape));
}

function readMindmapShapeClosing(
  line: string,
  shape: { index: number; start: string; end: string }
): string {
  const label = line.slice(shape.index + shape.start.length);
  const quote = label.startsWith('"') ? '"' : "";
  const markdownFence = label.startsWith('"`') ? "`" : "";
  return `${markdownFence}${quote}${shape.end}`;
}

function extractMindmapElements(source: string): DiagramElement[] {
  const stack: MindmapStackEntry[] = [];
  const usedIds = new Set<string>();
  const elements: DiagramElement[] = [];

  readMindmapSourceLines(source).forEach((line) => {
    registerMindmapNode(line, { stack, usedIds, elements });
  });

  return elements;
}

function registerMindmapNode(
  line: string,
  state: { stack: MindmapStackEntry[]; usedIds: Set<string>; elements: DiagramElement[] }
): void {
  const nodeLine = readMindmapNodeLine(line);
  if (nodeLine === null) {
    return;
  }

  const parentPath = readMindmapParentPath(state.stack, nodeLine.indent);
  const id = makeUniqueMindmapId(readMindmapNodeId(nodeLine, parentPath), state.usedIds);

  state.elements.push({ id, kind: "node", label: nodeLine.label });
  state.stack.push({ indent: nodeLine.indent, path: [...parentPath, readUniqueMindmapPathSegment(nodeLine, id, parentPath)] });
}

function readMindmapParentPath(stack: MindmapStackEntry[], indent: number): string[] {
  return readMindmapParent(stack, indent)?.path ?? [];
}

function readMindmapNodeId(nodeLine: MindmapNodeLine, parentPath: string[]): string {
  return nodeLine.explicitId ?? `mindmap-${[...parentPath, slugMindmapLabel(nodeLine.label)].join("-")}`;
}

function readMindmapParent(stack: MindmapStackEntry[], indent: number): MindmapStackEntry | undefined {
  while (stack.length > 0 && stack.at(-1)!.indent >= indent) {
    stack.pop();
  }

  return stack.at(-1);
}

function readUniqueMindmapPathSegment(nodeLine: MindmapNodeLine, id: string, parentPath: string[]): string {
  if (nodeLine.explicitId !== undefined) {
    return id;
  }

  return id.slice(readMindmapParentIdPrefix(parentPath).length);
}

function readMindmapParentIdPrefix(parentPath: string[]): string {
  return parentPath.length === 0 ? "mindmap-" : `mindmap-${parentPath.join("-")}-`;
}

function readMindmapNodeLine(line: string): MindmapNodeLine | null {
  const trimmed = line.trim();
  const indent = line.length - line.trimStart().length;
  if (isMindmapNonNodeLine(trimmed)) {
    return null;
  }

  const definition = readMindmapDefinition(trimmed);
  return definition.label.length === 0
    ? null
    : { ...definition, indent };
}

function isMindmapNonNodeLine(line: string): boolean {
  return line.length === 0 || MINDMAP_NON_NODE_PATTERNS.some((pattern) => pattern.test(line));
}

function readMindmapDefinition(line: string): MindmapNodeDefinition {
  const shape = readMindmapShape(line);
  if (shape !== null) {
    return { explicitId: shape.id, label: normalizeMindmapLabel(shape.label, shape.start) };
  }

  return { label: normalizeMindmapLabel(line) };
}

function readMindmapShape(value: string): MindmapShape | null {
  const shape = MINDMAP_SHAPES.map(([start, end]) => readMindmapShapeMatch(value, start, end)).find(
    (match) => match !== null
  );
  return shape ?? null;
}

function readMindmapShapeMatch(value: string, start: string, end: string): MindmapShape | null {
  const startIndex = value.indexOf(start);
  if (!isMindmapShapeMatch(value, startIndex, end)) {
    return null;
  }

  const id = value.slice(0, startIndex).trim();
  if (id.length === 0) {
    return null;
  }

  return { id, label: value.slice(startIndex + start.length, -end.length), start };
}

function isMindmapShapeMatch(value: string, startIndex: number, end: string): boolean {
  return startIndex >= 0 && value.endsWith(end);
}

function normalizeMindmapLabel(label: string, shapeStart?: string): string {
  return readMindmapLabelText(label.trim(), shapeStart).replace(/\s+/gu, " ").trim();
}

function readMindmapLabelText(label: string, shapeStart?: string): string {
  return stripMindmapMarkdownFences(stripMindmapQuotes(stripMindmapCloudMarker(label, shapeStart)));
}

function stripMindmapCloudMarker(label: string, shapeStart?: string): string {
  return shapeStart === "(" && label.startsWith("-") ? label.slice(1) : label;
}

function stripMindmapQuotes(label: string): string {
  return label.startsWith('"') && label.endsWith('"') ? label.slice(1, -1) : label;
}

function stripMindmapMarkdownFences(label: string): string {
  const match = /^`+([\s\S]*?)`+$/u.exec(label);
  return match === null ? label : removeMindmapMarkdownEmphasis(match[1]!);
}

function removeMindmapMarkdownEmphasis(label: string): string {
  return label.replace(/(\*\*|__|~~|\*|_)(.*?)\1/gu, "$2");
}

function slugMindmapLabel(label: string): string {
  const words = label.replace(MINDMAP_CAMEL_BOUNDARY_PATTERN, "$1 $2").match(MINDMAP_WORD_PATTERN) ?? [];
  return words.join("-").toLowerCase() || "topic";
}

function makeUniqueMindmapId(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}
