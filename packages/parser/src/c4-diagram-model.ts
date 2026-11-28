import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";

const CALL = /\b(Person_Ext|Person|System(?:Db|Queue)?_Ext|System(?:Db|Queue)?|Container(?:Db|Queue)?_Ext|Container(?:Db|Queue)?|Component(?:Db|Queue)?_Ext|Component(?:Db|Queue)?|Deployment_Node|Node_L|Node_R|Node|Enterprise_Boundary|System_Boundary|Container_Boundary|Boundary|BiRel|Rel_(?:Up|U|Down|D|Left|L|Right|R|Back)|RelIndex|Rel)\s*\(/gu;
const BOUNDARIES = new Set(["Boundary", "Enterprise_Boundary", "System_Boundary", "Container_Boundary"]);
const DEPLOYMENT_SCOPES = new Set(["Deployment_Node", "Node", "Node_L", "Node_R"]);
const RELATIONSHIPS = new Set(["BiRel", "Rel", "Rel_U", "Rel_Up", "Rel_D", "Rel_Down", "Rel_L", "Rel_Left", "Rel_R", "Rel_Right", "Rel_Back", "RelIndex"]);
const PREFIXES: Record<string, string> = {
  Person: "person", System: "system", Container: "container", Component: "component",
  Deployment_Node: "deployment", Node: "deployment", Node_L: "deployment", Node_R: "deployment"
};

type C4Argument = { name?: string; value: string };
type C4State = { elements: DiagramElement[]; relationIndex: number; renderRelationOrder: number; boundaryStack: string[] };
type RelationParts = { from: string; label: string; technology: string; to: string };

export function createC4DiagramModel(source: string): DiagramModel {
  const state: C4State = { elements: [], relationIndex: 0, renderRelationOrder: 0, boundaryStack: [] };
  const cleanSource = source.split(/\r?\n/u).map(stripC4Comment).join("\n").replace(/^\s*title\b[^\n]*/gmu, "");
  readC4Calls(cleanSource, state);
  return { elements: state.elements, renderSource: source, type: "c4" };
}

function stripC4Comment(line: string): string {
  const comment = [...line.matchAll(/"(?:[^"\\]|\\.)*"|%%/gu)].find(([token]) => token === "%%");
  return comment === undefined ? line : line.slice(0, comment.index);
}

function readC4Calls(source: string, state: C4State): void {
  let call: RegExpExecArray | null;
  let previousEnd = 0;
  let pendingBoundary: string | undefined;
  CALL.lastIndex = 0;
  while ((call = CALL.exec(source)) !== null) {
    readBoundaryScope(source.slice(previousEnd, call.index), state.boundaryStack, pendingBoundary);
    pendingBoundary = undefined;
    const parsed = readArguments(source, CALL.lastIndex - 1);
    if (parsed === undefined) { continue; }
    readC4Call(state, call[1]!, parsed.args);
    pendingBoundary = readPendingBoundary(call[1]!, parsed.args);
    CALL.lastIndex = parsed.end;
    previousEnd = parsed.end;
  }
  CALL.lastIndex = 0;
}

function readC4Call(state: C4State, name: string, args: C4Argument[]): void {
  if (BOUNDARIES.has(name)) {
    return registerBoundary(state, args);
  }
  if (RELATIONSHIPS.has(name)) {
    return registerRelationship(state, name, args);
  }
  registerElement(state, name, args);
}

function registerBoundary(state: C4State, args: C4Argument[]): void {
  const alias = readPositionalArgument(args, 0)!;
  state.elements.push({ id: `boundary-${alias}`, kind: "group", label: readPositionalArgument(args, 1) ?? alias, renderId: alias, renderParentId: state.boundaryStack.at(-1) });
}

function registerRelationship(state: C4State, name: string, args: C4Argument[]): void {
  state.relationIndex += 1;
  const relation = readRelationParts(name, args);
  const previous = state.elements.find((element) => element.kind === "relationship" &&
    element.renderSourceId === relation.from && element.renderTargetId === relation.to);
  const renderOrder = readRenderRelationOrder(state, previous);
  const element = createRelationshipElement(state, relation, renderOrder);
  const position = previous === undefined ? state.elements.length : state.elements.indexOf(previous);
  state.elements[position] = element;
}

function readRenderRelationOrder(state: C4State, previous: DiagramElement | undefined): number {
  if (previous !== undefined) { return previous.renderOrder!; }
  state.renderRelationOrder += 1;
  return state.renderRelationOrder;
}

function createRelationshipElement(state: C4State, relation: RelationParts, renderOrder: number): DiagramElement {
  return {
    id: `relationship-${state.relationIndex}`,
    kind: "relationship",
    label: formatRelationship(relation),
    renderOrder,
    renderSourceId: relation.from,
    renderTargetId: relation.to,
    ...(relation.technology && { renderTechnology: relation.technology }),
    renderParentId: state.boundaryStack.at(-1)
  };
}

function registerElement(state: C4State, name: string, args: C4Argument[]): void {
  const prefix = readElementPrefix(name);
  state.elements.push({
    id: `${prefix}-${readPositionalArgument(args, 0)}`,
    kind: readElementKind(prefix),
    label: readElementLabel(args),
    renderId: readPositionalArgument(args, 0),
    renderIdentity: readElementIdentity(name, args),
    renderParentId: state.boundaryStack.at(-1)
  });
}

function readElementIdentity(name: string, args: C4Argument[]): string {
  return readElementIdentityFields(name).map(([key, index]) => readNamedArgument(args, key) ??
    readPositionalArgument(args, index) ?? readElementIdentityDefault(name, key))
    .filter(Boolean).join(" ");
}

function readElementIdentityDefault(name: string, key: string): string {
  return name === "Deployment_Node" && key === "type" ? "node" : "";
}

function readElementIdentityFields(name: string): ReadonlyArray<readonly [string, number]> {
  return name.startsWith("Person") || name.startsWith("System")
    ? [["label", 1], ["descr", 2]]
    : readTypedIdentityFields(name);
}

function readTypedIdentityFields(name: string): ReadonlyArray<readonly [string, number]> {
  return DEPLOYMENT_SCOPES.has(name)
    ? [["label", 1], ["type", 2], ["descr", 3]]
    : [["label", 1], ["techn", 2], ["descr", 3]];
}

function readRelationParts(name: string, args: C4Argument[]): RelationParts {
  const offset = Number(name === "RelIndex");
  return {
    from: readRelationArgument({ args, name: "from", index: offset, fallback: "unknown" }),
    to: readRelationArgument({ args, name: "to", index: offset + 1, fallback: "unknown" }),
    label: readRelationArgument({ args, name: "label", index: offset + 2, fallback: "" }),
    technology: readRelationArgument({ args, name: "techn", index: offset + 3, fallback: "" })
  };
}

function readRelationArgument(input: { args: C4Argument[]; name: string; index: number; fallback: string }): string {
  return readNamedArgument(input.args, input.name) ?? readPositionalArgument(input.args, input.index) ?? input.fallback;
}

function readNamedArgument(args: C4Argument[], name: string): string | undefined {
  return args.find((argument) => argument.name === name)?.value;
}

function readPositionalArgument(args: C4Argument[], index: number): string | undefined {
  const argument = args.at(index);
  if (argument === undefined || argument.name !== undefined) { return undefined; }
  return argument.value;
}

function formatRelationship(relation: RelationParts): string {
  const details = [relation.label && `: ${relation.label}`, relation.technology && ` [${relation.technology}]`]
    .filter(Boolean)
    .join("");
  return `${relation.from} → ${relation.to}${details}`;
}

function readElementPrefix(name: string): string {
  return Object.entries(PREFIXES).find(([key]) => name.startsWith(key))![1];
}

function readElementKind(prefix: string): DiagramElement["kind"] {
  return prefix === "deployment" ? "group" : "node";
}

function readElementLabel(args: C4Argument[]): string {
  return readPositionalArgument(args, 1) ?? readPositionalArgument(args, 0)!;
}

function readArguments(source: string, open: number): { args: C4Argument[]; end: number } | undefined {
  const close = [...source.slice(open + 1).matchAll(/"(?:[^"\\]|\\.)*"|\)/gu)].find(([token]) => token === ")");
  if (close?.index === undefined) { return undefined; }
  const body = source.slice(open + 1, open + 1 + close.index);
  return { args: body.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/u).map(readC4Argument), end: open + close.index + 2 };
}

function readC4Argument(argument: string): C4Argument {
  const named = argument.trim().match(/^\$([a-z]+)\s*=\s*(.*)$/iu);
  if (named === null) { return { value: cleanC4Value(argument) }; }
  return { name: named[1]!.toLowerCase(), value: cleanC4Value(named[2]!) };
}

function cleanC4Value(value: string): string {
  return value.trim().replace(/^"|"$/gu, "");
}

function readBoundaryScope(source: string, stack: string[], pendingBoundary?: string): void {
  for (const token of source.matchAll(/"(?:[^"\\]|\\.)*"|[{}]/gu)) {
    readBoundaryToken(token[0], stack, pendingBoundary);
  }
}

function readBoundaryToken(token: string, stack: string[], pendingBoundary?: string): void {
  if (token.startsWith("\"")) { return; }
  if (token === "{") { openBoundary(stack, pendingBoundary); }
  else { closeBoundary(stack); }
}

function readPendingBoundary(name: string, args: C4Argument[]): string | undefined {
  return BOUNDARIES.has(name) || DEPLOYMENT_SCOPES.has(name) ? readPositionalArgument(args, 0) : undefined;
}

function openBoundary(stack: string[], pendingBoundary?: string): void {
  if (pendingBoundary === undefined) { return; }
  stack.push(pendingBoundary);
}

function closeBoundary(stack: string[]): void {
  if (stack.length === 0) { return; }
  stack.pop();
}
