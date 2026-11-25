import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const ENTITY_ID = '(?:"[^"\\n]+"|[^\\s{}\\[\\],:]+)';
const ENTITY_LABEL = "[^\\]\\n]+";
const CARDINALITY = "(?:\\|\\||\\|o|o\\||\\}\\||\\|\\{|\\}o|o\\{|one|only one|zero or one|zero or more|zero or many|one or zero|one or many|one or more|many(?:\\([01]\\))?|[01]|[01]\\+|u)";
const ENTITY_CLASS_DECORATOR = "(?:::+[\\w-]+(?:\\s*,\\s*[\\w-]+)*)?";
const ENTITY_BLOCK_PATTERN = new RegExp(`^(${ENTITY_ID})(?:\\s*\\[\\s*(${ENTITY_LABEL})\\s*\\])?${ENTITY_CLASS_DECORATOR}\\s*\\{\\s*(.*)$`, "u");
const ENTITY_BLOCK_START_GLOBAL_PATTERN = new RegExp(`(?:^|\\s)(${ENTITY_ID})(?:\\s*\\[\\s*(${ENTITY_LABEL})\\s*\\])?${ENTITY_CLASS_DECORATOR}\\s*\\{`, "gu");
const ENTITY_DECLARATION_PATTERN = new RegExp(`^(${ENTITY_ID})(?:\\s*\\[\\s*(${ENTITY_LABEL})\\s*\\])?${ENTITY_CLASS_DECORATOR}$`, "u");
const RELATIONSHIP_START_PATTERN = new RegExp(
  `(${ENTITY_ID})${ENTITY_CLASS_DECORATOR}\\s*(${CARDINALITY})\\s*(--|\\.\\.|\\.-|-\\.|optionally to|to)\\s*(${CARDINALITY})\\s*(${ENTITY_ID})${ENTITY_CLASS_DECORATOR}(?:\\s*:\\s*)?`,
  "iu"
);
const RELATIONSHIP_START_GLOBAL_PATTERN = new RegExp(RELATIONSHIP_START_PATTERN.source, "giu");
const ATTRIBUTE_PATTERN = /(?:^|\s)([\p{L}\p{N}_-]+(?:\[\d*\])?(?:\([^)]*\))?(?:~[^~]+~)?)\s+(\*?[\p{L}\p{N}_-]+(?:\[\])?)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?(?=\s|$)/giu;
const CONTEXT_LINE_PATTERN = /^(?:title|accTitle|accDescr|direction|classDef|class|style)\b/iu;
const COMMENT_SUFFIX_PATTERN = /%%(?=(?:[^"]*"[^"]*")*[^"]*$).*$/u;
const ER_FRONTMATTER_PATTERN = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u;
const CARDINALITY_LABELS = {
  "||": "one",
  "|o": "zero-or-one",
  "o|": "zero-or-one",
  "|{": "one-or-more",
  "}|": "one-or-more",
  "o{": "zero-or-more",
  "}o": "zero-or-more",
  "1": "one",
  "0": "zero-or-more",
  "only one": "one",
  "one": "one",
  "zero or one": "zero-or-one",
  "one or zero": "zero-or-one",
  "zero or more": "zero-or-more",
  "zero or many": "zero-or-more",
  "one or more": "one-or-more",
  "one or many": "one-or-more",
  "many": "zero-or-more",
  "many(0)": "zero-or-more",
  "many(1)": "one-or-more",
  "0+": "zero-or-more",
  "1+": "one-or-more",
  u: "unknown"
} as const;

type EntityState = {
  aliases: Set<string>;
  attributes: DiagramElement[];
  attributeOccurrences: Map<string, number>;
  currentEntityId: string | null;
  entities: Map<string, DiagramElement>;
  inAccessibleDescription: boolean;
  usedElementIds: Set<string>;
  relationships: DiagramElement[];
  relationshipOrdinal: number;
};

type EntityIdReservationState = {
  inAccessibleDescription: boolean;
  inEntityAttributes: boolean;
};

type RelationshipIdInput = {
  link: string;
  role: string;
  sourceCardinality: string;
  sourceId: string;
  targetCardinality: string;
  targetId: string;
};

type EntityBlockSpan = {
  end: number;
  start: number;
};

export function createEntityRelationshipDiagramModel(source: string): DiagramModel {
  const cleanSource = stripEntityDiagramHeader(source.replace(ER_FRONTMATTER_PATTERN, ""));
  const state: EntityState = {
    aliases: new Set(),
    attributes: [],
    attributeOccurrences: new Map(),
    currentEntityId: null,
    entities: new Map(),
    inAccessibleDescription: false,
    usedElementIds: readEntityIds(cleanSource),
    relationships: [],
    relationshipOrdinal: 0
  };

  cleanSource.split(/\r?\n/u).forEach((line) => readEntityRelationshipLine(stripComment(line), state));
  const relationships = state.relationships.map((relationship) => ({
    ...relationship,
    label: createRelationshipDisplayLabel(state, relationship)
  }));

  return {
    elements: [...state.entities.values(), ...state.attributes, ...relationships],
    renderSource: source,
    type: "erDiagram"
  };
}

function readEntityRelationshipLine(line: string, state: EntityState): void {
  const trimmed = line.trim().replace(/;\s*$/u, "");
  const content = stripAccessibleDescription(trimmed, state);
  if (content === null) {
    return;
  }
  if (skipEntityContextOrClose(content, state)) {
    return;
  }

  readEntityRelationshipContent(content, state);
}

function stripEntityDiagramHeader(source: string): string {
  const lines = source.split(/\r?\n/u);
  const firstContentLine = lines.findIndex((line) => !isEntityDiagramPreamble(line));
  if (firstContentLine === -1 || !/^\s*erDiagram\b/iu.test(lines[firstContentLine]!)) {
    return source;
  }
  lines[firstContentLine] = lines[firstContentLine]!.replace(/^\s*erDiagram\b/iu, "");
  return lines.join("\n");
}

function isEntityDiagramPreamble(line: string): boolean {
  return line.trim().length === 0 || line.trim().startsWith("%%");
}

function skipEntityContextOrClose(line: string, state: EntityState): boolean {
  if (isEntityRelationshipContextLine(line)) {
    return true;
  }
  return closeEntityBlock(line, state);
}

function closeEntityBlock(line: string, state: EntityState): boolean {
  if (line !== "}") {
    return false;
  }
  state.currentEntityId = null;
  return true;
}

function stripAccessibleDescription(line: string, state: Pick<EntityState, "inAccessibleDescription">): string | null {
  if (state.inAccessibleDescription) {
    return readDescriptionRemainder(line, state);
  }
  const opening = /^accDescr\s*\{/iu.exec(line);
  return opening === null ? line : readDescriptionRemainder(line.slice(opening[0].length), state);
}

function readDescriptionRemainder(content: string, state: Pick<EntityState, "inAccessibleDescription">): string | null {
  const closingBraceIndex = findUnquotedClosingBrace(content);
  if (closingBraceIndex === -1) {
    state.inAccessibleDescription = true;
    return null;
  }
  state.inAccessibleDescription = false;
  return content.slice(closingBraceIndex + 1).trim();
}

function readEntityRelationshipContent(trimmed: string, state: EntityState): void {
  let remainder = trimmed;
  while (remainder.length > 0) {
    const next = state.currentEntityId === null
      ? readTopLevelEntityRelationshipContent(remainder, state)
      : readEntityAttributeContent(remainder, state);
    remainder = next;
  }
}

function readEntityAttributeContent(line: string, state: EntityState): string {
  const closingBraceIndex = findUnquotedClosingBrace(line);
  if (closingBraceIndex === -1) {
    registerAttribute(state, line);
    return "";
  }
  registerAttribute(state, line.slice(0, closingBraceIndex).trim());
  state.currentEntityId = null;
  return line.slice(closingBraceIndex + 1).trim();
}

function openEntityBlock(trimmed: string, state: EntityState): string | null {
  const entityBlock = ENTITY_BLOCK_PATTERN.exec(trimmed);
  if (entityBlock === null) {
    return null;
  }

  const entityId = readOptionalCapture(entityBlock, 1)!;
  const alias = readOptionalCapture(entityBlock, 2);
  state.currentEntityId = alias === undefined
    ? ensureEntity(state, unquote(entityId), unquote(entityId))
    : ensureExplicitEntityAlias(state, unquote(entityId), unquote(alias));
  return readInlineAttributes(state, readOptionalCapture(entityBlock, 3)!);
}

function readInlineAttributes(state: EntityState, content: string): string {
  const closingBraceIndex = findUnquotedClosingBrace(content);
  if (closingBraceIndex !== -1) {
    registerAttribute(state, content.slice(0, closingBraceIndex).trim());
    state.currentEntityId = null;
    return content.slice(closingBraceIndex + 1).trim();
  }
  if (content.trim().length > 0) {
    registerAttribute(state, content.trim());
  }
  return "";
}

function findUnquotedClosingBrace(content: string): number {
  let index = content.indexOf("}");
  while (index !== -1) {
    if (isSourceOffsetOutsideQuotes(content, index)) {
      return index;
    }
    index = content.indexOf("}", index + 1);
  }
  return -1;
}

function isSourceOffsetOutsideQuotes(source: string, target: number): boolean {
  let inQuotes = false;
  for (let index = 0; index < target; index += 1) {
    if (source[index] === '"') {
      inQuotes = !inQuotes;
    }
  }
  return !inQuotes;
}

function readEntityBlockSpans(source: string): EntityBlockSpan[] {
  return Array.from(source.matchAll(ENTITY_BLOCK_START_GLOBAL_PATTERN))
    .filter((match) => isEntityAttributeBlockStart(match, source))
    .map((match) => createEntityBlockSpan(source, match));
}

function isEntityAttributeBlockStart(match: RegExpMatchArray, source: string): boolean {
  return isSourceOffsetOutsideQuotes(source, match.index!) && !/(?:\|{1,2}|\.\.|\.-|-\.|o\{|\}\|)/u.test(match[1]!);
}

function createEntityBlockSpan(source: string, match: RegExpMatchArray): EntityBlockSpan {
  const start = match.index! + match[0].indexOf(match[1]!);
  const contentStart = match.index! + match[0].length;
  const closingBraceIndex = findUnquotedClosingBrace(source.slice(contentStart));
  return { end: closingBraceIndex === -1 ? source.length : contentStart + closingBraceIndex + 1, start };
}

function readTopLevelRelationshipMatches(source: string): RegExpMatchArray[] {
  return Array.from(source.matchAll(RELATIONSHIP_START_GLOBAL_PATTERN))
    .filter((match) => isTopLevelRelationshipMatch(match, source));
}

function isTopLevelRelationshipMatch(match: RegExpMatchArray, source: string): boolean {
  return isCompleteEntityId(match[1]!) && isCompleteEntityId(match[5]!) &&
    isSourceOffsetOutsideQuotes(source, match.index!);
}

function isCompleteEntityId(entityId: string): boolean {
  return !entityId.startsWith('"') || /^"[^"\n]+"$/u.test(entityId);
}

function readFirstEntityBlockSpan(spans: EntityBlockSpan[]): EntityBlockSpan | undefined {
  return spans[0];
}

function readTopLevelEntityRelationshipContent(trimmed: string, state: EntityState): string {
  const suffix = registerRelationshipsFromLine(trimmed, state);
  if (suffix !== null) {
    return suffix;
  }
  const remainder = openEntityBlock(trimmed, state);
  if (remainder !== null) {
    return remainder;
  }
  readEntityDeclaration(trimmed, state);
  return "";
}

function readEntityDeclaration(trimmed: string, state: EntityState): void {
  const declaration = ENTITY_DECLARATION_PATTERN.exec(trimmed);
  if (declaration !== null) {
    const entityId = readOptionalCapture(declaration, 1)!;
    const alias = readOptionalCapture(declaration, 2);
    if (alias === undefined) {
      ensureEntity(state, unquote(entityId), unquote(entityId));
    } else {
      ensureExplicitEntityAlias(state, unquote(entityId), unquote(alias));
    }
  }
}

function readOptionalCapture(match: RegExpMatchArray | null, index: number): string | undefined {
  return match?.at(index);
}

function isEntityRelationshipContextLine(line: string): boolean {
  return line.length === 0 || line.startsWith("%%") || CONTEXT_LINE_PATTERN.test(line);
}

function registerAttribute(state: EntityState, line: string): void {
  Array.from(line.matchAll(ATTRIBUTE_PATTERN)).forEach((match) => registerAttributeMatch(state, match));
}

function registerAttributeMatch(state: EntityState, match: RegExpMatchArray): void {
  const entityId = state.currentEntityId!;
  const attributeName = readAttributeName(match[2]!);
  const name = attributeName.name;
  const occurrenceKey = `${entityId}\u0000${attributeName.renderName}`;
  const renderOrder = state.attributeOccurrences.get(occurrenceKey) ?? 0;
  state.attributeOccurrences.set(occurrenceKey, renderOrder + 1);
  const baseId = `attribute-${slug(entityId)}-${slug(name)}`;
  const id = uniqueId(baseId, state.usedElementIds);
  state.attributes.push({
    id,
    kind: "attribute",
    label: `${readEntityDisplayLabel(state, entityId)}.${name}`,
    renderOrder,
    renderSourceId: entityId,
    renderTargetId: attributeName.renderName
  });
}

function readAttributeName(rawName: string): { isPrimaryKey: boolean; name: string; renderName: string } {
  const isPrimaryKey = rawName.startsWith("*");
  return { isPrimaryKey, name: isPrimaryKey ? rawName.slice(1) : rawName, renderName: rawName };
}

function registerRelationship(state: EntityState, match: RegExpMatchArray, rawRole: string): void {
  const sourceId = unquote(match[1]!);
  const targetId = unquote(match[5]!);
  ensureRelationshipEntities(state, sourceId, targetId);
  const role = readRelationshipRole(rawRole);
  const sourceCardinality = readCardinality(match[2]!);
  const targetCardinality = readCardinality(match[4]!);
  const linkType = readRelationshipLinkType(match[3]!);
  const id = readRelationshipElementId({ match, role, sourceId, state, targetId });
  const renderOrder = takeRelationshipOrdinal(state);
  if (sourceId === targetId) {
    discardEarlierSelfLoops(state, sourceId);
  }
  state.relationships.push(createRelationshipElement({
    id,
    renderLinkType: linkType,
    renderOrder,
    renderLabel: role,
    renderSourceCardinality: sourceCardinality,
    renderSourceId: sourceId,
    renderTargetCardinality: targetCardinality,
    renderTargetId: targetId
  }));
}

function readRelationshipElementId(input: {
  match: RegExpMatchArray;
  role: string;
  sourceId: string;
  state: EntityState;
  targetId: string;
}): string {
  const { match, role, sourceId, state, targetId } = input;
  const key = createRelationshipId({
    link: match[3]!,
    role,
    sourceCardinality: match[2]!,
    sourceId,
    targetCardinality: match[4]!,
    targetId
  });
  return uniqueId(key, state.usedElementIds);
}

function takeRelationshipOrdinal(state: EntityState): number {
  const ordinal = state.relationshipOrdinal;
  state.relationshipOrdinal += 1;
  return ordinal;
}

function createRelationshipElement(input: Omit<DiagramElement, "kind" | "label">): DiagramElement {
  return { ...input, kind: "relationship", label: "" };
}

function readEntityDisplayLabel(state: EntityState, entityId: string): string {
  return state.entities.get(entityId)!.label;
}

function createRelationshipDisplayLabel(state: EntityState, relationship: DiagramElement): string {
  return `${readEntityDisplayLabel(state, relationship.renderSourceId!)} — ${relationship.renderLabel || "relationship"} → ${readEntityDisplayLabel(state, relationship.renderTargetId!)} (${relationship.renderSourceCardinality}, ${relationship.renderLinkType}, ${relationship.renderTargetCardinality})`;
}

function registerRelationshipsFromLine(line: string, state: EntityState): string | null {
  const block = readFirstEntityBlockSpan(readEntityBlockSpans(line));
  const matches = readTopLevelRelationshipMatches(line);
  if (!hasItems(matches)) {
    return null;
  }
  const relationMatches = readRelationshipsBeforeBlock(matches, block);
  if (!hasItems(relationMatches)) {
    return null;
  }
  registerAllRelationshipsFromLine({ block, line, matches: relationMatches, state });
  return readRelationshipSuffix(line, block);
}

function hasItems<T>(items: T[]): boolean {
  return items.length > 0;
}

function readRelationshipsBeforeBlock(matches: RegExpMatchArray[], block: EntityBlockSpan | undefined): RegExpMatchArray[] {
  return matches.filter((match) => block === undefined || match.index! < block.start);
}

function registerAllRelationshipsFromLine(input: {
  block: EntityBlockSpan | undefined;
  line: string;
  matches: RegExpMatchArray[];
  state: EntityState;
}): void {
  const { block, line, matches, state } = input;
  matches.forEach((match, index) => registerRelationshipFromLineMatch({ block, index, line, match, matches, state }));
}

function readRelationshipSuffix(line: string, block: EntityBlockSpan | undefined): string {
  return block === undefined ? "" : line.slice(block.start).trim();
}

function registerRelationshipFromLineMatch(input: {
  block: EntityBlockSpan | undefined;
  index: number;
  line: string;
  match: RegExpMatchArray;
  matches: RegExpMatchArray[];
  state: EntityState;
}): void {
  const { block, index, line, match, matches, state } = input;
  const roleStart = match.index! + match[0].length;
  const roleEnd = readRelationshipRoleEnd({ block, index, line, matches });
  registerRelationship(state, match, line.slice(roleStart, roleEnd).trim());
}

function readRelationshipRoleEnd(input: {
  block: EntityBlockSpan | undefined;
  index: number;
  line: string;
  matches: RegExpMatchArray[];
}): number {
  const nextMatch = readNextRelationshipStart(input);
  return Math.min(nextMatch, input.block?.start ?? nextMatch);
}

function readNextRelationshipStart(input: { index: number; line: string; matches: RegExpMatchArray[] }): number {
  return input.matches.at(input.index + 1)?.index ?? input.line.length;
}

function ensureRelationshipEntities(state: EntityState, sourceId: string, targetId: string): void {
  ensureEntity(state, sourceId, sourceId);
  ensureEntity(state, targetId, targetId);
}

function discardEarlierSelfLoops(state: EntityState, entityId: string): void {
  state.relationships = state.relationships.filter((relationship) =>
    relationship.renderSourceId !== entityId || relationship.renderTargetId !== entityId
  );
}

function ensureExplicitEntityAlias(state: EntityState, entityId: string, label: string): string {
  const result = ensureEntity(state, entityId, label);
  state.aliases.add(entityId);
  return result;
}

function ensureEntity(state: EntityState, entityId: string, label: string): string {
  const entity = state.entities.get(entityId);
  if (entity === undefined) {
    return addEntity(state, entityId, label);
  }
  if (label !== entityId) {
    updateFirstEntityAlias({ state, entity, entityId, label });
  }

  return entityId;
}

function addEntity(state: EntityState, entityId: string, label: string): string {
  state.entities.set(entityId, { id: entityId, kind: "node", label });
  if (label !== entityId) {
    state.aliases.add(entityId);
  }
  return entityId;
}

function updateFirstEntityAlias(input: {
  entity: DiagramElement;
  entityId: string;
  label: string;
  state: EntityState;
}): void {
  const { entity, entityId, label, state } = input;
  if (state.aliases.has(entityId)) {
    return;
  }
  entity.label = label;
  state.aliases.add(entityId);
}

function createRelationshipId(input: RelationshipIdInput): string {
  const label = slug(input.role) || "relationship";
  const linkType = readRelationshipLinkType(input.link);

  const sourceCardinality = readCardinality(input.sourceCardinality);
  const targetCardinality = readCardinality(input.targetCardinality);
  return `relationship-${slug(input.sourceId)}-to-${slug(input.targetId)}-${label}-${sourceCardinality}-${linkType}-${targetCardinality}`;
}

function readRelationshipLinkType(link: string): string {
  return link === "--" || link.toLowerCase() === "to" ? "identifying" : "non-identifying";
}

function readRelationshipRole(role: string): string {
  return unquote(role.trim()).replace(/<br\s*\/?>/giu, " ")
    .replace(/\*\*(.*?)\*\*|\*([^*]+)\*|_([^_]+)_/gu, "$1$2$3")
    .replace(/&amp;/giu, "&").replace(/\s+/gu, " ").trim();
}

function readCardinality(value: string): string {
  return CARDINALITY_LABELS[value.toLowerCase() as keyof typeof CARDINALITY_LABELS]!;
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/u, "$2");
}

function stripComment(line: string): string {
  return line.replace(COMMENT_SUFFIX_PATTERN, "");
}

function slug(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "");
}

function uniqueId(baseId: string, usedIds: Set<string>): string {
  let id = baseId;
  let suffix = 1;
  while (usedIds.has(id)) {
    suffix += 1;
    id = `${baseId}-${suffix}`;
  }
  usedIds.add(id);
  return id;
}

function readEntityIds(source: string): Set<string> {
  const ids = new Set<string>();
  const descriptionState = { inAccessibleDescription: false, inEntityAttributes: false };
  stripEntityDiagramHeader(source).split(/\r?\n/u)
    .forEach((line) => addEntityIdsOutsideDescription(line, ids, descriptionState));
  return ids;
}

function addEntityIdsOutsideDescription(
  line: string,
  ids: Set<string>,
  state: EntityIdReservationState
): void {
  const clean = stripComment(line.trim());
  const content = stripAccessibleDescription(clean, state);
  if (content === null) {
    return;
  }
  addEntityIdsFromLine(content, ids, state);
}

function addEntityIdsFromLine(line: string, ids: Set<string>, state: EntityIdReservationState): void {
  const content = readEntityIdContentAfterAttributes(line.trim(), state);
  if (content === null) {
    return;
  }
  const block = readFirstEntityBlockSpan(readEntityBlockSpans(content));
  const relationships = readTopLevelRelationshipMatches(content);
  if (hasRelationshipsBeforeBlock(relationships, block)) {
    reserveRelationshipEntities({ block, content, ids, relationships, state });
    return;
  }
  const blockContent = readEntityIdBlockContent(content, block);
  const remainder = readEntityIdBlockRemainder(blockContent, ids, state);
  addEntityIdsFromBlockRemainder({ content: blockContent, ids, remainder, state });
}

function readEntityIdBlockContent(content: string, block: EntityBlockSpan | undefined): string {
  return block === undefined ? content : content.slice(block.start).trim();
}

function hasRelationshipsBeforeBlock(relationships: RegExpMatchArray[], block: EntityBlockSpan | undefined): boolean {
  return relationships.length > 0 && (block === undefined || relationships[0]!.index! < block.start);
}

function reserveRelationshipEntities(input: {
  block: EntityBlockSpan | undefined;
  content: string;
  ids: Set<string>;
  relationships: RegExpMatchArray[];
  state: EntityIdReservationState;
}): void {
  const { block, content, ids, relationships, state } = input;
  readRelationshipsBeforeBlock(relationships, block).forEach((relationship) => reserveRelationshipEndpoints(ids, relationship));
  if (block !== undefined) {
    addEntityIdsFromLine(content.slice(block.start), ids, state);
  }
}

function reserveRelationshipEndpoints(ids: Set<string>, relationship: RegExpMatchArray): void {
  addEntityId(ids, readOptionalCapture(relationship, 1));
  addEntityId(ids, readOptionalCapture(relationship, 5));
}

function readEntityIdContentAfterAttributes(line: string, state: EntityIdReservationState): string | null {
  if (!state.inEntityAttributes) {
    return line;
  }
  const closingBraceIndex = findUnquotedClosingBrace(line);
  if (closingBraceIndex === -1) {
    return null;
  }
  state.inEntityAttributes = false;
  return line.slice(closingBraceIndex + 1).trim();
}

function addEntityIdsFromBlockRemainder(input: {
  content: string;
  ids: Set<string>;
  remainder: string;
  state: EntityIdReservationState;
}): void {
  const { content, ids, remainder, state } = input;
  if (remainder === content) {
    addEntityId(ids, readOptionalCapture(ENTITY_DECLARATION_PATTERN.exec(remainder), 1));
    return;
  }
  addEntityIdsFromLine(remainder, ids, state);
}

function readEntityIdBlockRemainder(line: string, ids: Set<string>, state: EntityIdReservationState): string {
  const block = ENTITY_BLOCK_PATTERN.exec(line);
  if (block === null) {
    return line;
  }
  addEntityId(ids, readOptionalCapture(block, 1));
  const content = readOptionalCapture(block, 3)!;
  const closingBraceIndex = findUnquotedClosingBrace(content);
  if (closingBraceIndex === -1) {
    state.inEntityAttributes = true;
    return "";
  }
  return content.slice(closingBraceIndex + 1).trim();
}

function addEntityId(ids: Set<string>, id: string | undefined): void {
  if (id !== undefined) {
    ids.add(unquote(id));
  }
}
