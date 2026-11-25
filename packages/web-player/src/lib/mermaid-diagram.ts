import type Mermaid from "mermaid";
import type { DiagramElement, ResolvedDiagram } from "@diagram-tour/core";

import type { FocusGroup } from "$lib/focus-group";

const APP_NODE_CLASS_PREFIX = "diagram_tour_node_";
const FOCUSED_STATE = "focused";
const DIMMED_STATE = "dimmed";
const MERMAID_ERROR_MESSAGE = "Failed to render Mermaid diagram.";
const MERMAID_FONT_STACK = "Geist, Inter, Segoe UI, system-ui, sans-serif";
const NODE_FOCUS_GRADIENT_ID = "diagram-tour-node-focus-gradient";
const NODE_HOVER_GRADIENT_ID = "diagram-tour-node-hover-gradient";

type MermaidModule = { default: typeof Mermaid };
type RenderedDiagramElement = HTMLElement | SVGElement;
type FlowchartConnectorEndpoint = {
  sourceId: string;
  targetId: string;
};
type RequirementEdgeData = { id: string };
type RequirementDiagramData = { edges: RequirementEdgeData[] };
type RequirementDatabasePrototype = {
  getData: (this: RequirementDatabase) => RequirementDiagramData;
};
type RequirementDatabase = object;
type MermaidThemeVariables = Record<string, string>;
type SvgNodeBounds = {
  elementId: string;
  height: number;
  left: number;
  top: number;
  width: number;
};
type SvgPointLike = { x: number; y: number };

const MESSAGE_MARKER_ATTRIBUTES = ["marker-start", "marker-mid", "marker-end"] as const;
const FLOWCHART_MARKER_ATTRIBUTES = ["marker-start", "marker-end"] as const;
const FLOWCHART_CONNECTOR_SELECTOR = ".edgePath path, .flowchart-link";
const STATE_GROUP_SELECTOR = "g.statediagram-state, g.statediagram-cluster, g.stateGroup";
const ER_ENTITY_SELECTOR = "svg .nodes .node";
const ER_RELATIONSHIP_SELECTOR = "svg .edgePaths .relationshipLine";
const DIAGRAM_ANNOTATORS = {
  classDiagram: annotateClassElements,
  erDiagram: annotateEntityRelationshipElements,
  flowchart: annotateFlowchartElements,
  mindmap: annotateMindmapElements,
  requirementDiagram: annotateRequirementElements,
  sankey: annotateSankeyElements,
  sequence: annotateSequenceElements,
  stateDiagram: annotateStateDiagramElements,
  zenuml: annotateZenUmlElements
} satisfies Record<
  ResolvedDiagram["type"],
  (container: HTMLElement, elements: DiagramElement[]) => void
>;
const requirementDatabasePrototypes = new WeakSet<object>();
const MERMAID_THEME_DEFAULTS = {
  background: "#0e1116",
  fontFamily: MERMAID_FONT_STACK,
  lineColor: "#30363d",
  mainBkg: "#1c2128",
  nodeBorder: "#30363d",
  primaryBorderColor: "#30363d",
  primaryColor: "#1c2128",
  primaryTextColor: "#e6edf3",
  secondaryBorderColor: "#30363d",
  secondaryColor: "#161b22",
  secondaryTextColor: "#e6edf3",
  tertiaryBorderColor: "#30363d",
  tertiaryColor: "#161b22",
  tertiaryTextColor: "#e6edf3",
  textColor: "#e6edf3"
} satisfies MermaidThemeVariables;
const SEQUENCE_THEME_VARIABLES = {
  actorBkg: "var(--color-node-base-fill, #1c2128)",
  actorBorder: "var(--color-node-base-stroke, #30363d)",
  actorLineColor: "var(--color-node-base-stroke, #30363d)",
  actorTextColor: "var(--color-node-base-text, #e6edf3)",
  activationBkgColor: "var(--bg-surface, #161b22)",
  activationBorderColor: "var(--border-subtle, #30363d)",
  altSectionBkgColor: "var(--bg-surface, #161b22)",
  labelBoxBkgColor: "var(--bg-surface, #161b22)",
  labelBoxBorderColor: "var(--border-subtle, #30363d)",
  labelTextColor: "var(--text-primary, #e6edf3)",
  loopLineColor: "var(--border-subtle, #30363d)",
  loopTextColor: "var(--text-primary, #e6edf3)",
  noteBkgColor: "var(--bg-surface, #161b22)",
  noteBorderColor: "var(--border-subtle, #30363d)",
  noteTextColor: "var(--text-primary, #e6edf3)",
  sectionBkgColor: "var(--bg-surface, #161b22)",
  sectionBkgColor2: "var(--bg-base, #0e1116)",
  sequenceNumberColor: "var(--text-secondary, #8b949e)",
  signalColor: "var(--color-node-base-stroke, #30363d)",
  signalTextColor: "var(--color-node-base-text, #e6edf3)"
} satisfies MermaidThemeVariables;
const STATE_DIAGRAM_THEME_VARIABLES = {
  compositeBackground: "var(--bg-surface, #161b22)",
  compositeTitleBackground: "var(--color-node-base-fill, #1c2128)",
  labelBackgroundColor: "var(--bg-surface, #161b22)",
  stateBkg: "var(--color-node-base-fill, #1c2128)",
  stateBorder: "var(--color-node-base-stroke, #30363d)",
  stateLabelColor: "var(--color-node-base-text, #e6edf3)",
  transitionColor: "var(--color-node-base-stroke, #30363d)"
} satisfies MermaidThemeVariables;
const ZENUML_THEME_RULES = [
  [".frame-border-outer, .frame-header-line, .participant-box, .lifeline, .occurrence, .fragment-border, .group-outline", "stroke", "var(--color-node-base-stroke)"],
  [".frame-border-inner, .frame-header-bg, .participant-box, .occurrence, .fragment-header, .group-title-bg", "fill", "var(--color-node-base-fill)"],
  [".frame-title, .participant-label, .message-label, .fragment-label, .fragment-condition, .fragment-section-label, .return-label, .group-title-text", "fill", "var(--color-node-base-text)"],
  [".participant-icon, .return-icon", "fill", "var(--color-node-base-text)"],
  [".message-line, .arrow-head, .return-line, .return-arrow", "stroke", "var(--color-node-base-stroke)"],
  [".fragment-separator, .divider-bg", "stroke", "var(--border-subtle)"],
  [".fragment-separator, .seq-number, .comment-text, .divider-label", "fill", "var(--text-secondary)"]
] as const;

let mermaidModulePromise: Promise<MermaidModule> | undefined;

export async function renderMermaidDiagram(input: {
  container: HTMLElement;
  diagram: ResolvedDiagram;
}): Promise<void> {
  const mermaid = await loadMermaid();

  mermaid.default.initialize({
    ...readMermaidDiagramConfig(input.diagram),
    startOnLoad: false,
    theme: "base",
    themeVariables: readMermaidThemeVariables(input.container, input.diagram)
  });

  const renderResult = await renderDiagramSource({
    mermaid,
    source: createRenderableDiagramSource(input.diagram),
    type: input.diagram.type
  });

  input.container.innerHTML = renderResult.svg;
  renderResult.bindFunctions?.(input.container);
  applyZenUmlTheme(input.container);
  normalizeRenderedSvg(input.container);
  injectNodeGradients(input.container);
  annotateRenderedElements(input.container, input.diagram);
  annotateFlowchartConnectors(input.container, input.diagram);
  annotateConnectorLabels(input.container);
}

export function applyFocusState(input: {
  container: HTMLElement;
  focusGroup: FocusGroup;
}): void {
  const focusedElementIds = new Set(input.focusGroup.elementIds);
  const diagramElements = input.container.querySelectorAll<RenderedDiagramElement>(
    "[data-diagram-element-id], [data-node-id]"
  );

  ensureFlowchartConnectorsAnnotated(input.container);
  setFocusGroupMetadata(input.container, input.focusGroup);
  setConnectorContext(input.container, input.focusGroup);

  diagramElements.forEach((element) => {
    setFocusState({
      element,
      focusGroupMode: input.focusGroup.mode,
      isFocused: focusedElementIds.has(readDiagramElementId(element))
    });
  });
  setRequirementRelationshipContext(input.container, input.focusGroup);
}

export function createRenderableDiagramSource(diagram: ResolvedDiagram): string {
  if (diagram.type !== "flowchart") {
    return diagram.source;
  }

  const classStatements = diagram.elements
    .filter((element) => element.kind === "node")
    .map((element) => createClassStatement(element.id));

  return `${diagram.source}\n${classStatements.join("\n")}`;
}

export function getMermaidErrorMessage(): string {
  return MERMAID_ERROR_MESSAGE;
}

function readMermaidDiagramConfig(diagram: ResolvedDiagram): Record<string, unknown> {
  if (diagram.type === "requirementDiagram") {
    return { fontSize: 14 };
  }
  if (diagram.type !== "sankey") {
    return {};
  }

  return {
    sankey: {
      height: 860,
      useMaxWidth: false,
      width: 1560
    }
  };
}

async function loadMermaid(): Promise<MermaidModule> {
  mermaidModulePromise ??= loadMermaidWithZenUml();

  return mermaidModulePromise;
}

async function loadMermaidWithZenUml(): Promise<MermaidModule> {
  const [mermaid, zenuml] = await Promise.all([import("mermaid"), import("@mermaid-js/mermaid-zenuml")]);
  await mermaid.default.registerExternalDiagrams([zenuml.default]);
  return mermaid as MermaidModule;
}

function readMermaidThemeVariables(container: HTMLElement, diagram: ResolvedDiagram): MermaidThemeVariables {
  const themeStyles = getComputedStyle(readThemeTarget(container));
  const themeVariables = {
    ...readPrimaryThemeVariables(themeStyles),
    ...readSecondaryThemeVariables(themeStyles),
    background: readThemeToken(themeStyles, "--bg-base", MERMAID_THEME_DEFAULTS.background),
    fontFamily: MERMAID_FONT_STACK
  };

  if (diagram.type === "sequence") {
    return { ...themeVariables, ...SEQUENCE_THEME_VARIABLES };
  }

  return diagram.type === "stateDiagram"
    ? { ...themeVariables, ...STATE_DIAGRAM_THEME_VARIABLES }
    : themeVariables;
}

function readPrimaryThemeVariables(styles: CSSStyleDeclaration): MermaidThemeVariables {
  return {
    lineColor: readThemeToken(styles, "--color-node-base-stroke", MERMAID_THEME_DEFAULTS.lineColor),
    mainBkg: readThemeToken(styles, "--color-node-base-fill", MERMAID_THEME_DEFAULTS.mainBkg),
    nodeBorder: readThemeToken(styles, "--color-node-base-stroke", MERMAID_THEME_DEFAULTS.nodeBorder),
    primaryBorderColor: readThemeToken(
      styles,
      "--color-node-base-stroke",
      MERMAID_THEME_DEFAULTS.primaryBorderColor
    ),
    primaryColor: readThemeToken(styles, "--color-node-base-fill", MERMAID_THEME_DEFAULTS.primaryColor),
    primaryTextColor: readThemeToken(
      styles,
      "--color-node-base-text",
      MERMAID_THEME_DEFAULTS.primaryTextColor
    )
  };
}

function readSecondaryThemeVariables(styles: CSSStyleDeclaration): MermaidThemeVariables {
  return {
    secondaryBorderColor: readThemeToken(
      styles,
      "--border-subtle",
      MERMAID_THEME_DEFAULTS.secondaryBorderColor
    ),
    secondaryColor: readThemeToken(styles, "--bg-surface", MERMAID_THEME_DEFAULTS.secondaryColor),
    secondaryTextColor: readThemeToken(styles, "--text-primary", MERMAID_THEME_DEFAULTS.secondaryTextColor),
    tertiaryBorderColor: readThemeToken(
      styles,
      "--border-subtle",
      MERMAID_THEME_DEFAULTS.tertiaryBorderColor
    ),
    tertiaryColor: readThemeToken(styles, "--bg-surface", MERMAID_THEME_DEFAULTS.tertiaryColor),
    tertiaryTextColor: readThemeToken(styles, "--text-primary", MERMAID_THEME_DEFAULTS.tertiaryTextColor),
    textColor: readThemeToken(styles, "--text-primary", MERMAID_THEME_DEFAULTS.textColor)
  };
}

function readThemeTarget(container: HTMLElement): Element {
  return container.closest(".theme-root") ?? document.querySelector(".theme-root") ?? document.documentElement;
}

function readThemeToken(
  styles: CSSStyleDeclaration,
  token: string,
  fallback: string
): string {
  const value = styles.getPropertyValue(token).trim();

  return value.length > 0 ? value : fallback;
}

function createRenderId(): string {
  return `diagram-tour-${crypto.randomUUID()}`;
}

async function renderDiagramSource(input: {
  mermaid: MermaidModule;
  source: string;
  type: ResolvedDiagram["type"];
}) {
  try {
    if (input.type === "requirementDiagram") {
      await normalizeRequirementEdgeIds(input.mermaid.default, input.source);
    }
    return await input.mermaid.default.render(createRenderId(), input.source);
  } catch (_error) {
    throw new Error(MERMAID_ERROR_MESSAGE);
  }
}

async function normalizeRequirementEdgeIds(mermaid: typeof Mermaid, source: string): Promise<void> {
  await mermaid.parse(source);
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
  const database = diagram.db as unknown as RequirementDatabase;
  const prototype = Object.getPrototypeOf(database) as RequirementDatabasePrototype;

  if (requirementDatabasePrototypes.has(prototype)) {
    return;
  }
  patchRequirementDatabase(prototype);
  requirementDatabasePrototypes.add(prototype);
}

function patchRequirementDatabase(prototype: RequirementDatabasePrototype): void {
  const getData = prototype.getData;
  prototype.getData = function () {
    const data = getData.call(this);
    return {
      ...data,
      edges: data.edges.map((edge, index) => ({
        ...edge,
        id: `diagram-tour-requirement-edge-${index}`
      }))
    };
  };
}

function annotateRenderedElements(container: HTMLElement, diagram: ResolvedDiagram): void {
  DIAGRAM_ANNOTATORS[diagram.type](container, diagram.elements);
}

function applyZenUmlTheme(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>('svg[aria-roledescription="zenuml"]');

  if (svg === null) {
    return;
  }
  ZENUML_THEME_RULES.forEach(([selector, property, value]) => {
    svg.querySelectorAll<SVGElement>(selector).forEach((element) => element.style.setProperty(property, value));
  });
}

function annotateFlowchartElements(container: HTMLElement, elements: DiagramElement[]): void {
  elements.filter((element) => element.kind === "node").forEach((element) => {
    const renderedElement = container.querySelector<RenderedDiagramElement>(`.${createNodeClass(element.id)}`);

    if (renderedElement === null) {
      return;
    }

    setDiagramElementDataset(renderedElement, element);
  });

  const transitions = elements.filter((element) => element.kind === "transition");
  transitions.forEach((transition) => {
    annotateFlowchartTransition(container, transition, transitions);
  });
}

function annotateFlowchartTransition(
  container: HTMLElement,
  transition: DiagramElement,
  transitions: DiagramElement[]
): void {
  const renderId = transition.renderId;
  if (renderId === undefined) {
    return;
  }

  readFlowchartTransitionTargets({ container, renderId, transition, transitions }).forEach((element) => {
    setDiagramElementDataset(element, transition);
    annotateFlowchartTransitionConnector(element, transition);
  });
}

function annotateFlowchartTransitionConnector(element: RenderedDiagramElement, transition: DiagramElement): void {
  if (!element.matches(FLOWCHART_CONNECTOR_SELECTOR)) {
    return;
  }

  element.dataset.connectorRole = "flow";
  setFlowchartTransitionEndpoint(element, "connectorSourceId", transition.renderSourceId);
  setFlowchartTransitionEndpoint(element, "connectorTargetId", transition.renderTargetId);
}

function setFlowchartTransitionEndpoint(
  element: RenderedDiagramElement,
  key: "connectorSourceId" | "connectorTargetId",
  value: string | undefined
): void {
  if (value !== undefined) {
    element.dataset[key] = value;
  }
}

function readFlowchartTransitionTargets(input: {
  container: HTMLElement;
  renderId: string;
  transition: DiagramElement;
  transitions: DiagramElement[];
}): RenderedDiagramElement[] {
  const { container, renderId, transition, transitions } = input;
  const connectors = Array.from(container.querySelectorAll<RenderedDiagramElement>(FLOWCHART_CONNECTOR_SELECTOR));
  const labels = Array.from(container.querySelectorAll<RenderedDiagramElement>(".edgeLabel"));
  const nodeBounds = readFlowchartNodeBounds(container);
  const sameIdTransitions = transitions.filter((element) => element.renderId === renderId);
  const duplicateIndex = readFlowchartTransitionIndex(sameIdTransitions, transition);
  return [
    ...readFlowchartTransitionConnectors(connectors, { duplicateIndex, nodeBounds, renderId, transition }),
    ...readFlowchartTransitionLabels(labels, { duplicateIndex, renderId, sameIdTransitions })
  ];
}

function readFlowchartTransitionIndex(transitions: DiagramElement[], transition: DiagramElement): number {
  return [...transitions]
    .sort((left, right) => (left.renderOrder ?? 0) - (right.renderOrder ?? 0))
    .findIndex((element) => element.id === transition.id);
}

function readFlowchartTransitionConnectors(
  connectors: RenderedDiagramElement[],
  input: {
    duplicateIndex: number;
    nodeBounds: SvgNodeBounds[];
    renderId: string;
    transition: DiagramElement;
  }
): RenderedDiagramElement[] {
  const matching = connectors.filter((element) => hasFlowchartRenderId(element, input.renderId));
  if (matching.length < 2) {
    return matching;
  }

  const byEndpoints = matching.filter((element) =>
    hasFlowchartTransitionEndpoints(element, input.transition, input.nodeBounds)
  );
  return byEndpoints.length > 0
    ? byEndpoints
    : readOrdinalFlowchartTargets(matching, Math.min(input.duplicateIndex, matching.length - 1));
}

function readFlowchartTransitionLabels(
  labels: RenderedDiagramElement[],
  input: { duplicateIndex: number; renderId: string; sameIdTransitions: DiagramElement[] }
): RenderedDiagramElement[] {
  const matching = labels.filter(
    (element) => hasFlowchartRenderId(element, input.renderId) || hasFlowchartLabelRenderId(element, input.renderId)
  );
  return input.sameIdTransitions.length < 2 ? matching : readOrdinalFlowchartTargets(matching, input.duplicateIndex);
}

function readOrdinalFlowchartTargets(
  elements: RenderedDiagramElement[],
  index: number
): RenderedDiagramElement[] {
  return elements.slice(index, index + 1);
}

function hasFlowchartTransitionEndpoints(
  element: RenderedDiagramElement,
  transition: DiagramElement,
  nodeBounds: SvgNodeBounds[]
): boolean {
  return hasFlowchartTransitionEndpointClasses(element, transition) ||
    hasFlowchartTransitionGeometry(element, transition, nodeBounds);
}

function hasFlowchartTransitionEndpointClasses(element: Element, transition: DiagramElement): boolean {
  return (
    element.classList.contains(`LS-${transition.renderSourceId}`) &&
    element.classList.contains(`LE-${transition.renderTargetId}`)
  );
}

function hasFlowchartTransitionGeometry(
  element: RenderedDiagramElement,
  transition: DiagramElement,
  nodeBounds: SvgNodeBounds[]
): boolean {
  const endpoint = readFlowchartConnectorEndpointFromGeometry(element as SVGElement, nodeBounds);
  return endpoint !== null && endpoint.sourceId === transition.renderSourceId &&
    endpoint.targetId === transition.renderTargetId;
}

function hasFlowchartRenderId(element: Element, renderId: string): boolean {
  return element.getAttribute("data-id") === renderId || element.getAttribute("id") === renderId;
}

function hasFlowchartLabelRenderId(element: Element, renderId: string): boolean {
  return Array.from(element.querySelectorAll("[data-id], [id]")).some((label) =>
    hasFlowchartRenderId(label, renderId)
  );
}

function annotateClassElements(container: HTMLElement, elements: DiagramElement[]): void {
  const renderedClassNodes = Array.from(
    container.querySelectorAll<RenderedDiagramElement>("svg.classDiagram g.node.default")
  );
  const classElements = elements.filter(isClassNodeElement);
  const memberElementGroups = groupClassMemberElements(elements);

  renderedClassNodes.forEach((renderedClassNode) => {
    const classLabel = readClassNodeLabel(renderedClassNode);
    const classElement = classElements.find((candidate) => candidate.label === classLabel);

    if (classElement === undefined) {
      return;
    }

    setDiagramElementDataset(renderedClassNode, classElement);
    annotateClassNodeMembers(renderedClassNode, memberElementGroups.get(classElement.id) ?? []);
  });
}

function annotateEntityRelationshipElements(container: HTMLElement, elements: DiagramElement[]): void {
  const renderedEntities = Array.from(container.querySelectorAll<RenderedDiagramElement>(ER_ENTITY_SELECTOR));
  const entities = elements.filter((element) => element.kind === "node");
  const relationships = elements.filter((element) => element.kind === "relationship");
  const renderedRelationships = Array.from(
    container.querySelectorAll<RenderedDiagramElement>(ER_RELATIONSHIP_SELECTOR)
  );
  const entityTargets = new Map(entities.map((entity) => [
    entity.id,
    renderedEntities.find((rendered) => isRenderedEntity(rendered, entity.id))
  ]));
  entities.forEach((entity) => annotateEntityRelationshipNode(entityTargets.get(entity.id), entity, elements));
  relationships.forEach((relationship) => annotateMatchingRelationship({
    container,
    connectors: renderedRelationships,
    entityTargets,
    relationship
  }));
}

function annotateRequirementElements(container: HTMLElement, elements: DiagramElement[]): void {
  elements.forEach((element) => {
    if (element.kind === "relationship") {
      annotateRequirementRelationship(container, element);
      return;
    }
    const node = Array.from(container.querySelectorAll<RenderedDiagramElement>("svg.requirementDiagram g.node"))
      .find((candidate) => candidate.id === element.id);
    if (node !== undefined) {
      setDiagramElementDataset(node, element);
    }
  });
}

function annotateRequirementRelationship(container: HTMLElement, relationship: DiagramElement): void {
  const renderId = relationship.renderId;
  if (renderId === undefined) {
    return;
  }
  const sourceId = relationship.renderSourceId as string;
  const targetId = relationship.renderTargetId as string;
  const paths = readRequirementRelationshipPaths({ container, renderId, sourceId, targetId });
  const label = readRequirementRelationshipLabel(container, renderId);
  annotateRequirementRelationshipTargets(paths, label, relationship);
}

function readRequirementRelationshipPaths(input: {
  container: HTMLElement;
  renderId: string;
  sourceId: string;
  targetId: string;
}): SVGElement[] {
  const { container, renderId, sourceId, targetId } = input;
  const pathIds = sourceId === targetId
    ? [renderId, `${sourceId}-cyclic-special-1`, `${sourceId}-cyclic-special-2`]
    : [renderId];
  return Array.from(container.querySelectorAll<SVGElement>("svg.requirementDiagram .edgePaths > path"))
    .filter((candidate) => pathIds.includes(candidate.id));
}

function annotateRequirementRelationshipTargets(
  paths: SVGElement[],
  label: SVGElement | undefined,
  relationship: DiagramElement
): void {
  if (paths.length === 0 || label === undefined) {
    return;
  }
  paths.forEach((path) => {
    setDiagramElementDataset(path, relationship);
    path.dataset.requirementSourceId = relationship.renderSourceId as string;
    path.dataset.requirementTargetId = relationship.renderTargetId as string;
  });
  setDiagramElementDataset(label, relationship);
  label.dataset.requirementSourceId = relationship.renderSourceId as string;
  label.dataset.requirementTargetId = relationship.renderTargetId as string;
}

function readRequirementRelationshipLabel(container: HTMLElement, renderId: string): SVGElement | undefined {
  return Array.from(container.querySelectorAll<SVGElement>("svg.requirementDiagram .edgeLabels > .edgeLabel"))
    .find((candidate) => Array.from(candidate.querySelectorAll<SVGElement>(".label[data-id]"))
      .some((label) => label.getAttribute("data-id") === renderId));
}

function setRequirementRelationshipContext(container: HTMLElement, focusGroup: FocusGroup): void {
  const nodes = Array.from(container.querySelectorAll<SVGElement>("svg.requirementDiagram g.node"));
  nodes.forEach((node) => node.removeAttribute("data-requirement-context"));
  if (focusGroup.mode === "empty") {
    return;
  }
  const focusedRelationships = Array.from(
    container.querySelectorAll<SVGElement>('svg.requirementDiagram [data-diagram-element-kind="relationship"]')
  ).filter((element) => focusGroup.elementIds.includes(element.dataset.diagramElementId as string));
  focusedRelationships.forEach((relationship) => markRequirementEndpoints(nodes, relationship));
}

function markRequirementEndpoints(nodes: SVGElement[], relationship: SVGElement): void {
  const endpointIds = [relationship.dataset.requirementSourceId, relationship.dataset.requirementTargetId];
  nodes.filter((node) => endpointIds.includes(node.id)).forEach((node) => {
    node.dataset.requirementContext = "true";
  });
}

function annotateMatchingRelationship(input: {
  connectors: RenderedDiagramElement[];
  container: HTMLElement;
  entityTargets: Map<string, RenderedDiagramElement | undefined>;
  relationship: DiagramElement;
}): void {
  const { connectors: renderedConnectors, container, entityTargets, relationship } = input;
  const connectors = readEntityRelationshipConnectors({ connectors: renderedConnectors, entityTargets, relationship });
  const label = readEntityRelationshipLabel(container, connectors, relationship);
  if (hasMatchingRelationshipTargets({ connectors, entityTargets, label, relationship })) {
    connectors.forEach((connector) => annotateEntityRelationshipConnector(connector, relationship));
    if (label !== undefined) {
      setDiagramElementDataset(label, relationship);
    }
  }
}

function hasMatchingRelationshipTargets(input: {
  connectors: RenderedDiagramElement[];
  entityTargets: Map<string, RenderedDiagramElement | undefined>;
  label: RenderedDiagramElement | undefined;
  relationship: DiagramElement;
}): boolean {
  return hasMatchingEntityRelationshipLabel(input.relationship, input.label) &&
    hasMatchingEntityRelationshipSemantics(input.relationship, input.connectors, input.entityTargets);
}

function hasMatchingEntityRelationshipLabel(
  relationship: DiagramElement,
  label: RenderedDiagramElement | undefined
): boolean {
  return !hasEntityRelationshipRole(relationship.renderLabel) || label !== undefined;
}

function hasEntityRelationshipRole(label: string | undefined): label is string {
  return label !== undefined && label.length > 0;
}

function hasMatchingEntityRelationshipSemantics(
  relationship: DiagramElement,
  connectors: RenderedDiagramElement[],
  entityTargets: Map<string, RenderedDiagramElement | undefined>
): boolean {
  if (!hasRelationshipSemanticMetadata(relationship)) {
    return true;
  }
  const edgeId = readEntityRelationshipEdgeId(entityTargets, relationship);
  return edgeId !== null && hasMatchingEntityRelationshipIdentity(relationship, connectors, edgeId);
}

function hasRelationshipSemanticMetadata(relationship: DiagramElement): boolean {
  return relationship.renderLinkType !== undefined && relationship.renderSourceCardinality !== undefined &&
    relationship.renderTargetCardinality !== undefined;
}

function hasMatchingEntityRelationshipIdentity(
  relationship: DiagramElement,
  connectors: RenderedDiagramElement[],
  edgeId: string
): boolean {
  return relationship.renderSourceId === relationship.renderTargetId
    ? hasMatchingEntityRelationshipLoopSemantics(relationship, connectors, edgeId)
    : hasMatchingEntityRelationshipConnector(relationship, connectors, edgeId);
}

function hasMatchingEntityRelationshipConnector(
  relationship: DiagramElement,
  connectors: RenderedDiagramElement[],
  edgeId: string
): boolean {
  const connector = connectors.find((candidate) => candidate.getAttribute("data-id") === edgeId);
  if (connector === undefined) {
    return false;
  }
  return hasMatchingRelationshipCardinalities(relationship, connector) &&
    hasEntityRelationshipLinkType(connector, relationship.renderLinkType!);
}

function hasMatchingRelationshipCardinalities(relationship: DiagramElement, connector: RenderedDiagramElement): boolean {
  return hasEntityRelationshipCardinality(connector, "marker-start", relationship.renderSourceCardinality!) &&
    hasEntityRelationshipCardinality(connector, "marker-end", relationship.renderTargetCardinality!);
}

function hasMatchingEntityRelationshipLoopSemantics(
  relationship: DiagramElement,
  connectors: RenderedDiagramElement[],
  edgeId: string
): boolean {
  const prefix = edgeId.slice(0, -"mid".length);
  const pair = readLoopConnectorPair(connectors, prefix);
  if (pair === null) {
    return false;
  }
  return hasMatchingLoopCardinalities(relationship, pair.start, pair.end) &&
    hasMatchingLoopLinkType(connectors, relationship);
}

function readLoopConnectorPair(
  connectors: RenderedDiagramElement[],
  prefix: string
): { end: RenderedDiagramElement; start: RenderedDiagramElement } | null {
  const start = connectors.find((connector) => connector.getAttribute("data-id") === `${prefix}1`);
  const end = connectors.find((connector) => connector.getAttribute("data-id") === `${prefix}2`);
  return start === undefined || end === undefined ? null : { end, start };
}

function hasMatchingLoopLinkType(connectors: RenderedDiagramElement[], relationship: DiagramElement): boolean {
  return connectors.every((connector) => hasEntityRelationshipLinkType(connector, relationship.renderLinkType!));
}

function hasMatchingLoopCardinalities(
  relationship: DiagramElement,
  start: RenderedDiagramElement,
  end: RenderedDiagramElement
): boolean {
  return hasEntityRelationshipCardinality(start, "marker-start", relationship.renderSourceCardinality!) &&
    hasEntityRelationshipCardinality(end, "marker-end", relationship.renderTargetCardinality!);
}

function hasEntityRelationshipCardinality(
  connector: RenderedDiagramElement,
  attribute: "marker-end" | "marker-start",
  cardinality: string
): boolean {
  const marker = connector.getAttribute(attribute) ?? "";
  const markerName = readMarkerName(cardinality);
  if (markerName === "") {
    return marker.length === 0;
  }
  return marker.includes(`-${markerName}${readMarkerSuffix(attribute)}`);
}

function readMarkerName(cardinality: string): string {
  return ({
    one: "onlyOne",
    "zero-or-one": "zeroOrOne",
    "zero-or-more": "zeroOrMore",
    "one-or-more": "oneOrMore",
    unknown: ""
  } as Record<string, string>)[cardinality]!;
}

function readMarkerSuffix(attribute: "marker-end" | "marker-start"): string {
  return attribute === "marker-start" ? "Start" : "End";
}

function hasEntityRelationshipLinkType(connector: RenderedDiagramElement, linkType: string): boolean {
  const pattern = linkType === "identifying" ? "edge-pattern-solid" : "edge-pattern-dashed";
  return connector.classList.contains(pattern);
}

function readEntityRelationshipConnectors(input: {
  connectors: RenderedDiagramElement[];
  entityTargets: Map<string, RenderedDiagramElement | undefined>;
  relationship: DiagramElement;
}): RenderedDiagramElement[] {
  const edgeId = readEntityRelationshipEdgeId(input.entityTargets, input.relationship);
  if (edgeId === null) {
    return [];
  }
  const loopPrefix = edgeId.endsWith("-cyclic-special-mid")
    ? edgeId.slice(0, -"mid".length)
    : undefined;
  return input.connectors.filter((candidate) => isEntityRelationshipConnector(candidate, edgeId, loopPrefix));
}

function isEntityRelationshipConnector(
  candidate: RenderedDiagramElement,
  edgeId: string,
  loopPrefix: string | undefined
): boolean {
  const candidateId = candidate.getAttribute("data-id");
  return candidateId === edgeId || hasEntityRelationshipLoopPrefix(candidateId, loopPrefix);
}

function hasEntityRelationshipLoopPrefix(candidateId: string | null, loopPrefix: string | undefined): boolean {
  return loopPrefix !== undefined && candidateId?.startsWith(loopPrefix) === true;
}

function readEntityRelationshipEdgeId(
  entityTargets: Map<string, RenderedDiagramElement | undefined>,
  relationship: DiagramElement
): string | null {
  const source = entityTargets.get(relationship.renderSourceId!);
  const target = entityTargets.get(relationship.renderTargetId!);
  if (source === undefined || target === undefined) {
    return null;
  }
  return createEntityRelationshipEdgeId(source, target, relationship.renderOrder!);
}

function createEntityRelationshipEdgeId(
  source: RenderedDiagramElement,
  target: RenderedDiagramElement,
  renderOrder: number
): string {
  return source.id === target.id
    ? `${source.id}-cyclic-special-mid`
    : `id_${source.id}_${target.id}_${renderOrder}`;
}

function isRenderedEntity(rendered: RenderedDiagramElement, sourceId: string): boolean {
  const prefix = `entity-${sourceId}-`;
  const renderedId = rendered.id;
  const suffix = renderedId.slice(prefix.length);
  return renderedId.startsWith(prefix) && /^\d+$/u.test(suffix);
}

function readEntityRelationshipLabel(
  container: HTMLElement,
  connectors: RenderedDiagramElement[],
  relationship: DiagramElement
): RenderedDiagramElement | undefined {
  const expectedId = readEntityRelationshipEdgeIdFromRelationship(relationship, connectors);
  if (expectedId === null) {
    return undefined;
  }
  return Array.from(container.querySelectorAll<RenderedDiagramElement>("svg .edgeLabels .label[data-id]"))
    .find((label) => label.getAttribute("data-id") === expectedId);
}

function readEntityRelationshipEdgeIdFromRelationship(
  relationship: DiagramElement,
  connectors: RenderedDiagramElement[]
): string | null {
  if (connectors.length === 0) {
    return null;
  }
  if (relationship.renderSourceId === relationship.renderTargetId) {
    return readEntityRelationshipLoopLabelId(connectors);
  }
  return connectors[0]!.getAttribute("data-id");
}

function readEntityRelationshipLoopLabelId(connectors: RenderedDiagramElement[]): string | null {
  const labelConnector = connectors.find((connector) =>
    connector.getAttribute("data-id")?.endsWith("-cyclic-special-mid")
  );
  return labelConnector?.getAttribute("data-id") ?? null;
}

function annotateEntityRelationshipNode(
  renderedEntity: RenderedDiagramElement | undefined,
  entity: DiagramElement,
  elements: DiagramElement[]
): void {
  if (renderedEntity === undefined) {
    return;
  }

  setDiagramElementDataset(renderedEntity, entity);
  elements
    .filter((element) => element.kind === "attribute" && element.renderSourceId === entity.id)
    .forEach((attribute) => annotateEntityRelationshipAttribute(renderedEntity, attribute));
}

function annotateEntityRelationshipAttribute(
  renderedEntity: RenderedDiagramElement,
  attribute: DiagramElement
): void {
  const renderedNames = Array.from(renderedEntity.querySelectorAll<RenderedDiagramElement>("g.attribute-name"));
  const renderedName = readEntityRelationshipAttributeName(renderedNames, attribute);
  const index = renderedNames.indexOf(renderedName!);
  if (index < 0) {
    return;
  }

  annotateEntityRelationshipAttributeColumns(renderedEntity, attribute, index);
  annotateEntityRelationshipAttributeRow(renderedEntity, attribute, index);
}

function readEntityRelationshipAttributeName(
  renderedNames: RenderedDiagramElement[],
  attribute: DiagramElement
): RenderedDiagramElement | undefined {
  const matches = renderedNames.filter((element) => normalizeTextContent(element) === attribute.renderTargetId);
  return matches.at(attribute.renderOrder ?? 0) as RenderedDiagramElement | undefined;
}

function annotateEntityRelationshipAttributeColumns(
  renderedEntity: RenderedDiagramElement,
  attribute: DiagramElement,
  index: number
): void {
  ["attribute-type", "attribute-name", "attribute-keys", "attribute-comment"].forEach((className) => {
    const target = renderedEntity.querySelectorAll<RenderedDiagramElement>(`g.${className}`).item(index) as
      | RenderedDiagramElement
      | null;
    if (target !== null) {
      setDiagramElementDataset(target, attribute);
    }
  });
}

function annotateEntityRelationshipAttributeRow(
  renderedEntity: RenderedDiagramElement,
  attribute: DiagramElement,
  index: number
): void {
  const row = renderedEntity.querySelectorAll<RenderedDiagramElement>(".row-rect-even, .row-rect-odd").item(index) as
    | RenderedDiagramElement
    | null;
  if (row !== null) {
    setDiagramElementDataset(row, attribute);
  }
}

function annotateEntityRelationshipConnector(
  renderedConnector: RenderedDiagramElement | undefined,
  relationship: DiagramElement
): void {
  if (renderedConnector !== undefined) {
    setDiagramElementDataset(renderedConnector, relationship);
    renderedConnector.dataset.connectorRole = "flow";
    setFlowchartTransitionEndpoint(renderedConnector, "connectorSourceId", relationship.renderSourceId);
    setFlowchartTransitionEndpoint(renderedConnector, "connectorTargetId", relationship.renderTargetId);
  }
}

function annotateClassNodeMembers(
  renderedClassNode: RenderedDiagramElement,
  memberElements: DiagramElement[]
): void {
  const renderedMemberLabels = Array.from(
    renderedClassNode.querySelectorAll<RenderedDiagramElement>(".members-group .label, .methods-group .label")
  );

  memberElements.forEach((memberElement) => {
    const renderedMemberLabel = renderedMemberLabels.find(
      (candidate) => normalizeTextContent(candidate) === memberElement.label
    );

    if (renderedMemberLabel === undefined) {
      return;
    }

    setDiagramElementDataset(renderedMemberLabel, memberElement);
  });
}

function groupClassMemberElements(elements: DiagramElement[]): Map<string, DiagramElement[]> {
  const groups = new Map<string, DiagramElement[]>();

  elements.filter(isClassMemberElement).forEach((element) => {
    const classId = readClassMemberClassId(element.id);
    const group = groups.get(classId) ?? [];

    group.push(element);
    groups.set(classId, group);
  });

  return groups;
}

function isClassNodeElement(element: DiagramElement): boolean {
  return !isClassMemberElement(element);
}

function isClassMemberElement(element: DiagramElement): boolean {
  return element.id.includes(".");
}

function readClassMemberClassId(elementId: string): string {
  return elementId.slice(0, elementId.lastIndexOf("."));
}

function annotateSankeyElements(container: HTMLElement, elements: DiagramElement[]): void {
  const renderedNodes = Array.from(container.querySelectorAll<RenderedDiagramElement>(".nodes .node"));
  const renderedLabels = Array.from(container.querySelectorAll<RenderedDiagramElement>(".node-labels text"));

  elements.forEach((element, index) => {
    annotateSankeyRenderedElement(renderedNodes[index], element);
    annotateSankeyRenderedElement(renderedLabels[index], element);
  });
}

function annotateMindmapElements(container: HTMLElement, elements: DiagramElement[]): void {
  const renderedNodes = Array.from(container.querySelectorAll<RenderedDiagramElement>(".mindmap-node"));

  elements.forEach((element, index) => annotateSankeyRenderedElement(renderedNodes[index], element));
}

function annotateSankeyRenderedElement(
  renderedElement: RenderedDiagramElement | undefined,
  element: DiagramElement
): void {
  if (renderedElement !== undefined) {
    setDiagramElementDataset(renderedElement, element);
  }
}

function annotateStateDiagramElements(container: HTMLElement, elements: DiagramElement[]): void {
  const stateElements = elements.filter((element) => element.kind === "state");
  const stateGroups = Array.from(
    container.querySelectorAll<RenderedDiagramElement>(STATE_GROUP_SELECTOR)
  );

  const matchedGroups = new Set<RenderedDiagramElement>();
  stateElements.forEach((element) => annotateRenderedState(stateGroups, matchedGroups, element));
  annotateStateTransitions({
    container,
    stateGroups,
    states: stateElements,
    transitions: elements.filter((element) => element.kind === "transition")
  });
}

function annotateRenderedState(
  stateGroups: RenderedDiagramElement[],
  matchedGroups: Set<RenderedDiagramElement>,
  element: DiagramElement
): void {
  const group = stateGroups.find((candidate) => !matchedGroups.has(candidate) && hasRenderedStateId(candidate, element)) ??
    stateGroups.find((candidate) => !matchedGroups.has(candidate) && hasRenderedStateLabel(candidate, element.label));

  if (group !== undefined) {
    setDiagramElementDataset(group, element);
    matchedGroups.add(group);
  }
}

function hasRenderedStateLabel(group: RenderedDiagramElement, label: string): boolean {
  return Array.from(group.querySelectorAll<RenderedDiagramElement>("text, foreignObject, .nodeLabel")).some(
    (text) => normalizeTextContent(text) === label && text.closest(STATE_GROUP_SELECTOR) === group
  );
}

function hasRenderedStateId(group: RenderedDiagramElement, element: DiagramElement): boolean {
  return hasStateGroupId(group.id, element.renderId) || group.getAttribute("data-id") === element.renderId;
}

function hasStateGroupId(renderedId: string, alias: string | undefined): boolean {
  if (alias === undefined) {return false;}
  const stateId = `state-${alias}`;

  return renderedId === stateId || hasNumberedStateId(renderedId, stateId);
}

function hasNumberedStateId(renderedId: string, stateId: string): boolean {
  const suffix = renderedId.slice(stateId.length);

  return renderedId.startsWith(`${stateId}-`) && /^\d+$/u.test(suffix.slice(1));
}

function annotateStateTransitions(input: {
  container: HTMLElement;
  stateGroups: RenderedDiagramElement[];
  states: DiagramElement[];
  transitions: DiagramElement[];
}): void {
  input.transitions.forEach((transition) => {
    const edgeId = readStateTransitionEdgeId({
      stateGroups: input.stateGroups,
      states: input.states,
      transition
    });
    const paths = readStateTransitionPaths(input.container, edgeId);

    paths.forEach((path) => setDiagramElementDataset(path, transition));

    const label = readStateTransitionLabel(input.container, edgeId);
    if (label !== null) {
      setDiagramElementDataset(label, transition);
    }
  });
}

function readStateTransitionEdgeId(input: {
  stateGroups: RenderedDiagramElement[];
  states: DiagramElement[];
  transition: DiagramElement;
}): string | undefined {
  const { transition } = input;
  if (transition.renderOrder === undefined) {return undefined;}
  return transition.renderSourceId === transition.renderTargetId
    ? readSelfTransitionEdgeId(input)
    : `edge${transition.renderOrder}`;
}

function readSelfTransitionEdgeId(input: {
  stateGroups: RenderedDiagramElement[];
  states: DiagramElement[];
  transition: DiagramElement;
}): string | undefined {
  const sourceState = input.states.find((state) => state.id === input.transition.renderSourceId);
  if (sourceState === undefined) {
    return undefined;
  }
  return readSelfTransitionEdgeIdForState(input.stateGroups, sourceState);
}

function readSelfTransitionEdgeIdForState(
  stateGroups: RenderedDiagramElement[],
  state: DiagramElement
): string | undefined {
  if (state.renderId === undefined) {
    return undefined;
  }

  return stateGroups.some((group) => hasRenderedStateId(group, state))
    ? `${state.renderId}-cyclic-special-mid`
    : undefined;
}

function readStateTransitionPaths(container: HTMLElement, edgeId: string | undefined): SVGElement[] {
  if (edgeId === undefined) {return [];}

  const loopMarker = "-cyclic-special-mid";
  const loopPrefix = edgeId.endsWith(loopMarker) ? edgeId.slice(0, -loopMarker.length) : undefined;

  return Array.from(container.querySelectorAll<SVGElement>("path[data-id]"))
    .filter((path) => isStateTransitionPath(path, edgeId, loopPrefix));
}

function isStateTransitionPath(path: SVGElement, edgeId: string, loopPrefix: string | undefined): boolean {
  if (path.classList.contains("note-edge")) {return false;}
  const pathId = path.getAttribute("data-id");

  return pathId === edgeId || hasStateLoopPathId(pathId, loopPrefix);
}

function hasStateLoopPathId(pathId: string | null, loopPrefix: string | undefined): boolean {
  return loopPrefix !== undefined && pathId?.startsWith(`${loopPrefix}-cyclic-special-`) === true;
}

function readStateTransitionLabel(container: HTMLElement, edgeId: string | undefined): RenderedDiagramElement | null {
  if (edgeId === undefined) {return null;}

  return Array.from(container.querySelectorAll<RenderedDiagramElement>(".edgeLabel > .label[data-id]"))
    .find((label) => label.getAttribute("data-id") === edgeId) ?? null;
}

function annotateFlowchartConnectors(container: HTMLElement, diagram: ResolvedDiagram): void {
  if (diagram.type !== "flowchart") {
    return;
  }

  annotateFlowchartConnectorsFromDom(container);
}

function ensureFlowchartConnectorsAnnotated(container: HTMLElement): void {
  if (!hasUnannotatedFlowchartConnector(container)) {
    return;
  }

  annotateFlowchartConnectorsFromDom(container);
}

function hasUnannotatedFlowchartConnector(container: HTMLElement): boolean {
  return readFlowchartConnectorElements(container).some((element) => element.dataset.connectorRole === undefined);
}

function annotateFlowchartConnectorsFromDom(container: HTMLElement): void {
  const nodeBounds = readFlowchartNodeBounds(container);

  readFlowchartConnectorElements(container).forEach((element, index) => {
    annotateFlowchartConnector(element, nodeBounds, index);
  });
}

function annotateSequenceElements(container: HTMLElement, elements: DiagramElement[]): void {
  const participants = elements.filter((element) => element.kind === "participant");
  const messages = elements.filter((element) => element.kind === "message");

  annotateSequenceParticipants(container, participants);
  annotateSequenceMessages(container, messages);
}

function annotateZenUmlElements(container: HTMLElement, elements: DiagramElement[]): void {
  const renderedTexts = Array.from(container.querySelectorAll<RenderedDiagramElement>("text, foreignObject"));
  const nextMatch = new Map<DiagramElement["kind"], number>([
    ["node", 0], ["participant", 0], ["message", 0], ["group", 0]
  ]);

  elements.forEach((element) => annotateZenUmlElement(renderedTexts, nextMatch, element));
}

function annotateZenUmlElement(
  renderedTexts: RenderedDiagramElement[],
  nextMatch: Map<DiagramElement["kind"], number>,
  element: DiagramElement
): void {
  const matchIndex = readZenUmlMatchIndex(renderedTexts, nextMatch.get(element.kind)!, element);

  if (matchIndex === -1) {
    return;
  }

  const text = renderedTexts[matchIndex]!;
  nextMatch.set(element.kind, matchIndex + 1);
  setDiagramElementDataset(readZenUmlTarget(text), element);
  setDiagramElementDataset(text, element);
}

function readZenUmlTarget(text: RenderedDiagramElement): RenderedDiagramElement {
  const group = text.closest("g");
  return group === null ? text : group;
}

function readZenUmlMatchIndex(
  renderedTexts: RenderedDiagramElement[],
  start: number,
  element: DiagramElement
): number {
  return renderedTexts.findIndex((text, index) => index >= start && isZenUmlLabelMatch(text, element));
}

function isZenUmlLabelMatch(text: RenderedDiagramElement, element: DiagramElement): boolean {
  const rendered = normalizeTextContent(text).toLowerCase();
  const expected = readZenUmlExpectedLabel(element).toLowerCase();

  if (rendered === expected) {
    return true;
  }
  return isZenUmlSubstringMatch(rendered, expected, element.kind);
}

function isZenUmlSubstringMatch(rendered: string, expected: string, kind: DiagramElement["kind"]): boolean {
  return kind !== "participant" && expected.length > 0 && rendered.includes(expected);
}

function readZenUmlExpectedLabel(element: DiagramElement): string {
  return element.kind === "group" ? element.label.replace(/^[^:]+:\s*/u, "") : element.label;
}

function readFlowchartNodeBounds(container: HTMLElement): SvgNodeBounds[] {
  return Array.from(container.querySelectorAll<RenderedDiagramElement>('[data-diagram-element-kind="node"]'))
    .flatMap((element) => {
      const elementId = readDiagramElementId(element);
      const bounds = readSvgNodeBounds(element);

      return bounds === null ? [] : [{ elementId, ...bounds }];
    });
}

function readSvgNodeBounds(
  element: RenderedDiagramElement
): Omit<SvgNodeBounds, "elementId"> | null {
  if (!isSvgGraphicsElement(element)) {
    return null;
  }

  const box = element.getBBox();

  return hasFiniteSvgBounds(box)
    ? {
        height: box.height,
        left: box.x,
        top: box.y,
        width: box.width
      }
    : null;
}

function hasFiniteSvgBounds(box: DOMRect | SVGRect): boolean {
  return [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0;
}

function isSvgGraphicsElement(element: RenderedDiagramElement): element is SVGGraphicsElement {
  return typeof (element as SVGGraphicsElement).getBBox === "function";
}

function readFlowchartConnectorElements(container: HTMLElement): SVGElement[] {
  return Array.from(container.querySelectorAll<SVGElement>(FLOWCHART_CONNECTOR_SELECTOR)).filter(
    (element, index, collection) => collection.indexOf(element) === index
  );
}

function annotateFlowchartConnector(
  element: SVGElement,
  nodeBounds: SvgNodeBounds[],
  index: number
): void {
  const endpoint = readAnnotatedFlowchartTransitionEndpoint(element) ?? readFlowchartConnectorEndpoint(element, nodeBounds);

  if (endpoint === null) {
    return;
  }

  element.dataset.connectorRole = "flow";
  element.dataset.connectorId = `flow-${index}`;
  element.dataset.connectorSourceId = endpoint.sourceId;
  element.dataset.connectorTargetId = endpoint.targetId;
  annotateFlowchartConnectorMarkers(element);
}

function readAnnotatedFlowchartTransitionEndpoint(element: SVGElement): FlowchartConnectorEndpoint | null {
  const sourceId = element.dataset.connectorSourceId;
  const targetId = element.dataset.connectorTargetId;

  return sourceId !== undefined && targetId !== undefined ? { sourceId, targetId } : null;
}

function readFlowchartConnectorEndpoint(
  element: SVGElement,
  nodeBounds: SvgNodeBounds[]
): FlowchartConnectorEndpoint | null {
  return (
    readFlowchartConnectorEndpointFromEdgeId(element, nodeBounds) ??
    readFlowchartConnectorEndpointFromClassNames(element, nodeBounds) ??
    readFlowchartConnectorEndpointFromGeometry(element, nodeBounds)
  );
}

function readFlowchartConnectorEndpointFromEdgeId(
  element: SVGElement,
  nodeBounds: SvgNodeBounds[]
): FlowchartConnectorEndpoint | null {
  const edgeId = readFlowchartConnectorEdgeId(element);

  if (edgeId === null) {
    return null;
  }

  return readConnectorEndpointFromEncodedEdgeId(edgeId, nodeBounds);
}

function readFlowchartConnectorEdgeId(element: SVGElement): string | null {
  return element.getAttribute("data-id") ?? element.getAttribute("id");
}

function readConnectorEndpointFromEncodedEdgeId(
  edgeId: string,
  nodeBounds: SvgNodeBounds[]
): FlowchartConnectorEndpoint | null {
  const normalizedEdgeId = readNormalizedEdgeId(edgeId);
  const elementIds = readSortedElementIds(nodeBounds);
  const sourceId = readEncodedEdgeSourceId(normalizedEdgeId, elementIds);
  const targetId = readEncodedEdgeTargetId(normalizedEdgeId, sourceId);

  return isCompleteEncodedEdgeEndpoint(sourceId, targetId, elementIds)
    ? { sourceId: sourceId as string, targetId: targetId as string }
    : null;
}

function readNormalizedEdgeId(edgeId: string): string | null {
  return edgeId.match(/^L_(.+)_\d+$/u)?.[1] ?? null;
}

function readSortedElementIds(nodeBounds: SvgNodeBounds[]): string[] {
  return nodeBounds.map((bounds) => bounds.elementId).sort((left, right) => right.length - left.length);
}

function readEncodedEdgeSourceId(normalizedEdgeId: string | null, elementIds: string[]): string | null {
  if (normalizedEdgeId === null) {
    return null;
  }

  return (
    elementIds.find((sourceId) => normalizedEdgeId.startsWith(`${sourceId}_`)) ?? null
  );
}

function readEncodedEdgeTargetId(normalizedEdgeId: string | null, sourceId: string | null): string | null {
  return normalizedEdgeId !== null && sourceId !== null ? normalizedEdgeId.slice(`${sourceId}_`.length) : null;
}

function isCompleteEncodedEdgeEndpoint(
  sourceId: string | null,
  targetId: string | null,
  elementIds: string[]
): boolean {
  return (
    hasEncodedEdgeIds(sourceId, targetId) &&
    hasDistinctEncodedEdgeIds(sourceId as string, targetId) &&
    elementIds.includes(targetId)
  );
}

function hasEncodedEdgeIds(sourceId: string | null, targetId: string | null): targetId is string {
  return sourceId !== null && targetId !== null && targetId.length > 0;
}

function hasDistinctEncodedEdgeIds(sourceId: string, targetId: string): boolean {
  return sourceId !== targetId;
}

function readFlowchartConnectorEndpointFromClassNames(
  element: SVGElement,
  _nodeBounds: SvgNodeBounds[]
): FlowchartConnectorEndpoint | null {
  const className = readFlowchartConnectorClassName(element);
  const sourceId = readConnectorClassEndpoint(className, "LS");
  const targetId = readConnectorClassEndpoint(className, "LE");

  return hasDistinctConnectorEndpoints(sourceId, targetId)
    ? {
        sourceId,
        targetId: targetId as string
      }
    : null;
}

function readFlowchartConnectorClassName(element: SVGElement): string {
  return [element.getAttribute("class"), element.parentElement?.getAttribute("class")].filter(Boolean).join(" ");
}

function readFlowchartConnectorEndpointFromGeometry(
  element: SVGElement,
  nodeBounds: SvgNodeBounds[]
): FlowchartConnectorEndpoint | null {
  const points = readFlowchartConnectorPoints(element);

  if (points === null) {
    return null;
  }

  const sourceId = readNearestNodeId(nodeBounds, points.start);
  const targetId = readNearestNodeId(nodeBounds, points.end);

  return hasUsableConnectorEndpoint(sourceId, targetId)
    ? {
        sourceId: sourceId as string,
        targetId: targetId as string
      }
    : null;
}

function readConnectorClassEndpoint(className: string, prefix: "LE" | "LS"): string | null {
  const match = className.match(new RegExp(`(?:^|\\s)${prefix}-([^\\s]+)`));

  return match?.[1] ?? null;
}

function hasDistinctConnectorEndpoints(sourceId: string | null, targetId: string | null): sourceId is string {
  return sourceId !== null && targetId !== null && sourceId !== targetId;
}

function readFlowchartConnectorPoints(
  element: SVGElement
): { end: SvgPointLike; start: SvgPointLike } | null {
  return (
    readSampledConnectorPointsIfPresent(element) ??
    readLineConnectorPoints(element) ??
    readPolylineConnectorPoints(element)
  );
}

function readSampledConnectorPointsIfPresent(element: SVGElement): { end: SvgPointLike; start: SvgPointLike } | null {
  return hasSampledGeometryApi(element) ? readSampledConnectorPoints(element) : null;
}

function readLineConnectorPoints(element: SVGElement): { end: SvgPointLike; start: SvgPointLike } | null {
  return isSvgLineElement(element)
    ? {
        end: readLinePoint(element, "x2", "y2"),
        start: readLinePoint(element, "x1", "y1")
      }
    : null;
}

function readPolylineConnectorPoints(
  element: SVGElement
): { end: SvgPointLike; start: SvgPointLike } | null {
  if (!isSvgPolylineElement(element)) {
    return null;
  }

  const points = readPolylinePoints(element);

  if (points === null) {
    return null;
  }

  return {
    end: points.at(-1) as SvgPointLike,
    start: points[0] as SvgPointLike
  };
}

function hasSampledGeometryApi(
  element: SVGElement
): element is SVGElement & { getPointAtLength(distance: number): DOMPoint; getTotalLength(): number } {
  const shape = element as SVGElement & {
    getPointAtLength?: (distance: number) => DOMPoint;
    getTotalLength?: () => number;
  };

  return typeof shape.getPointAtLength === "function" && typeof shape.getTotalLength === "function";
}

function readSampledConnectorPoints(
  element: SVGElement & { getPointAtLength(distance: number): DOMPoint; getTotalLength(): number }
): { end: SvgPointLike; start: SvgPointLike } | null {
  const totalLength = element.getTotalLength();

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return null;
  }

  return {
    end: readSvgPoint(element.getPointAtLength(totalLength)),
    start: readSvgPoint(element.getPointAtLength(0))
  };
}

function readLinePoint(
  element: SVGElement,
  xAttribute: "x1" | "x2",
  yAttribute: "y1" | "y2"
): SvgPointLike {
  return {
    x: Number(element.getAttribute(xAttribute) ?? 0),
    y: Number(element.getAttribute(yAttribute) ?? 0)
  };
}

function readSvgPoint(point: SvgPointLike | DOMPoint | SVGPoint): SvgPointLike {
  return {
    x: Number(point.x),
    y: Number(point.y)
  };
}

function isSvgLineElement(element: SVGElement): element is SVGLineElement {
  return element.tagName.toLowerCase() === "line";
}

function isSvgPolylineElement(element: SVGElement): element is SVGPolylineElement {
  return element.tagName.toLowerCase() === "polyline";
}

function readPolylinePoints(element: SVGPolylineElement): SvgPointLike[] | null {
  if (hasUsablePolylinePoints(element.points)) {
    return Array.from({ length: element.points.length }, (_, index) => readSvgPoint(element.points.getItem(index)));
  }

  return readPolylinePointsFromAttribute(element.getAttribute("points"));
}

function hasUsablePolylinePoints(points: SVGPointList | undefined): points is SVGPointList {
  return points !== undefined && points.length > 1;
}

function readPolylinePointsFromAttribute(pointsAttribute: string | null): SvgPointLike[] | null {
  if (pointsAttribute === null) {
    return null;
  }

  const points = pointsAttribute
    .trim()
    .split(/\s+/u)
    .map(readPolylineAttributePoint)
    .filter((point): point is SvgPointLike => point !== null);

  return points.length > 1 ? points : null;
}

function readPolylineAttributePoint(segment: string): SvgPointLike | null {
  const [xValue, yValue] = segment.split(",", 2);
  const x = Number(xValue);
  const y = Number(yValue);

  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function readNearestNodeId(nodeBounds: SvgNodeBounds[], point: SvgPointLike): string | null {
  const nearest = nodeBounds.reduce<{ distance: number; elementId: string } | null>((best, current) => {
    const distance = readDistanceToNodeBounds(current, point);

    if (best === null || distance < best.distance) {
      return {
        distance,
        elementId: current.elementId
      };
    }

    return best;
  }, null);

  return nearest === null ? null : nearest.elementId;
}

function readDistanceToNodeBounds(bounds: SvgNodeBounds, point: SvgPointLike): number {
  const horizontal = readAxisDistance(point.x, bounds.left, bounds.left + bounds.width);
  const vertical = readAxisDistance(point.y, bounds.top, bounds.top + bounds.height);

  return Math.hypot(horizontal, vertical);
}

function readAxisDistance(value: number, start: number, end: number): number {
  if (value < start) {
    return start - value;
  }

  if (value > end) {
    return value - end;
  }

  return 0;
}

function hasUsableConnectorEndpoint(sourceId: string | null, targetId: string | null): boolean {
  return sourceId !== null && targetId !== null && sourceId !== targetId;
}

function annotateFlowchartConnectorMarkers(element: SVGElement): void {
  for (const attributeName of FLOWCHART_MARKER_ATTRIBUTES) {
    annotateFlowchartConnectorMarker(element, attributeName);
  }
}

function annotateFlowchartConnectorMarker(
  element: SVGElement,
  attributeName: (typeof FLOWCHART_MARKER_ATTRIBUTES)[number]
): void {
  const markerElement = readLineMarkerElement(element, attributeName);

  if (markerElement === null) {
    return;
  }

  const connectorId = element.dataset.connectorId as string;
  const clonedMarker = readOrCloneConnectorMarker(markerElement, connectorId, attributeName);

  setConnectorMarkerDataset(clonedMarker, element);
  element.setAttribute(attributeName, `url(#${clonedMarker.id})`);
}

function annotateSequenceParticipants(container: HTMLElement, participants: DiagramElement[]): void {
  participants.forEach((participant) => {
    readSequenceParticipantTargets(container, participant.id).forEach((element) => {
      setDiagramElementDataset(element, participant);
    });
  });
}

function annotateSequenceMessages(container: HTMLElement, messages: DiagramElement[]): void {
  const textElements = Array.from(container.querySelectorAll<RenderedDiagramElement>(".messageText"));
  const lineElements = Array.from(
    container.querySelectorAll<RenderedDiagramElement>(".messageLine0, .messageLine1")
  );
  let searchIndex = 0;

  for (const message of messages) {
    const textIndex = findSequenceMessageTextIndex(textElements, message.id, searchIndex);

    if (textIndex === -1) {
      continue;
    }

    searchIndex = textIndex + 1;
    removeSequenceMessageTag(textElements[textIndex]!, message.id);
    setDiagramElementDataset(textElements[textIndex]!, message);
    setSequenceMessageLineDataset(lineElements.at(textIndex), message);
  }
}

function setSequenceMessageLineDataset(
  lineElement: RenderedDiagramElement | undefined,
  message: DiagramElement
): void {
  if (lineElement !== undefined) {
    setDiagramElementDataset(lineElement, message);
    annotateSequenceMessageMarkers(lineElement, message);
  }
}

function annotateSequenceMessageMarkers(
  lineElement: RenderedDiagramElement,
  message: DiagramElement
): void {
  if (!(lineElement instanceof SVGElement)) {
    return;
  }

  for (const attributeName of MESSAGE_MARKER_ATTRIBUTES) {
    annotateSequenceMessageMarker(lineElement, attributeName, message);
  }
}

function annotateSequenceMessageMarker(
  lineElement: SVGElement,
  attributeName: (typeof MESSAGE_MARKER_ATTRIBUTES)[number],
  message: DiagramElement
): void {
  const markerElement = readLineMarkerElement(lineElement, attributeName);

  if (markerElement === null) {
    return;
  }

  const clonedMarker = readOrCloneMessageMarker(markerElement, message.id);

  annotateMessageMarker(clonedMarker, message);
  lineElement.setAttribute(attributeName, `url(#${clonedMarker.id})`);
}

function readLineMarkerElement(
  lineElement: SVGElement,
  attributeName: (typeof MESSAGE_MARKER_ATTRIBUTES)[number]
): SVGMarkerElement | null {
  const markerReference = readMarkerReference(lineElement, attributeName);

  return markerReference === null ? null : readOwnedMarkerElement(lineElement, markerReference);
}

function readOwnedMarkerElement(lineElement: SVGElement, markerId: string): SVGMarkerElement | null {
  const markerElement = readSvgScopedMarkerElement(lineElement, markerId) ?? readDocumentMarkerElement(lineElement, markerId);

  return isSvgMarkerElement(markerElement) ? markerElement : null;
}

function readSvgScopedMarkerElement(lineElement: SVGElement, markerId: string): Element | null {
  return lineElement.ownerSVGElement?.querySelector(`#${markerId}`) ?? null;
}

function readDocumentMarkerElement(lineElement: SVGElement, markerId: string): Element | null {
  return lineElement.ownerDocument.getElementById(markerId);
}

function readMarkerReference(
  lineElement: SVGElement,
  attributeName: (typeof MESSAGE_MARKER_ATTRIBUTES)[number]
): string | null {
  return extractMarkerId(lineElement.getAttribute(attributeName));
}

function extractMarkerId(markerReference: string | null): string | null {
  const trimmedMarkerReference = markerReference?.trim();

  if (trimmedMarkerReference === undefined) {
    return null;
  }

  return readMarkerIdFromUrl(trimmedMarkerReference);
}

function readMarkerIdFromUrl(markerReference: string): string | null {
  const bounds = readMarkerUrlBounds(markerReference);

  if (bounds === null) {
    return null;
  }

  return sanitizeMarkerReference(markerReference.slice(bounds.hashIndex + 1, bounds.closeIndex));
}

function readMarkerUrlBounds(
  markerReference: string
): { closeIndex: number; hashIndex: number } | null {
  const hashIndex = markerReference.indexOf("#");
  const closeIndex = markerReference.lastIndexOf(")");

  return hasInvalidMarkerUrlBounds(hashIndex, closeIndex) ? null : { closeIndex, hashIndex };
}

function hasInvalidMarkerUrlBounds(hashIndex: number, closeIndex: number): boolean {
  return hashIndex === -1 || closeIndex === -1 || hashIndex >= closeIndex;
}

function sanitizeMarkerReference(markerReference: string): string | null {
  const normalizedReference = markerReference.replace(/['"]/gu, "").trim();

  return normalizedReference.length > 0 ? normalizedReference : null;
}

function isSvgMarkerElement(element: Element | null): element is SVGMarkerElement {
  return element?.tagName.toLowerCase() === "marker";
}

function readOrCloneMessageMarker(markerElement: SVGMarkerElement, messageId: string): SVGMarkerElement {
  const clonedMarkerId = createMessageMarkerId(markerElement.id, messageId);
  const existingClone = readExistingClonedMarker(markerElement, clonedMarkerId);

  if (existingClone !== null) {
    return existingClone;
  }

  return cloneMessageMarker(markerElement, clonedMarkerId);
}

function createMessageMarkerId(markerId: string, messageId: string): string {
  return `${markerId}-${messageId}`;
}

function readExistingClonedMarker(
  markerElement: SVGMarkerElement,
  clonedMarkerId: string
): SVGMarkerElement | null {
  return markerElement.ownerSVGElement?.querySelector<SVGMarkerElement>(`#${clonedMarkerId}`) ?? null;
}

function cloneMessageMarker(markerElement: SVGMarkerElement, clonedMarkerId: string): SVGMarkerElement {
  const clonedMarker = markerElement.cloneNode(true) as SVGMarkerElement;

  clonedMarker.id = clonedMarkerId;
  markerElement.parentElement?.append(clonedMarker);

  return clonedMarker;
}

function annotateMessageMarker(markerElement: SVGMarkerElement, message: DiagramElement): void {
  setDiagramElementDataset(markerElement, message);
  setAuxiliaryDiagramElementDataset(markerElement);
  markerElement
    .querySelectorAll<RenderedDiagramElement>("path, line, polygon, polyline, circle, ellipse")
    .forEach((element) => {
      setDiagramElementDataset(element, message);
      setAuxiliaryDiagramElementDataset(element);
    });
}

function readOrCloneConnectorMarker(
  markerElement: SVGMarkerElement,
  connectorId: string,
  attributeName: (typeof FLOWCHART_MARKER_ATTRIBUTES)[number]
): SVGMarkerElement {
  const clonedMarkerId = `${markerElement.id}-${connectorId}-${attributeName}`;
  const existingClone = readExistingClonedMarker(markerElement, clonedMarkerId);

  return existingClone ?? cloneMessageMarker(markerElement, clonedMarkerId);
}

function setConnectorMarkerDataset(markerElement: SVGMarkerElement, connectorElement: SVGElement): void {
  assignConnectorDataset(markerElement, connectorElement);
  setAuxiliaryDiagramElementDataset(markerElement);
  markerElement
    .querySelectorAll<RenderedDiagramElement>("path, line, polygon, polyline, circle, ellipse")
    .forEach((element) => annotateConnectorMarkerChild(element, connectorElement));
}

function annotateConnectorMarkerChild(element: RenderedDiagramElement, connectorElement: SVGElement): void {
  assignConnectorDataset(element, connectorElement);
  setAuxiliaryDiagramElementDataset(element);
}

function assignConnectorDataset(element: RenderedDiagramElement, connectorElement: SVGElement): void {
  element.dataset.connectorRole = "flow-marker";
  element.dataset.connectorId = readConnectorDatasetValue(connectorElement, "connectorId");
  element.dataset.connectorSourceId = readConnectorDatasetValue(connectorElement, "connectorSourceId");
  element.dataset.connectorTargetId = readConnectorDatasetValue(connectorElement, "connectorTargetId");
}

function readConnectorDatasetValue(
  element: SVGElement,
  key: "connectorId" | "connectorSourceId" | "connectorTargetId"
): string {
  return element.dataset[key] as string;
}

function readSequenceParticipantTargets(container: HTMLElement, participantId: string): RenderedDiagramElement[] {
  return Array.from(container.querySelectorAll<RenderedDiagramElement>(`[name="${participantId}"]`)).filter(
    (element) => isSequenceParticipantTarget(element)
  );
}

function isSequenceParticipantTarget(element: RenderedDiagramElement): boolean {
  return element.matches(".actor-top, .actor-bottom") || element.closest(".actor-top, .actor-bottom") !== null;
}

function findSequenceMessageTextIndex(
  textElements: RenderedDiagramElement[],
  messageId: string,
  startIndex: number
): number {
  const marker = `[${messageId}]`;

  for (let index = startIndex; index < textElements.length; index += 1) {
    if (normalizeTextContent(textElements[index]).startsWith(marker)) {
      return index;
    }
  }

  return -1;
}

function removeSequenceMessageTag(element: RenderedDiagramElement, messageId: string): void {
  const marker = `[${messageId}]`;
  const textNodes = readSequenceMessageTextNodes(element);
  const text = textNodes.map((node) => node.textContent!).join("");
  const markerEnd = text.indexOf(marker) + marker.length;
  const messageLabel = text.slice(markerEnd);
  const removeCount = markerEnd + messageLabel.length - messageLabel.trimStart().length;

  removeSequenceTextPrefix(textNodes, removeCount);
}

function readSequenceMessageTextNodes(element: RenderedDiagramElement): Text[] {
  const textWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let textNode = textWalker.nextNode();

  while (textNode !== null) {
    textNodes.push(textNode as Text);
    textNode = textWalker.nextNode();
  }
  return textNodes;
}

function removeSequenceTextPrefix(textNodes: Text[], characterCount: number): void {
  let remainingCharacters = characterCount;

  textNodes.forEach((textNode) => {
    const text = textNode.textContent!;
    const removedCharacters = Math.min(text.length, remainingCharacters);

    textNode.textContent = text.slice(removedCharacters);
    remainingCharacters -= removedCharacters;
  });
}

function normalizeTextContent(element: Element): string {
  return (element.textContent || "").replace(/\s+/gu, " ").trim();
}

function setDiagramElementDataset(element: RenderedDiagramElement, diagramElement: DiagramElement): void {
  element.dataset.diagramElementId = diagramElement.id;
  element.dataset.diagramElementKind = diagramElement.kind;
  element.dataset.diagramElementLabel = diagramElement.label;
  element.dataset.nodeId = diagramElement.id;
  element.dataset.nodeLabel = diagramElement.label;
}

function setAuxiliaryDiagramElementDataset(element: RenderedDiagramElement): void {
  element.dataset.diagramElementAuxiliary = "true";
}

function normalizeRenderedSvg(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>("svg");

  if (svg === null) {
    return;
  }

  const viewBoxSize = readViewBoxSize(svg);

  if (viewBoxSize === null) {
    return;
  }

  svg.setAttribute("width", String(viewBoxSize.width));
  svg.setAttribute("height", String(viewBoxSize.height));
  svg.dataset.intrinsicWidth = String(viewBoxSize.width);
  svg.dataset.intrinsicHeight = String(viewBoxSize.height);
  svg.style.removeProperty("max-width");
}

function injectNodeGradients(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>("svg");

  if (svg === null) {
    return;
  }

  const defs = readOrCreateDefs(svg);

  ensureGradient(defs, {
    endColor: "var(--color-node-focus-fill-strong)",
    id: NODE_FOCUS_GRADIENT_ID,
    startColor: "var(--color-node-focus-fill)"
  });
  ensureGradient(defs, {
    endColor: "var(--color-node-hover-fill-strong)",
    id: NODE_HOVER_GRADIENT_ID,
    startColor: "var(--color-node-hover-fill)"
  });
}

function setFocusState(input: {
  element: RenderedDiagramElement;
  focusGroupMode: FocusGroup["mode"];
  isFocused: boolean;
}): void {
  if (input.focusGroupMode === "empty") {
    clearFocusState(input.element);

    return;
  }

  applyFocusAttributes(input.element, {
    focusGroupMode: input.focusGroupMode,
    isFocused: input.isFocused
  });
}

function createClassStatement(nodeId: string): string {
  return `class ${nodeId} ${createNodeClass(nodeId)};`;
}

function createNodeClass(nodeId: string): string {
  return `${APP_NODE_CLASS_PREFIX}${nodeId}`;
}

function readClassNodeLabel(element: RenderedDiagramElement): string {
  return normalizeTextContent(element.querySelector(".label-group .label") ?? element);
}

function readDiagramElementId(element: RenderedDiagramElement): string {
  return (element.dataset.diagramElementId ?? element.dataset.nodeId) as string;
}

function clearFocusState(element: RenderedDiagramElement): void {
  element.removeAttribute("data-focus-state");
  element.removeAttribute("data-focus-group");
}

function applyFocusAttributes(
  element: RenderedDiagramElement,
  input: {
    focusGroupMode: FocusGroup["mode"];
    isFocused: boolean;
  }
): void {
  element.dataset.focusState = readFocusState(input.isFocused);
  element.dataset.focusGroup = readFocusGroup(input);
}

function readFocusState(isFocused: boolean): string {
  return isFocused ? FOCUSED_STATE : DIMMED_STATE;
}

function readFocusGroup(input: {
  focusGroupMode: FocusGroup["mode"];
  isFocused: boolean;
}): string {
  return input.isFocused ? input.focusGroupMode : "background";
}

function setFocusGroupMetadata(container: HTMLElement, focusGroup: FocusGroup): void {
  if (focusGroup.mode === "empty") {
    container.removeAttribute("data-focus-group-mode");
    container.removeAttribute("data-focus-group-size");

    return;
  }

  container.dataset.focusGroupMode = focusGroup.mode;
  container.dataset.focusGroupSize = String(focusGroup.size);
}

function annotateConnectorLabels(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>(".edgeLabel").forEach((element) => {
    element.dataset.connectorRole = "label";
  });
}

function readOrCreateDefs(svg: SVGSVGElement): SVGDefsElement {
  const existingDefs = svg.querySelector("defs");

  if (isDefsElement(existingDefs)) {
    return existingDefs;
  }

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

  svg.insertBefore(defs, svg.firstChild);

  return defs;
}

function ensureGradient(
  defs: SVGDefsElement,
  input: { endColor: string; id: string; startColor: string }
): void {
  const existingGradient = defs.querySelector(`#${input.id}`);

  if (isLinearGradient(existingGradient)) {
    return;
  }

  defs.appendChild(createGradient(input));
}

function createGradient(input: {
  endColor: string;
  id: string;
  startColor: string;
}): SVGLinearGradientElement {
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");

  gradient.id = input.id;
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("x2", "100%");
  gradient.setAttribute("y2", "100%");
  gradient.appendChild(createGradientStop("0%", input.startColor));
  gradient.appendChild(createGradientStop("100%", input.endColor));

  return gradient;
}

function createGradientStop(offset: string, color: string): SVGStopElement {
  const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");

  stop.setAttribute("offset", offset);
  stop.style.stopColor = color;

  return stop;
}

function isLinearGradient(element: Element | null): element is SVGLinearGradientElement {
  return element?.tagName.toLowerCase() === "lineargradient";
}

function isDefsElement(element: Element | null): element is SVGDefsElement {
  return element?.tagName.toLowerCase() === "defs";
}

function readViewBoxSize(svg: SVGSVGElement): { width: number; height: number } | null {
  const values = readViewBoxValues(svg);

  return values === null ? null : readNormalizedViewBoxSize(values);
}

function readViewBoxValues(svg: SVGSVGElement): number[] | null {
  const viewBox = svg.getAttribute("viewBox");

  if (viewBox === null) {
    return null;
  }

  const values = viewBox
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));

  return values.length === 4 ? values : null;
}

function readPositiveFiniteValue(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readNormalizedViewBoxSize(values: number[]): { width: number; height: number } | null {
  const width = readPositiveFiniteValue(values[2]);

  if (width === null) {
    return null;
  }

  const height = readPositiveFiniteValue(values[3]);

  if (height === null) {
    return null;
  }

  return { width, height };
}

function setConnectorContext(container: HTMLElement, focusGroup: FocusGroup): void {
  const focusedElementIds = new Set(focusGroup.elementIds);

  setConnectorLabelState(container, focusGroup);
  setFlowConnectorState(container, focusGroup, focusedElementIds);
}

function setConnectorLabelState(container: HTMLElement, focusGroup: FocusGroup): void {
  const focusedElementIds = new Set(focusGroup.elementIds);
  container.querySelectorAll<HTMLElement>('[data-connector-role="label"]').forEach((element) => {
    const state = readConnectorLabelState(element, focusGroup, focusedElementIds);
    if (state === null) {
      element.removeAttribute("data-connector-state");

      return;
    }

    element.dataset.connectorState = state;
  });
}

function readConnectorLabelState(
  element: HTMLElement,
  focusGroup: FocusGroup,
  focusedElementIds: Set<string>
): "active" | "context" | null {
  if (focusGroup.mode === "empty") {
    return null;
  }

  return isFocusedConnectorLabel(element, focusedElementIds) ? "active" : "context";
}

function isFocusedConnectorLabel(element: HTMLElement, focusedElementIds: Set<string>): boolean {
  const elementId = element.dataset.diagramElementId;

  return elementId !== undefined && focusedElementIds.has(elementId);
}

function setFlowConnectorState(
  container: HTMLElement,
  focusGroup: FocusGroup,
  focusedElementIds: Set<string>
): void {
  readFlowConnectorTargets(container).forEach((element) => {
    if (focusGroup.mode === "empty") {
      element.removeAttribute("data-connector-state");

      return;
    }

    element.dataset.connectorState = isActiveFlowConnector(element, focusGroup, focusedElementIds)
      ? "active"
      : "context";
  });
}

function readFlowConnectorTargets(container: HTMLElement): NodeListOf<SVGElement> {
  return container.querySelectorAll<SVGElement>('[data-connector-role="flow"], [data-connector-role="flow-marker"]');
}

function isActiveFlowConnector(
  element: SVGElement,
  focusGroup: FocusGroup,
  focusedElementIds: Set<string>
): boolean {
  const elementId = element.dataset.diagramElementId;
  if (isFocusedFlowchartElement(elementId, focusedElementIds)) {
    return true;
  }

  const sourceId = element.dataset.connectorSourceId;
  const targetId = element.dataset.connectorTargetId;
  return shouldEvaluateActiveFlowConnector(focusGroup) && hasFocusedConnectorEndpoints(sourceId, targetId, focusedElementIds);
}

function isFocusedFlowchartElement(elementId: string | undefined, focusedElementIds: Set<string>): boolean {
  return elementId !== undefined && focusedElementIds.has(elementId);
}

function shouldEvaluateActiveFlowConnector(focusGroup: FocusGroup): boolean {
  return focusGroup.mode === "group";
}

function hasFocusedConnectorEndpoints(
  sourceId: string | undefined,
  targetId: string | undefined,
  focusedElementIds: Set<string>
): boolean {
  const hasSource = hasFocusedConnectorEndpoint(sourceId, focusedElementIds);
  const hasTarget = hasFocusedConnectorEndpoint(targetId, focusedElementIds);

  return hasSource && hasTarget;
}

function hasFocusedConnectorEndpoint(
  value: string | undefined,
  focusedElementIds: Set<string>
): boolean {
  return value !== undefined && focusedElementIds.has(value);
}
