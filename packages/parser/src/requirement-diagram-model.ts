import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u;
const REQUIREMENT_TYPES = {
  requirement: "Requirement",
  functionalrequirement: "Functional Requirement",
  interfacerequirement: "Interface Requirement",
  performancerequirement: "Performance Requirement",
  physicalrequirement: "Physical Requirement",
  designconstraint: "Design Constraint"
} as const;
const RELATIONSHIP_TYPES = "contains|copies|derives|satisfies|verifies|refines|traces";
const NODE_BLOCK_PATTERN = /^(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+(.+?)\s*\{\s*$/iu;
const CLASS_SUFFIX_PATTERN = /\s*:::[\w,\s-]+$/u;
const RELATIONSHIP_PATTERN_NORMALIZED = new RegExp(
  `^("[^"\\n]+"|[^<>-]+?)\\s*(?:-\\s*(${RELATIONSHIP_TYPES})\\s*->|<-\\s*(${RELATIONSHIP_TYPES})\\s*-)\\s*("[^"\\n]+"|[^<>-]+?)$`,
  "iu"
);
const CONTEXT_LINE_PATTERN = /^(?:direction|classDef|class|style)\b/iu;
const ACCESSIBLE_DESCRIPTION_PATTERN = /^accDescr\s*\{/iu;
const COMMENT_PATTERN = /^(?:%%|#|%)/u;

type RequirementNode = {
  element: DiagramElement;
};

type RequirementRelationship = {
  sourceId: string;
  targetId: string;
  type: string;
};

type RequirementState = {
  activeNodeId: string | null;
  accessibleDescription: boolean;
  nodes: Map<string, RequirementNode>;
  relationships: RequirementRelationship[];
};

export function createRequirementDiagramModel(source: string): DiagramModel {
  const state: RequirementState = {
    activeNodeId: null,
    accessibleDescription: false,
    nodes: new Map(),
    relationships: []
  };
  const cleanSource = source.replace(FRONTMATTER_PATTERN, "");
  cleanSource.split(/\r?\n/u).forEach((line) => readRequirementLine(line, state));
  const elements = [...state.nodes.values()].map(({ element }) => element);
  const usedIds = new Set(elements.map(({ id }) => id));
  const relations = getFocusableRequirementRelationships(state.relationships).map(({ relationship, renderOrder }) =>
    createRequirementRelationship({ relationship, renderOrder, nodes: state.nodes, usedIds })
  );

  return { elements: [...elements, ...relations], renderSource: source, type: "requirementDiagram" };
}

function getFocusableRequirementRelationships(relationships: RequirementRelationship[]): Array<{
  relationship: RequirementRelationship;
  renderOrder: number;
}> {
  const latestSelfLoopByNode = new Map<string, number>();
  relationships.forEach((relationship, renderOrder) => {
    if (relationship.sourceId === relationship.targetId) {
      latestSelfLoopByNode.set(relationship.sourceId, renderOrder);
    }
  });
  return relationships.flatMap((relationship, renderOrder) => {
    if (relationship.sourceId !== relationship.targetId || latestSelfLoopByNode.get(relationship.sourceId) === renderOrder) {
      return [{ relationship, renderOrder }];
    }
    return [];
  });
}

function readRequirementLine(line: string, state: RequirementState): void {
  const trimmed = line.trim();
  if (skipRequirementContext(trimmed, state)) {
    return;
  }
  if (readInsideRequirementNode(trimmed, state)) {
    return;
  }
  readRequirementStatement(trimmed, state);
}

function readInsideRequirementNode(line: string, state: RequirementState): boolean {
  if (state.activeNodeId === null) {
    return false;
  }
  readRequirementProperty(line, state);
  return true;
}

function readRequirementStatement(line: string, state: RequirementState): void {
  if (isRequirementMetadata(line)) {
    return;
  }
  const node = readRequirementNode(line);
  if (node !== null) {
    registerRequirementNode(node, state);
    return;
  }
  appendRequirementRelationship(line, state);
}

function isRequirementMetadata(line: string): boolean {
  return isRequirementHeader(line) || isRequirementContextLine(line);
}

function skipRequirementContext(line: string, state: RequirementState): boolean {
  if (state.accessibleDescription) {
    return continueRequirementDescription(line, state);
  }
  if (startRequirementDescription(line, state)) {
    return true;
  }
  return isRequirementComment(line);
}

function continueRequirementDescription(line: string, state: RequirementState): true {
  state.accessibleDescription = !line.includes("}");
  return true;
}

function startRequirementDescription(line: string, state: RequirementState): boolean {
  const description = ACCESSIBLE_DESCRIPTION_PATTERN.exec(line);
  if (description === null) {
    return false;
  }
  state.accessibleDescription = !line.slice(description[0].length).includes("}");
  return true;
}

function isRequirementComment(line: string): boolean {
  return line.length === 0 || COMMENT_PATTERN.test(line);
}

function isRequirementHeader(line: string): boolean {
  return /^requirementDiagram\b/iu.test(line);
}

function isRequirementContextLine(line: string): boolean {
  return CONTEXT_LINE_PATTERN.test(line) || /^accTitle\b/iu.test(line);
}

function readRequirementNode(line: string): { id: string; type: string } | null {
  const match = NODE_BLOCK_PATTERN.exec(line);
  if (match === null) {
    return null;
  }
  const name = match[2]!.replace(CLASS_SUFFIX_PATTERN, "").trim();
  return { id: unquote(name), type: match[1]! };
}

function registerRequirementNode(node: { id: string; type: string }, state: RequirementState): void {
  state.activeNodeId = node.id;
  if (state.nodes.has(node.id)) {
    return;
  }
  state.nodes.set(node.id, {
    element: {
      id: node.id,
      kind: "node",
      label: createRequirementNodeLabel(node),
      renderId: node.id
    }
  });
}

function createRequirementNodeLabel(node: { id: string; type: string }): string {
  const type = node.type.toLowerCase() as keyof typeof REQUIREMENT_TYPES | "element";
  const label = type === "element" ? "Element" : REQUIREMENT_TYPES[type];
  return `${node.id} — ${label}`;
}

function readRequirementProperty(line: string, state: RequirementState): void {
  if (line === "}") {
    state.activeNodeId = null;
    return;
  }
}

function readRequirementRelationship(line: string): RequirementRelationship | null {
  const match = RELATIONSHIP_PATTERN_NORMALIZED.exec(line);
  if (match === null) {
    return null;
  }
  return createRequirementRelationshipParts(line, match);
}

function createRequirementRelationshipParts(line: string, match: RegExpExecArray): RequirementRelationship {
  const isReversed = Boolean(match[3]);
  const { sourceText, targetText } = readRelationshipEndpoints(match, isReversed);
  const type = readRelationshipType(match, isReversed);
  return { sourceId: unquote(sourceText.trim()), targetId: unquote(targetText.trim()), type };
}

function readRelationshipEndpoints(match: RegExpExecArray, isReversed: boolean): {
  sourceText: string;
  targetText: string;
} {
  return isReversed
    ? { sourceText: match[4]!, targetText: match[1]! }
    : { sourceText: match[1]!, targetText: match[4]! };
}

function readRelationshipType(match: RegExpExecArray, isReversed: boolean): string {
  return (isReversed ? match[3]! : match[2]!).toLowerCase();
}

function appendRequirementRelationship(line: string, state: RequirementState): void {
  const relationship = readRequirementRelationship(line);
  if (relationship !== null) {
    state.relationships.push(relationship);
  }
}

function createRequirementRelationship(input: {
  relationship: RequirementRelationship;
  renderOrder: number;
  nodes: Map<string, RequirementNode>;
  usedIds: Set<string>;
}): DiagramElement {
  const { relationship, renderOrder, nodes, usedIds } = input;
  assertRelationshipEndpoints(relationship, nodes);
  const baseId = `relationship-${slug(relationship.sourceId)}-${relationship.type}-${slug(relationship.targetId)}`;
  return {
    id: uniqueId(baseId, usedIds),
    kind: "relationship",
    label: `${nodes.get(relationship.sourceId)!.element.label} — ${relationship.type} → ${nodes.get(relationship.targetId)!.element.label}`,
    renderId: relationship.sourceId === relationship.targetId
      ? `${relationship.sourceId}-cyclic-special-mid`
      : `diagram-tour-requirement-edge-${renderOrder}`,
    renderLabel: relationship.type,
    renderOrder,
    renderSourceId: relationship.sourceId,
    renderTargetId: relationship.targetId
  };
}

function assertRelationshipEndpoints(
  relationship: RequirementRelationship,
  nodes: Map<string, RequirementNode>
): void {
  const missingId = [relationship.sourceId, relationship.targetId].find((id) => !nodes.has(id));
  if (missingId !== undefined) {
    throw new Error(`Requirement diagram relation references undeclared ID "${missingId}".`);
  }
}

function unquote(value: string): string {
  return value.replace(/^"([^"]+)"$/u, "$1");
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
