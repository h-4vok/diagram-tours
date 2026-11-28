import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const FLOWCHART_ID_SOURCE = "[A-Za-z][A-Za-z0-9_]*";
const FLOWCHART_SHAPED_NODE_PATTERN = new RegExp(
  [
    `\\b(${FLOWCHART_ID_SOURCE})\\s*`,
    "(",
    "\\[\\[([^\\]\\n]+)\\]\\]",
    "|\\[\\(([^)\\n]+)\\)\\]",
    "|\\(\\(\\(([^)\\n]+)\\)\\)\\)",
    "|\\(\\(([^)\\n]+)\\)\\)",
    "|\\(\\[([^\\]\\n]+)\\]\\)",
    "|\\{\\{([^}\\n]+)\\}\\}",
    "|\\[/([^/\\\\\\]\\n]+)\\/\\]",
    "|\\[\\\\([^/\\\\\\]\\n]+)\\\\\\]",
    "|\\[/([^/\\\\\\]\\n]+)\\\\\\]",
    "|\\[\\\\([^/\\\\\\]\\n]+)\\/\\]",
    "|\\[([^\\]\\n]+)\\]",
    "|\\(([^)\\n]+)\\)",
    "|\\{([^}\\n]+)\\}",
    "|>([^\\]\\n]+)\\]",
    ")"
  ].join(""),
  "gu"
);
const FLOWCHART_METADATA_NODE_PATTERN = new RegExp(
  `\\b(${FLOWCHART_ID_SOURCE})\\s*@\\{([^}\\n]*)\\}`,
  "gu"
);
const FLOWCHART_METADATA_LABEL_PATTERN =
  /(?:^|,)\s*label\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^,}]+))/u;
const FLOWCHART_IGNORED_LINE_PATTERN =
  /^\s*(?:class|classDef|click|direction|end|linkStyle|style|subgraph)\b/u;
const FLOWCHART_SUBGRAPH_PATTERN = /^\s*subgraph\s+(?:([\p{L}\p{N}_-]+)\s*\[([^\]]+)\]|"([^"]+)"|'([^']+)'|([\p{L}\p{N}_-]+(?:\s+[\p{L}\p{N}_-]+)*))\s*$/u;
const FLOWCHART_CONNECTOR_SOURCE = String.raw`(?:[ox]?[-=.]{2,}[ox>]*|<[-=.]{2,}[ox>]*)`;
const FLOWCHART_LINE_START_ID_PATTERN = new RegExp(`^\\s*(${FLOWCHART_ID_SOURCE})\\b`, "u");
const FLOWCHART_ENDPOINT_SOURCE = `${FLOWCHART_ID_SOURCE}(?:\\s*(?:\\[\\]|\\(\\)|\\{\\}|@\\{[^}\\n]*\\}))?(?:\\s*:::[A-Za-z][A-Za-z0-9_-]*)*`;
const FLOWCHART_NODE_GROUP_SOURCE = `${FLOWCHART_ENDPOINT_SOURCE}(?:\\s*&\\s*${FLOWCHART_ENDPOINT_SOURCE})*`;
const FLOWCHART_BRANCH_LABEL_SOURCE =
  `(?:\\|([^|]*)\\|\\s*|"([^"]+)"\\s*${FLOWCHART_CONNECTOR_SOURCE}\\s*|'([^']+)'\\s*${FLOWCHART_CONNECTOR_SOURCE}\\s*)?`;
const FLOWCHART_INLINE_LABEL_START_CONNECTOR = String.raw`(?:-{2,}(?![-=.ox>])|-\.(?![-=.ox>])|={2,}(?![-=.ox>]))`;
const FLOWCHART_INLINE_LABEL_PATTERN = new RegExp(
  `(${FLOWCHART_INLINE_LABEL_START_CONNECTOR})\\s*(.+?)\\s*(${FLOWCHART_CONNECTOR_SOURCE})`,
  "gu"
);
const FLOWCHART_TRANSITION_PATTERN = new RegExp(
  `\\b(${FLOWCHART_NODE_GROUP_SOURCE})\\s*(?:([A-Za-z][A-Za-z0-9_-]*)@\\s*)?(${FLOWCHART_CONNECTOR_SOURCE})\\s*${FLOWCHART_BRANCH_LABEL_SOURCE}(${FLOWCHART_NODE_GROUP_SOURCE})\\b`,
  "gu"
);
const FLOWCHART_COMMENT_LINE_PATTERN = /^\s*%%/u;
const FLOWCHART_DETACHED_EDGE_PATTERN = /^\s*[-=.]{2,}/u;
const FLOWCHART_SHAPE_MASK_PATTERN = new RegExp(
  `\\b(${FLOWCHART_ID_SOURCE})\\s*(?:\\[\\[[^\\]\\n]*\\]\\]|\\[\\([^)]*\\)\\]|\\(\\(\\([^)]*\\)\\)\\)|\\(\\([^)]*\\)\\)|\\(\\[[^\\]]*\\]\\)|\\{\\{[^}\\n]*\\}\\}|\\[[^\\]\\n]*\\]|\\([^)]*\\)|\\{[^}\\n]*\\}|>[^\\]\\n]*\\])`,
  "gu"
);
const FLOWCHART_TRANSITION_CAMEL_BOUNDARY_PATTERN = /([a-z0-9])([A-Z])/gu;
const FLOWCHART_TRANSITION_WORD_PATTERN = /[\p{L}\p{N}]+/gu;

type FlowchartElementDraft = {
  explicit: boolean;
  id: string;
  index: number;
  label: string;
};

type FlowchartLinkDraft = {
  customId?: string;
  label: string | null;
  sourceId: string;
  targetId: string;
};

type FlowchartTransitionCreationInput = {
  input: FlowchartLinkDraft;
  nodeIndex: Map<string, DiagramElement>;
  renderId: string;
  renderOrder: number;
  usedIds: Set<string>;
  reservedIds: Set<string>;
};
type FlowchartTransitionExtractionContext = {
  nodeIndex: Map<string, DiagramElement>;
  occurrences: Map<string, number>;
  renderOrder: number;
  usedRenderIds: Set<string>;
  usedIds: Set<string>;
  reservedIds: Set<string>;
};
type FlowchartGroupExtractionContext = {
  active: DiagramElement[];
  groups: DiagramElement[];
  usedIds: Set<string>;
  parents: string[];
};

export function createFlowchartDiagramModel(source: string): DiagramModel {
  const nodes = extractFlowchartElements(source);

  return {
    elements: [...nodes, ...extractFlowchartGroups(source), ...extractFlowchartTransitions(source, nodes)],
    renderSource: source,
    type: "flowchart"
  };
}

function extractFlowchartGroups(source: string): DiagramElement[] {
  const context: FlowchartGroupExtractionContext = { active: [], groups: [], usedIds: new Set<string>(), parents: [] };

  for (const line of source.split("\n")) {
    splitFlowchartStatements(line).forEach((statement) => readFlowchartGroup(statement, context));
  }
  return context.groups;
}

function readFlowchartGroup(line: string, context: FlowchartGroupExtractionContext): void {
  if (/^\s*end\b/u.test(line)) {
    context.active.pop();
    context.parents.pop();
    return;
  }
  const match = line.match(FLOWCHART_SUBGRAPH_PATTERN);
  if (match === null) {
    readFlowchartStatementElements(line).forEach(({ id }) => {
      context.active.forEach((active) => {
        active.renderMemberIds = [...new Set([...(active.renderMemberIds ?? []), id])];
      });
    });
    return;
  }
  const group = createFlowchartGroup(match, context);
  context.groups.push(group);
  context.active.push(group);
  context.parents.push(slugFlowchartGroup(group.label));
}

function createFlowchartGroup(match: RegExpMatchArray, context: FlowchartGroupExtractionContext): DiagramElement {
  const sourceId = readFlowchartGroupSourceId(match);
  const label = readFlowchartGroupLabel(match);
  const baseId = createFlowchartGroupBaseId(sourceId, label, context.parents);
  const id = createUniqueFlowchartGroupId(baseId, context.usedIds);

  return {
    id,
    kind: "group",
    label,
    ...(sourceId ? { renderId: sourceId } : {}),
    renderOrder: context.groups.length
  };
}

function readFlowchartGroupSourceId(match: RegExpMatchArray): string {
  return match[1] || "";
}

function readFlowchartGroupLabel(match: RegExpMatchArray): string {
  return match.slice(2, 6).find(Boolean)!.trim();
}

function createFlowchartGroupBaseId(sourceId: string, label: string, parents: string[]): string {
  return `group-${sourceId || [...parents, slugFlowchartGroup(label)].join("-")}`;
}

function createUniqueFlowchartGroupId(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function slugFlowchartGroup(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "") || "group";
}

function extractFlowchartElements(source: string): DiagramElement[] {
  const elements = new Map<string, DiagramElement>();

  for (const line of source.split("\n")) {
    const lineElements = readFlowchartLineElements(line);
    const linkEndpoints = readFlowchartLineLinks(line).flatMap(({ sourceId, targetId }) => [
      createBareEndpoint(sourceId, line.indexOf(sourceId)),
      createBareEndpoint(targetId, line.lastIndexOf(targetId))
    ]);
    [...lineElements, ...linkEndpoints].forEach((element) => registerFlowchartElement(elements, element));
  }

  return Array.from(elements.values());
}

function extractFlowchartTransitions(source: string, nodes: DiagramElement[]): DiagramElement[] {
  const links = source.split("\n").flatMap(readFlowchartLineLinks);
  const context = {
    nodeIndex: new Map(nodes.map((node) => [node.id, node])),
    occurrences: new Map<string, number>(),
    renderOrder: 0,
    usedIds: new Set(nodes.map((node) => node.id)),
    reservedIds: readReservedFlowchartTransitionIds(links),
    usedRenderIds: new Set<string>()
  };

  return source.split("\n").flatMap((line) => readFlowchartLineTransitions(line, context));
}

function readFlowchartLineTransitions(line: string, context: FlowchartTransitionExtractionContext): DiagramElement[] {
  return readFlowchartLineLinks(line).flatMap((input) => {
    const renderIndex = readAndIncrementFlowchartPairCount(context.occurrences, input);
    const renderOrder = context.renderOrder;
    context.renderOrder += 1;
    const renderId = readFlowchartRenderId(input, renderIndex, context.usedRenderIds);
    return [
      createFlowchartTransition({
        input,
        nodeIndex: context.nodeIndex,
        renderId,
        renderOrder,
        usedIds: context.usedIds,
        reservedIds: context.reservedIds
      })
    ];
  });
}

function readReservedFlowchartTransitionIds(links: FlowchartLinkDraft[]): Set<string> {
  const usedIds = new Set<string>();
  links.filter((link) => link.label !== null).forEach((link) => {
    const base = createFlowchartTransitionBaseId(link.label!, link.sourceId, link.targetId);
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate)) { candidate = `${base}-${suffix}`; suffix += 1; }
    usedIds.add(candidate);
  });
  return usedIds;
}

function readFlowchartLineLinks(line: string): FlowchartLinkDraft[] {
  return splitFlowchartStatements(line).flatMap((statement) =>
    isIgnoredFlowchartLine(statement)
      ? []
      : collectFlowchartLineLinks(maskFlowchartNodeLabels(normalizeCompactMarkerNode(statement)))
  );
}

function normalizeCompactMarkerNode(line: string): string {
  return line.replace(/--([ox])([A-Za-z][A-Za-z0-9_]*)-->/gu, "--$1 $2 -->");
}

function splitFlowchartStatements(line: string): string[] {
  return line.split(/;(?=(?:[^"']|"[^"]*"|'[^']*')*$)/u);
}

function collectFlowchartLineLinks(sanitizedLine: string): FlowchartLinkDraft[] {
  const links: FlowchartLinkDraft[] = [];
  let cursor = 0;
  while (cursor < sanitizedLine.length) {
    FLOWCHART_TRANSITION_PATTERN.lastIndex = cursor;
    const match = FLOWCHART_TRANSITION_PATTERN.exec(sanitizedLine);
    if (match === null) {
      break;
    }
    links.push(...createFlowchartLinksFromMatch(match));
    cursor = match.index + match[0].lastIndexOf(match[7]!);
  }
  return links;
}

function isIgnoredFlowchartLine(line: string): boolean {
  return (
    FLOWCHART_IGNORED_LINE_PATTERN.test(line) ||
    FLOWCHART_COMMENT_LINE_PATTERN.test(line) ||
    FLOWCHART_DETACHED_EDGE_PATTERN.test(line)
  );
}

function maskFlowchartNodeLabels(line: string): string {
  const quotedLine = protectFlowchartQuotedText(line);
  const protectedLine = protectFlowchartPlainLinkLabels(quotedLine.line, quotedLine.labels);
  const matches = [
    ...protectedLine.line.matchAll(FLOWCHART_SHAPE_MASK_PATTERN),
    ...protectedLine.line.matchAll(FLOWCHART_METADATA_NODE_PATTERN)
  ].sort((left, right) => Number(right.index) - Number(left.index));
  const maskedLine = matches.reduce((masked, match) => {
    const start = Number(match.index);
    const idEnd = start + match[0].indexOf(match[1]) + match[1].length;
    return `${masked.slice(0, idEnd)}[]${masked.slice(start + match[0].length)}`;
  }, protectedLine.line);
  return restoreFlowchartQuotedText(maskedLine, protectedLine.labels);
}

function createFlowchartLinksFromMatch(match: RegExpMatchArray): FlowchartLinkDraft[] {
  const [sourceIds, targetIds] = [readFlowchartEndpointIds(match[1]!), readFlowchartEndpointIds(match[7]!)];
  const connector = match[3]!;
  const label = readFlowchartMatchLabel(match);
  const customId = match[2] || undefined;
  return sourceIds.flatMap((sourceId, sourceIndex) => targetIds.map((targetId, targetIndex) =>
    createFlowchartLink({
      customId: sourceIndex === sourceIds.length - 1 && targetIndex === 0 ? customId : undefined,
      label,
      connector,
      sourceId,
      targetId
    })
  ));
}

function createFlowchartLink(input: FlowchartLinkDraft & { connector: string }): FlowchartLinkDraft {
  const link = {
    label: input.label,
    sourceId: input.sourceId,
    targetId: input.targetId
  };
  if (isReverseFlowchartConnector(input.connector)) {
    link.sourceId = input.targetId;
    link.targetId = input.sourceId;
  }
  if (input.customId !== undefined) {
    return { ...link, customId: input.customId };
  }
  return link;
}

function isReverseFlowchartConnector(connector: string): boolean {
  return connector.startsWith("<") && !connector.endsWith(">");
}

function readFlowchartEndpointIds(group: string): string[] {
  return group.split("&").map((endpoint) => endpoint.match(FLOWCHART_LINE_START_ID_PATTERN)![1]!);
}

function readFlowchartMatchLabel(match: RegExpMatchArray): string | null {
  const capture = match.slice(4, 7).find(Boolean);
  const label = capture ? stripFlowchartTransitionQuotes(capture.trim()) : "";
  return label.length > 0 ? label : null;
}

function readFlowchartRenderId(input: FlowchartLinkDraft, renderIndex: number, usedRenderIds: Set<string>): string {
  const customId = input.customId;
  const renderId = customId !== undefined && !usedRenderIds.has(customId)
    ? customId
    : createFlowchartRenderId(input, renderIndex);
  usedRenderIds.add(renderId);
  return renderId;
}

function readAndIncrementFlowchartPairCount(occurrences: Map<string, number>, input: FlowchartLinkDraft): number {
  const pairKey = `${input.sourceId}\u0000${input.targetId}`;
  const occurrence = occurrences.get(pairKey) ?? 0;
  occurrences.set(pairKey, occurrence + 1);
  return occurrence === 0 ? 0 : occurrence + 1;
}

function createFlowchartRenderId(input: FlowchartLinkDraft, renderIndex: number): string {
  return `L_${input.sourceId}_${input.targetId}_${renderIndex}`;
}

function stripFlowchartTransitionQuotes(label: string): string {
  return label.replace(/^(['"])(.*)\1$/u, "$2").trim();
}

function createFlowchartTransition(
  creation: FlowchartTransitionCreationInput
): DiagramElement {
  const { input } = creation;

  return {
    id: makeUniqueFlowchartTransitionId(input, creation.usedIds, creation.reservedIds),
    kind: "transition",
    label: createFlowchartTransitionDisplayLabel(input, creation.nodeIndex),
    renderId: creation.renderId,
    renderOrder: creation.renderOrder,
    renderSourceId: input.sourceId,
    renderTargetId: input.targetId
  };
}

function makeUniqueFlowchartTransitionId(input: FlowchartLinkDraft, usedIds: Set<string>, reservedIds: Set<string>): string {
  const baseId = input.label === null
    ? `transition-${input.sourceId}-to-${input.targetId}-unlabeled`
    : createFlowchartTransitionBaseId(input.label, input.sourceId, input.targetId);
  let candidate = baseId;
  let suffix = 2;
  while (!isAvailableFlowchartTransitionId({ candidate, input, reservedIds, usedIds })) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function isAvailableFlowchartTransitionId(input: {
  candidate: string;
  input: FlowchartLinkDraft;
  reservedIds: Set<string>;
  usedIds: Set<string>;
}): boolean {
  return !input.usedIds.has(input.candidate) && !(input.input.label === null && input.reservedIds.has(input.candidate));
}

function createFlowchartTransitionBaseId(label: string, sourceId: string, targetId: string): string {
  const words = label.replace(FLOWCHART_TRANSITION_CAMEL_BOUNDARY_PATTERN, "$1 $2").match(
    FLOWCHART_TRANSITION_WORD_PATTERN
  ) ?? [];
  const labelKey = words.length > 0 ? words.join("-").toLowerCase() : "branch";

  return `transition-${sourceId}-to-${targetId}-${labelKey}`;
}

function createFlowchartTransitionDisplayLabel(
  input: FlowchartLinkDraft,
  nodeIndex: Map<string, DiagramElement>
): string {
  const endpoints = `${readFlowchartEndpointLabel(nodeIndex, input.sourceId)} → ${readFlowchartEndpointLabel(nodeIndex, input.targetId)}`;
  return input.label === null ? endpoints : `${endpoints}: ${input.label}`;
}

function readFlowchartEndpointLabel(nodeIndex: Map<string, DiagramElement>, nodeId: string): string {
  return nodeIndex.get(nodeId)!.label;
}

function readFlowchartLineElements(line: string): FlowchartElementDraft[] {
  return splitFlowchartStatements(line).flatMap(readFlowchartStatementElements)
    .sort((left, right) => left.index - right.index);
}

function readFlowchartStatementElements(line: string): FlowchartElementDraft[] {
  if (isIgnoredFlowchartLine(line)) {
    return [];
  }
  return [
    ...readShapedNodeElements(line),
    ...readMetadataNodeElements(line),
    ...readBareEndpointElements(line)
  ];
}

function readShapedNodeElements(line: string): FlowchartElementDraft[] {
  const quotedLine = protectFlowchartQuotedText(line);
  const protectedLine = protectFlowchartPlainLinkLabels(quotedLine.line, quotedLine.labels);
  return [...protectedLine.line.matchAll(FLOWCHART_SHAPED_NODE_PATTERN)].map((match) => ({
    explicit: true,
    id: match[1],
    index: readMatchStartIndex(match),
    label: restoreFlowchartQuotedText(readShapedNodeLabel(match), protectedLine.labels).trim()
  }));
}

function protectFlowchartQuotedText(line: string): { labels: string[]; line: string } {
  const labels: string[] = [];
  const protectedLine = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/gu, (label) => {
    const index = labels.push(label) - 1;
    return createFlowchartTextToken(index, label.length);
  });

  return { labels, line: protectedLine };
}

function protectFlowchartPlainLinkLabels(line: string, labels: string[]): { labels: string[]; line: string } {
  const protectedLine = [...line.matchAll(FLOWCHART_INLINE_LABEL_PATTERN)].reverse().reduce((masked, match) => {
    const indexInLine = Number(match.index);
    const label = match[2]!;
    if (label.startsWith("\uE000")) {
      return masked;
    }
    const index = labels.push(label) - 1;
    return `${masked.slice(0, indexInLine)}${match[3]}|${createFlowchartTextToken(index, label.length)}|${masked.slice(
      indexInLine + match[0].length
    )}`;
  }, line);

  return { labels, line: protectedLine };
}

function restoreFlowchartQuotedText(line: string, labels: string[]): string {
  return labels.reduceRight(
    (restored, label, index) => restored.replace(createFlowchartTextToken(index, label.length), label),
    line
  );
}

function createFlowchartTextToken(index: number, length: number): string {
  return `${String.fromCharCode(0xe000 + index)}${" ".repeat(length - 1)}`;
}

function readMetadataNodeElements(line: string): FlowchartElementDraft[] {
  return [...line.matchAll(FLOWCHART_METADATA_NODE_PATTERN)].flatMap((match) =>
    readMetadataNodeElement(match)
  );
}

function readMetadataNodeElement(match: RegExpMatchArray): FlowchartElementDraft[] {
  const label = readMetadataLabel(match[2]);

  return label === null
    ? []
    : [
        {
          explicit: true,
          id: match[1],
          index: readMatchStartIndex(match),
          label
        }
      ];
}

function readBareEndpointElements(line: string): FlowchartElementDraft[] {
  return readFlowchartLineLinks(line).flatMap(({ sourceId, targetId }) => [
    createBareEndpoint(sourceId, line.indexOf(sourceId)),
    createBareEndpoint(targetId, line.lastIndexOf(targetId))
  ]);
}

function createBareEndpoint(id: string, index: number): FlowchartElementDraft {
  return {
    explicit: false,
    id,
    index,
    label: id
  };
}

function registerFlowchartElement(
  elements: Map<string, DiagramElement>,
  draft: FlowchartElementDraft
): void {
  const existing = elements.get(draft.id);

  elements.set(draft.id, {
    id: draft.id,
    kind: "node",
    label: readElementLabel(existing, draft)
  });
}

function readElementLabel(
  existing: DiagramElement | undefined,
  draft: FlowchartElementDraft
): string {
  return draft.explicit || existing === undefined ? draft.label.trim() : existing.label;
}

function readShapedNodeLabel(match: RegExpMatchArray): string {
  return readFirstDefinedCapture(match.slice(3));
}

function readMetadataLabel(metadata: string): string | null {
  const match = metadata.match(FLOWCHART_METADATA_LABEL_PATTERN);

  return match === null ? null : readOptionalLabel(match.slice(1));
}

function readOptionalLabel(captures: string[]): string | null {
  const label = readFirstDefinedCapture(captures).trim();

  return label.length === 0 ? null : label;
}

function readFirstDefinedCapture(captures: string[]): string {
  return (captures as Array<string | undefined>).find((value) => value !== undefined)!;
}

function readMatchStartIndex(match: RegExpMatchArray): number {
  return Number(match.index);
}
