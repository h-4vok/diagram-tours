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
const FLOWCHART_CONNECTOR_SOURCE = String.raw`(?:[ox]?[-=.]{2,}[ox>]?|<[-=.]{2,}[ox]?)`;
const FLOWCHART_LINE_START_ID_PATTERN = new RegExp(`^\\s*(${FLOWCHART_ID_SOURCE})\\b`, "u");
const FLOWCHART_LINK_TARGET_PATTERN = new RegExp(
  `${FLOWCHART_CONNECTOR_SOURCE}(?:\\|[^|]*\\||\\s+[^-=.<>|]+\\s+${FLOWCHART_CONNECTOR_SOURCE})?\\s*(${FLOWCHART_ID_SOURCE})\\b`,
  "gu"
);
const FLOWCHART_LINK_MARKER_PATTERN = new RegExp(FLOWCHART_CONNECTOR_SOURCE, "u");

type FlowchartElementDraft = {
  explicit: boolean;
  id: string;
  index: number;
  label: string;
};

export function createFlowchartDiagramModel(source: string): DiagramModel {
  return {
    elements: extractFlowchartElements(source),
    renderSource: source,
    type: "flowchart"
  };
}

function extractFlowchartElements(source: string): DiagramElement[] {
  const elements = new Map<string, DiagramElement>();

  for (const line of source.split("\n")) {
    readFlowchartLineElements(line).forEach((element) => registerFlowchartElement(elements, element));
  }

  return Array.from(elements.values());
}

function readFlowchartLineElements(line: string): FlowchartElementDraft[] {
  if (FLOWCHART_IGNORED_LINE_PATTERN.test(line)) {
    return [];
  }

  return [
    ...readShapedNodeElements(line),
    ...readMetadataNodeElements(line),
    ...readBareEndpointElements(line)
  ].sort((left, right) => left.index - right.index);
}

function readShapedNodeElements(line: string): FlowchartElementDraft[] {
  return [...line.matchAll(FLOWCHART_SHAPED_NODE_PATTERN)].map((match) => ({
    explicit: true,
    id: match[1],
    index: readMatchStartIndex(match),
    label: readShapedNodeLabel(match)
  }));
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
  if (!FLOWCHART_LINK_MARKER_PATTERN.test(line)) {
    return [];
  }

  return [readLineStartEndpoint(line), ...readLineTargetEndpoints(line)].filter(
    (element): element is FlowchartElementDraft => element !== null
  );
}

function readLineStartEndpoint(line: string): FlowchartElementDraft | null {
  const match = line.match(FLOWCHART_LINE_START_ID_PATTERN);

  return match === null ? null : createBareEndpoint(match[1], line.indexOf(match[1]));
}

function readLineTargetEndpoints(line: string): FlowchartElementDraft[] {
  return [...line.matchAll(FLOWCHART_LINK_TARGET_PATTERN)].map((match) =>
    createBareEndpoint(match[1], readMatchIdIndex(match))
  );
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
  return readFirstDefinedCapture(match.slice(3)).trim();
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

function readMatchIdIndex(match: RegExpMatchArray): number {
  return readMatchStartIndex(match) + match[0].lastIndexOf(match[1]);
}
