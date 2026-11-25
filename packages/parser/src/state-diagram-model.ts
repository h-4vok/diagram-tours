import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const STATE_DECLARATION_PATTERN =
  /^\s*state\s+(?:"([^"]+)"\s+as\s+([A-Za-z0-9_][\w.]*)|([A-Za-z0-9_][\w.]*))(?:\s+(?:<<(choice|fork|join)>>|\[\[(choice|fork|join)\]\]))?\s*(\{)?\s*$/u;
const STATE_LABEL_PATTERN = /^\s*([A-Za-z0-9_][\w.]*)\s*:\s*(.+?)\s*$/u;
const STANDALONE_STATE_PATTERN = /^\s*([A-Za-z0-9_][\w.]*)\s*$/u;
const STATE_TRANSITION_PATTERN =
  /^\s*(\[\*\]|[A-Za-z0-9_][\w.]*)(?:\s*:::[A-Za-z][\w-]*)?\s*-->\s*(\[\*\]|[A-Za-z0-9_][\w.]*)(?:\s*:::[A-Za-z][\w-]*)?(?:\s*:\s*(.*)|\s+%%.*)?\s*$/u;
const STATE_NOTE_PATTERN = /^\s*note\b/iu;
const ACCESSIBILITY_BLOCK_PATTERN = /^\s*accDescr\s*\{/iu;
const FRONTMATTER_PATTERN = /^\s*---\s*$/u;
const STATE_METADATA_NAMES = new Set(["acctitle", "accdescr", "title"]);
const CAMEL_BOUNDARY_PATTERN = /([a-z0-9])([A-Z])/gu;
const WORD_SEPARATOR_PATTERN = /[^A-Za-z0-9]+/gu;

type StateDraft = {
  alias: string;
  label: string;
  labelPriority: number;
  path: string[];
};

type StateReadContext = {
  elements: Map<string, DiagramElement>;
  ignoredBlock: "accessibility" | "frontmatter" | "note" | null;
  line: string;
  pendingTransitions: Map<string, PendingStateTransition>;
  stateLabelPriorities: Map<string, number>;
  scope: string[];
  stateIds: Map<string, string>;
  selfTransitionIds: Map<string, string>;
  transitionIndex: number;
  usedStateIds: Set<string>;
  usedTransitionIds: Set<string>;
};

type PendingStateTransition = Pick<DiagramElement, "id" | "renderOrder" | "renderSourceId" | "renderTargetId"> & {
  label?: string;
};

export function createStateDiagramModel(source: string): DiagramModel {
  return {
    elements: extractStateDiagramElements(source),
    renderSource: source,
    type: "stateDiagram"
  };
}

function extractStateDiagramElements(source: string): DiagramElement[] {
  const context = createStateReadContext();

  source.split("\n").forEach((line) => {
    context.line = line;
    readStateLine(context);
  });

  finalizeTransitionLabels(context.elements, context.pendingTransitions);

  return Array.from(context.elements.values());
}

function createStateReadContext(): StateReadContext {
  return {
    elements: new Map(),
    ignoredBlock: null,
    line: "",
    pendingTransitions: new Map(),
    stateLabelPriorities: new Map(),
    scope: [],
    stateIds: new Map(),
    selfTransitionIds: new Map(),
    transitionIndex: 0,
    usedStateIds: new Set(),
    usedTransitionIds: new Set()
  };
}

function readStateLine(input: StateReadContext): void {
  if (shouldSkipStateLine(input)) {return;}
  if (!registerStateTransitionLine(input)) {registerStateDeclaration(input);}
}

function shouldSkipStateLine(input: StateReadContext): boolean {
  return skipIgnoredBlockLine(input) || startIgnoredBlock(input) || closeStateScope(input);
}

function closeStateScope(input: StateReadContext): boolean {
  if (!isScopeClose(input.line)) {return false;}
  input.scope.pop();
  return true;
}

function skipIgnoredBlockLine(input: StateReadContext): boolean {
  if (input.ignoredBlock === null) {return false;}
  if (isIgnoredBlockEnd(input.line, input.ignoredBlock)) {input.ignoredBlock = null;}

  return true;
}

function startIgnoredBlock(input: StateReadContext): boolean {
  return startFrontmatterBlock(input) || startAccessibilityBlock(input) || startNoteBlock(input);
}

function startFrontmatterBlock(input: StateReadContext): boolean {
  if (FRONTMATTER_PATTERN.test(input.line)) {
    input.ignoredBlock = "frontmatter";
    return true;
  }
  return false;
}

function startAccessibilityBlock(input: StateReadContext): boolean {
  if (ACCESSIBILITY_BLOCK_PATTERN.test(input.line)) {
    input.ignoredBlock = /\}\s*$/u.test(input.line) ? null : "accessibility";
    return true;
  }
  return false;
}

function startNoteBlock(input: StateReadContext): boolean {
  if (!STATE_NOTE_PATTERN.test(input.line)) {return false;}
  input.transitionIndex += 1;
  input.ignoredBlock = input.line.includes(":") ? null : "note";

  return true;
}

function isIgnoredBlockEnd(line: string, block: StateReadContext["ignoredBlock"]): boolean {
  return block === "frontmatter"
    ? FRONTMATTER_PATTERN.test(line)
    : block === "note"
      ? /^\s*end\s+note\s*$/iu.test(line)
      : /^\s*\}\s*$/u.test(line);
}

function registerStateDeclaration(input: StateReadContext): boolean {
  const match = input.line.match(STATE_DECLARATION_PATTERN);
  return match === null ? registerUnprefixedState(input) : registerStateMatch(input, match);
}

function registerUnprefixedState(input: StateReadContext): boolean {
  const labelMatch = input.line.match(STATE_LABEL_PATTERN);
  if (labelMatch !== null) {return registerStateLabel(input, labelMatch);}

  const standalone = input.line.match(STANDALONE_STATE_PATTERN);
  return standalone === null ? false : registerStandaloneState(input, standalone[1]!);
}

function registerStateLabel(input: StateReadContext, match: RegExpMatchArray): boolean {
  if (STATE_METADATA_NAMES.has(match[1]!.toLowerCase())) {return false;}
  registerStateElement(input, { alias: match[1]!, label: match[2]!, labelPriority: 1, path: [...input.scope] });
  return true;
}

function registerStandaloneState(input: StateReadContext, alias: string): boolean {
  registerStateElement(input, { alias, label: alias, labelPriority: 0, path: [...input.scope] });
  return true;
}

function registerStateMatch(input: StateReadContext, match: RegExpMatchArray): boolean {
  const identity = readStateDraftIdentity(match);
  const draft = { ...identity, path: [...input.scope] };

  if (isRenderedStateDeclaration(match)) {registerStateElement(input, draft);}

  if (match[6] === "{") {
    input.scope.push(draft.alias);
  }
  return true;
}

function isRenderedStateDeclaration(match: RegExpMatchArray): boolean {
  return [match[1], match[4], match[5]].some(Boolean) || match[6] === "{";
}

function readStateDraftIdentity(match: RegExpMatchArray): { alias: string; label: string; labelPriority: number } {
  const alias = match[2] || match[3]!;

  return { alias, label: readStateDisplayLabel(match, alias), labelPriority: readStateLabelPriority(match) };
}

function readStateDisplayLabel(match: RegExpMatchArray, alias: string): string {
  return match[1] || alias;
}

function readStateLabelPriority(match: RegExpMatchArray): number {
  return match[1] ? 2 : 0;
}

function registerStateTransitionLine(input: StateReadContext): boolean {
  const match = input.line.match(STATE_TRANSITION_PATTERN);

  if (match === null) {return false;}
  registerStateTransition(input, match);

  return true;
}

function registerStateTransition(input: StateReadContext, match: RegExpMatchArray): void {
  const source = readTransitionState(input, match[1]!, "Start");
  const target = readTransitionState(input, match[2]!, "End");
  const label = readTransitionLabel(source, target, match[3]);
  const baseId = createTransitionId(source.id, target.id, match[3]);
  const id = createUniqueId(baseId, input.usedTransitionIds);

  registerRenderedSelfTransition(input, { sourceId: source.id, targetId: target.id, transitionId: id });

  const renderOrder = input.transitionIndex;
  input.transitionIndex += 1;
  input.elements.set(id, {
    id,
    kind: "transition",
    label,
    renderOrder,
    renderSourceId: source.id,
    renderTargetId: target.id
  });
  input.pendingTransitions.set(id, { id, label: match[3], renderOrder, renderSourceId: source.id, renderTargetId: target.id });
}

function registerRenderedSelfTransition(
  input: StateReadContext,
  transition: { sourceId: string; targetId: string; transitionId: string }
): void {
  if (transition.sourceId !== transition.targetId) {return;}
  const previousId = input.selfTransitionIds.get(transition.sourceId);
  if (previousId !== undefined) {
    input.elements.delete(previousId);
    input.pendingTransitions.delete(previousId);
  }
  input.selfTransitionIds.set(transition.sourceId, transition.transitionId);
}

function finalizeTransitionLabels(
  elements: Map<string, DiagramElement>,
  transitions: Map<string, PendingStateTransition>
): void {
  transitions.forEach((transition) => {
    const existing = elements.get(transition.id)!;
    const source = readResolvedTransitionState(elements, transition.renderSourceId!);
    const target = readResolvedTransitionState(elements, transition.renderTargetId!);

    elements.set(transition.id, { ...existing, label: readTransitionLabel(source, target, transition.label) });
  });
}

function readResolvedTransitionState(elements: Map<string, DiagramElement>, id: string): DiagramElement {
  const state = elements.get(id);
  if (state !== undefined) {return state;}

  return { id, kind: "state", label: id === "start-marker" ? "Start" : "End" };
}

function readTransitionState(
  input: StateReadContext,
  alias: string,
  markerLabel: "End" | "Start"
): DiagramElement {
  if (alias === "[*]") {
    return { id: `${markerLabel.toLowerCase()}-marker`, kind: "state", label: markerLabel };
  }

  return registerStateElement(input, { alias, label: alias, labelPriority: 0, path: [...input.scope] });
}

function registerStateElement(input: StateReadContext, draft: StateDraft): DiagramElement {
  const id = readOrCreateStateId(input, draft);
  const label = readStateLabel(input, id, draft);
  const renderId = readStateRenderId(input, id, draft);
  const element = { id, kind: "state" as const, label, renderId };

  recordStateLabelPriority(input, id, draft.labelPriority);
  input.elements.set(id, element);

  return element;
}

function readOrCreateStateId(input: StateReadContext, draft: StateDraft): string {
  const existingId = input.stateIds.get(draft.alias);

  return existingId ?? createUniqueStateId(input, createStateId(draft.path, draft.alias), draft.alias);
}

function readStateRenderId(input: StateReadContext, id: string, draft: StateDraft): string {
  return input.elements.get(id)?.renderId ?? draft.alias;
}

function recordStateLabelPriority(input: StateReadContext, id: string, labelPriority: number): void {
  const existingPriority = input.stateLabelPriorities.get(id) ?? -1;
  input.stateLabelPriorities.set(id, Math.max(existingPriority, labelPriority));
}

function readStateLabel(input: StateReadContext, id: string, draft: StateDraft): string {
  const existing = input.elements.get(id);
  if (existing === undefined) {
    return draft.label;
  }
  return readPrioritizedStateLabel(existing.label, input.stateLabelPriorities.get(id)!, draft);
}

function readPrioritizedStateLabel(existingLabel: string, priority: number, draft: StateDraft): string {
  return draft.labelPriority > priority ? draft.label : existingLabel;
}

function createUniqueStateId(input: StateReadContext, baseId: string, sourceKey: string): string {
  const stateId = createUniqueId(baseId, input.usedStateIds);

  input.stateIds.set(sourceKey, stateId);

  return stateId;
}

function createStateId(path: string[], alias: string): string {
  return `state-${toSlug(path.concat(alias).join("-"))}`;
}

function createTransitionId(sourceId: string, targetId: string, label: string | undefined): string {
  const transitionLabel = label?.trim() || "unlabeled";

  return `transition-${toSlug(sourceId)}-to-${toSlug(targetId)}-${toSlug(transitionLabel)}`;
}

function createUniqueId(baseId: string, usedIds: Set<string>): string {
  let id = baseId;
  let count = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${count}`;
    count += 1;
  }

  usedIds.add(id);

  return id;
}

function toSlug(value: string): string {
  return value
    .replace(CAMEL_BOUNDARY_PATTERN, "$1-$2")
    .replace(WORD_SEPARATOR_PATTERN, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function readTransitionLabel(source: DiagramElement, target: DiagramElement, label: string | undefined): string {
  return label === undefined || label.trim().length === 0
    ? `${source.label} → ${target.label}`
    : `${source.label} → ${target.label}: ${label.trim()}`;
}

function isScopeClose(line: string): boolean {
  return /^\s*\}\s*$/u.test(line);
}
