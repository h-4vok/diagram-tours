import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";
import type { TourContext } from "./tour-context.js";

type Block = { key: string };
type ElementState = { counts: Map<string, number>; elements: DiagramElement[] };
type ParserState = ElementState & { actorIds: Map<string, string>; blocks: Block[] };

const ACTOR_PATTERN = /^([A-Za-z][\w]*)\s+as\s+([^{}]+)$/u;
const ANNOTATED_ACTOR_PATTERN = /^@(?:Actor|Database|Boundary|Control|Entity|Queue|Collections)\s+([A-Za-z][\w]*)$/u;
const ARROW_PATTERN = /^([A-Za-z][\w]*)\s*->\s*([A-Za-z][\w]*)(?:\s*:\s*(.*))?$/u;
const CALL_PATTERN = /^(?:[\w<>]+\s+)?(?:[\w]+\s*=\s*)?([A-Za-z][\w]*)\.([A-Za-z][\w]*)(\([^{}]*\))?\s*(\{)?$/u;
const CONTROL_PATTERN = /^(if|while|forEach|foreach|for|loop|opt|par|try|catch|finally|else(?:\s+if)?)\b(.*?)\s*\{\s*$/u;
const BARE_ACTOR_PATTERN = /^[A-Za-z][\w]*$/u;

export function createZenUmlDiagramModel(source: string, _context: TourContext): DiagramModel {
  const state: ParserState = {
    actorIds: new Map<string, string>(),
    blocks: [],
    counts: new Map<string, number>(),
    elements: []
  };

  source.split("\n").forEach((line) => readLine(line, state));
  return { elements: state.elements, renderSource: source, type: "zenuml" };
}

function readLine(line: string, state: ParserState): void {
  const source = readBlockRemainder(line.trim(), state.blocks);

  if (source === null || isContextLine(source)) {
    return;
  }
  readNonContextLine(source, state);
}

function readNonContextLine(source: string, state: ParserState): void {
  const control = source.match(CONTROL_PATTERN);

  if (control !== null) {
    openControlBlock(control, state);
    return;
  }
  if (readActorDeclaration(source, state)) {
    return;
  }
  readInteraction(source, state);
}

function readBlockRemainder(source: string, blocks: Block[]): string | null {
  if (!source.startsWith("}")) {
    return source;
  }
  closeBlock(blocks, source);
  return source.replace(/^\}\s*/u, "").trim() || null;
}

function isContextLine(source: string): boolean {
  return source.length === 0 || source === "zenuml" || isContextMetadata(source);
}

function isContextMetadata(source: string): boolean {
  return source.startsWith("//") || /^title\b/u.test(source);
}

function closeBlock(blocks: Block[], source: string): void {
  if (!/^\}\s*(?:else|catch|finally)\b/u.test(source)) {
    blocks.pop();
  }
}

function openControlBlock(match: RegExpMatchArray, state: ParserState): void {
  const type = match[1]!;
  const detail = match[2]!.trim().replace(/^\((.*)\)$/u, "$1").trim();
  const label = readControlLabel(type, detail);
  const segment = `${slug(type)}-${slug(detail || "anonymous")}`;
  const baseId = `block-${[...readParentPath(state.blocks), segment].join("-")}`;

  addFocusGroup({ type, baseId, label, state });
  if (isAlternative(type)) {
    openAlternativeBlock(type, segment, state.blocks);
    return;
  }
  state.blocks.push({ key: segment });
}

function addFocusGroup(input: { type: string; baseId: string; label: string; state: ParserState }): void {
  if (isFocusGroup(input.type)) {
    addElement({ baseId: input.baseId, kind: "group", label: input.label, state: input.state });
  }
}

function openAlternativeBlock(type: string, segment: string, blocks: Block[]): void {
  if (type === "else if") {
    replaceCurrentBlock(blocks, segment);
  }
}

function isAlternative(type: string): boolean {
  return /^(else|else\s+if|catch|finally)$/u.test(type);
}

function replaceCurrentBlock(blocks: Block[], key: string): void {
  const current = blocks.at(-1);

  if (current !== undefined) {
    current.key = key;
  }
}

function readControlLabel(type: string, detail: string): string {
  return detail.length === 0 ? `${capitalize(type)} block` : `${capitalize(type)}: ${detail}`;
}

function isFocusGroup(type: string): boolean {
  return /^(if|else\s+if|while|forEach|foreach|for|loop)$/u.test(type);
}

function readActorDeclaration(source: string, state: ParserState): boolean {
  const actor = readActorIdentity(source);

  if (actor === null) {
    return false;
  }
  addActor(actor.id, actor.label, state);
  return true;
}

function readActorIdentity(source: string): { id: string; label: string } | null {
  const alias = source.match(ACTOR_PATTERN);

  if (alias !== null) {
    return { id: alias[1]!, label: alias[2]!.trim() };
  }
  return readSimpleActorIdentity(source);
}

function readSimpleActorIdentity(source: string): { id: string; label: string } | null {
  const actor = readAnnotatedActor(source) ?? readBareActor(source);
  return actor === null ? null : { id: actor, label: actor };
}

function readAnnotatedActor(source: string): string | null {
  const match = source.match(ANNOTATED_ACTOR_PATTERN);
  return match === null ? null : match[1]!;
}

function readBareActor(source: string): string | null {
  if (!BARE_ACTOR_PATTERN.test(source)) {
    return null;
  }
  return source === "return" ? null : source;
}

function addActor(actorId: string, label: string, state: ParserState): void {
  if (state.actorIds.has(actorId)) {
    return;
  }
  const actor = addElement({ baseId: `actor-${slug(actorId)}`, kind: "participant", label, state });
  state.actorIds.set(actorId, actor.id);
}

function readInteraction(source: string, state: ParserState): void {
  if (readArrowInteraction(source, state) || readCallInteraction(source, state)) {
    return;
  }
  readStandaloneInteraction(source, state);
}

function readArrowInteraction(source: string, state: ParserState): boolean {
  const arrow = source.match(ARROW_PATTERN);

  if (arrow === null) {
    return false;
  }
  const details = readArrowDetails(arrow);
  addActor(arrow[1]!, arrow[1]!, state);
  addActor(arrow[2]!, arrow[2]!, state);
  addElement({ baseId: interactionKey(state.blocks, details.identity), kind: "message", label: details.label, state });
  return true;
}

function readArrowDetails(arrow: RegExpMatchArray): { identity: string; label: string } {
  const sourceLabel = (arrow[3] || "").trim();
  return { identity: readArrowIdentity(arrow, sourceLabel), label: readArrowLabel(arrow, sourceLabel) };
}

function readArrowIdentity(arrow: RegExpMatchArray, sourceLabel: string): string {
  return sourceLabel.length === 0 ? `${arrow[1]}-${arrow[2]}-message` : `${arrow[1]}-${arrow[2]}-${sourceLabel}`;
}

function readArrowLabel(arrow: RegExpMatchArray, sourceLabel: string): string {
  return sourceLabel.length === 0 ? `${arrow[1]} to ${arrow[2]}` : sourceLabel;
}

function readCallInteraction(source: string, state: ParserState): boolean {
  const call = source.match(CALL_PATTERN);

  if (call === null) {
    return false;
  }
  addCallInteraction(call, state);
  return true;
}

function addCallInteraction(call: RegExpMatchArray, state: ParserState): void {
  const label = `${call[2]}${call[3] || ""}`;
  const sourceIdentity = `${call[1]}.${label}`;
  addActor(call[1]!, call[1]!, state);
  addElement({
    baseId: interactionKey(state.blocks, sourceIdentity),
    kind: "message",
    label,
    state
  });
  if (call[4]) {
    state.blocks.push({ key: slug(sourceIdentity) });
  }
}

function readStandaloneInteraction(source: string, state: ParserState): void {
  const interaction = readStandaloneStatement(source);

  if (interaction === null) {
    return;
  }
  if (interaction.actor !== null) {
    addActor(interaction.actor, interaction.actor, state);
  }
  addElement({
    baseId: interactionKey(state.blocks, interaction.identity),
    kind: "message",
    label: interaction.label,
    state
  });
}

function readStandaloneStatement(source: string): { actor: string | null; identity: string; label: string } | null {
  const match = source.match(/^(?:return(?:\s+(.+))?|new\s+([A-Za-z][\w]*))$/u);

  if (match === null) {
    return null;
  }
  const identity = source.replace(/\s+/gu, " ");
  return { actor: match[2] || null, identity, label: readStandaloneLabel(match, identity) };
}

function readStandaloneLabel(match: RegExpMatchArray, identity: string): string {
  return match[2] || match[1] || identity;
}

function interactionKey(blocks: Block[], sourceIdentity: string): string {
  return `interaction-${[...readParentPath(blocks), slug(sourceIdentity)].join("-")}`;
}

function readParentPath(blocks: Block[]): string[] {
  return blocks.map((block) => block.key);
}

function addElement(input: {
  baseId: string;
  kind: DiagramElement["kind"];
  label: string;
  state: ElementState;
}): DiagramElement {
  const count = (input.state.counts.get(input.baseId) ?? 0) + 1;
  const id = count === 1 ? input.baseId : `${input.baseId}-${count}`;
  const element = { id, kind: input.kind, label: input.label };

  input.state.counts.set(input.baseId, count);
  input.state.elements.push(element);
  return element;
}

function slug(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1);
}
