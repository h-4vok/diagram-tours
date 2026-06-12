import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const SANKEY_ROW_PATTERN =
  /^\s*(?:"((?:[^"]|"")*)"|([^,"]*))\s*,\s*(?:"((?:[^"]|"")*)"|([^,"]*))\s*,\s*(?:"((?:[^"]|"")*)"|([^,"]*))\s*$/u;

type SankeyElementDraft = {
  label: string;
};

export function createSankeyDiagramModel(source: string): DiagramModel {
  return {
    elements: extractSankeyElements(source),
    renderSource: source,
    type: "sankey"
  };
}

function extractSankeyElements(source: string): DiagramElement[] {
  const elements: DiagramElement[] = [];
  const seen = new Set<string>();

  for (const line of source.split("\n").slice(1)) {
    readSankeyLineElements(line).forEach((draft) => {
      registerSankeyElement(elements, seen, draft);
    });
  }

  return elements;
}

function readSankeyLineElements(line: string): SankeyElementDraft[] {
  if (shouldIgnoreSankeyLine(line)) {
    return [];
  }

  const cells = parseSankeyCsvLine(line);

  return cells === null ? [] : createSankeyLineElements(cells);
}

function shouldIgnoreSankeyLine(line: string): boolean {
  const trimmed = line.trim();

  return trimmed.length === 0 || trimmed.startsWith("%%");
}

function createSankeyLineElements(cells: string[]): SankeyElementDraft[] {
  if (!hasValidSankeyCells(cells)) {
    return [];
  }

  return [createSankeyElementDraft(cells[0]!), createSankeyElementDraft(cells[1]!)];
}

function hasValidSankeyCells(cells: string[]): boolean {
  return hasSankeyNodePair(cells) && hasSankeyValue(cells[2]);
}

function parseSankeyCsvLine(line: string): string[] | null {
  const match = line.match(SANKEY_ROW_PATTERN);

  return match === null ? null : [readSankeyCell(match, 1, 2), readSankeyCell(match, 3, 4), readSankeyCell(match, 5, 6)];
}

function createSankeyElementDraft(label: string): SankeyElementDraft {
  return { label };
}

function hasSankeyNodeLabel(value: string | undefined): boolean {
  return value !== undefined && value.length > 0;
}

function hasSankeyValue(value: string | undefined): boolean {
  return value !== undefined && Number.isFinite(Number(value));
}

function hasSankeyNodePair(cells: string[]): boolean {
  return hasSankeyNodeLabel(cells[0]) && hasSankeyNodeLabel(cells[1]);
}

function readSankeyCell(match: RegExpMatchArray, quotedIndex: number, bareIndex: number): string {
  const quoted = match.at(quotedIndex);

  if (quoted !== undefined) {
    return quoted.replaceAll('""', '"').trim();
  }

  return match.at(bareIndex)!.trim();
}

function registerSankeyElement(
  elements: DiagramElement[],
  seen: Set<string>,
  draft: SankeyElementDraft
): void {
  if (seen.has(draft.label)) {
    return;
  }

  seen.add(draft.label);
  elements.push({
    id: draft.label,
    kind: "node",
    label: draft.label
  });
}
