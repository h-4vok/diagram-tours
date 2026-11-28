import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const DECLARATION_PATTERN = /^\s*(group|service)\s+([\w-]+)(?:\s*\(([\w:-]+)\))?(?:\s*\[(?:"([^"]*)"|'([^']*)'|([\w ]+))\])?(?:\s+in\s+([\w-]+))?\s*$/u;
const JUNCTION_PATTERN = /^\s*junction\s+([\w-]+)(?:\s+in\s+([\w-]+))?\s*$/u;
const CONNECTION_PATTERN = /^\s*([\w-]+)\s*(\{group\})?\s*:\s*([LTRB])\s*(<)?--(>)?\s*([LTRB])\s*:\s*([\w-]+)\s*(\{group\})?\s*$/u;

type ConnectionMatch = RegExpExecArray & { 1: string; 3: string; 6: string; 7: string };
export const ARCHITECTURE_CONNECTION_IDENTITY_MESSAGE = "Mermaid architecture connection IDs collide with a service, group, junction, or another connection in pinned Mermaid 11.13.0; route parallel connections through a junction and keep endpoint and junction IDs unique.";

export function createArchitectureDiagramModel(source: string): DiagramModel {
  const elements: DiagramElement[] = [];
  const state = { connectionOrder: 0, elements };
  source.split(/\r?\n/u).forEach((line) => readArchitectureLine(stripArchitectureComment(line), state));
  return { elements, renderSource: source, type: "architecture" };
}

export function hasArchitectureConnectionIdentityCollision(elements: DiagramElement[]): boolean {
  const usedIds = new Set(elements.filter(({ kind }) => kind === "node" || kind === "group" || kind === "junction")
    .map(({ id }) => id.slice(id.indexOf("-") + 1)));
  const edgeIds = new Set<string>();
  return elements.filter(({ kind }) => kind === "transition").some((connection) => {
    const edgeIdentity = `${connection.renderSourceId}-${connection.renderTargetId}`;
    if (usedIds.has(edgeIdentity) || edgeIds.has(edgeIdentity)) { return true; }
    edgeIds.add(edgeIdentity);
    return false;
  });
}

function readArchitectureLine(line: string, state: { connectionOrder: number; elements: DiagramElement[] }): void {
  const declaration = DECLARATION_PATTERN.exec(line);
  if (declaration !== null) {
    state.elements.push(readDeclaration(declaration));
    return;
  }
  const junction = JUNCTION_PATTERN.exec(line);
  if (junction !== null) {
    state.elements.push({ id: `junction-${junction[1]}`, kind: "junction", label: junction[1]! });
    return;
  }
  registerConnection(line, state);
}

function stripArchitectureComment(line: string): string {
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const result = readArchitectureCharacter(line, index, quote);
    if (result.comment) { return line.slice(0, index); }
    quote = result.quote;
    index += result.skip;
  }
  return line;
}

function readArchitectureCharacter(line: string, index: number, quote: string): { comment: boolean; quote: string; skip: number } {
  const character = line[index]!;
  if (isEscapedArchitectureCharacter(character, quote)) { return { comment: false, quote, skip: 1 }; }
  if (isArchitectureComment(line, index, quote)) { return { comment: true, quote, skip: 0 }; }
  return { comment: false, quote: readArchitectureQuote(character, quote), skip: 0 };
}

function isEscapedArchitectureCharacter(character: string, quote: string): boolean {
  return character === "\\" && quote !== "";
}

function isArchitectureComment(line: string, index: number, quote: string): boolean {
  return quote === "" && line.slice(index, index + 2) === "%%";
}

function readArchitectureQuote(character: string, quote: string): string {
  return quote === "" ? readStartingArchitectureQuote(character) : closeArchitectureQuote(character, quote);
}

function readStartingArchitectureQuote(character: string): string {
  return character === "\"" ? "\"" : character === "'" ? "'" : "";
}

function closeArchitectureQuote(character: string, quote: string): string {
  return character === quote ? "" : quote;
}

function registerConnection(line: string, state: { connectionOrder: number; elements: DiagramElement[] }): void {
  const connection = CONNECTION_PATTERN.exec(line) as ConnectionMatch | null;
  if (connection === null) { return; }
  state.connectionOrder += 1;
  state.elements.push(readConnection(connection, state.connectionOrder));
}

function readDeclaration(match: RegExpExecArray): DiagramElement {
  const kind = match[1] === "group" ? "group" : "node";
  return {
    id: `${match[1]}-${match[2]}`,
    kind,
    label: readDeclarationLabel(match)
  };
}

function readDeclarationLabel(match: RegExpExecArray): string {
  return [match[4], match[5], match[6]].find((label) => Boolean(label)) ?? match[2]!;
}

function readConnection(match: ConnectionMatch, order: number): DiagramElement {
  const renderId = `L_${match[1]}_${match[7]}_0`;
  return {
    id: `connection-${order}`,
    kind: "transition",
    label: `${match[1]}:${match[3]} → ${match[7]}:${match[6]}`,
    renderId,
    renderOrder: order,
    renderSourceId: match[1],
    renderTargetId: match[7],
    renderSourcePort: match[3] as "T" | "B" | "L" | "R",
    renderTargetPort: match[6] as "T" | "B" | "L" | "R",
    renderSourceArrow: Boolean(match[4]),
    renderTargetArrow: Boolean(match[5]),
    renderSourceGroup: Boolean(match[2]),
    renderTargetGroup: Boolean(match[8])
  };
}
