import type Mermaid from "mermaid";
import type { MermaidNode, ResolvedDiagram } from "@diagram-tour/core";
import type { FocusGroup } from "$lib/focus-group";

const APP_NODE_CLASS_PREFIX = "diagram_tour_node_";
const FOCUSED_STATE = "focused";
const DIMMED_STATE = "dimmed";
const MERMAID_ERROR_MESSAGE = "Failed to render Mermaid diagram.";

type MermaidModule = { default: typeof Mermaid };

let mermaidModulePromise: Promise<MermaidModule> | undefined;

export async function renderMermaidDiagram(input: {
  container: HTMLElement;
  diagram: ResolvedDiagram;
}): Promise<void> {
  const mermaid = await loadMermaid();

  mermaid.default.initialize({
    startOnLoad: false
  });

  const renderResult = await renderDiagramSource({
    mermaid,
    source: createRenderableDiagramSource(input.diagram)
  });

  input.container.innerHTML = renderResult.svg;
  normalizeRenderedSvg(input.container);
  annotateRenderedNodes(input.container, input.diagram.nodes);
  annotateConnectorLabels(input.container);
}

export function applyFocusState(input: {
  container: HTMLElement;
  focusGroup: FocusGroup;
}): void {
  const focusedNodeIds = new Set(input.focusGroup.nodeIds);
  const nodeElements = input.container.querySelectorAll<HTMLElement>("[data-node-id]");

  setFocusGroupMetadata(input.container, input.focusGroup);
  setConnectorContext(input.container, input.focusGroup);

  nodeElements.forEach((element) => {
    setFocusState({
      element,
      focusGroupMode: input.focusGroup.mode,
      isFocused: focusedNodeIds.has(readNodeId(element))
    });
  });
}

export function createRenderableDiagramSource(diagram: ResolvedDiagram): string {
  const classStatements = diagram.nodes.map((node) => createClassStatement(node.id));

  return `${diagram.source}\n${classStatements.join("\n")}`;
}

export function getMermaidErrorMessage(): string {
  return MERMAID_ERROR_MESSAGE;
}

async function loadMermaid(): Promise<MermaidModule> {
  mermaidModulePromise ??= import("mermaid") as Promise<MermaidModule>;

  return mermaidModulePromise;
}

function createRenderId(): string {
  return `diagram-tour-${crypto.randomUUID()}`;
}

async function renderDiagramSource(input: {
  mermaid: MermaidModule;
  source: string;
}) {
  try {
    return await input.mermaid.default.render(createRenderId(), input.source);
  } catch (_error) {
    throw new Error(MERMAID_ERROR_MESSAGE);
  }
}

function annotateRenderedNodes(container: HTMLElement, nodes: MermaidNode[]): void {
  nodes.forEach((node) => {
    const element = container.querySelector<HTMLElement>(`.${createNodeClass(node.id)}`);

    if (element === null) {
      return;
    }

    element.dataset.nodeId = node.id;
    element.dataset.nodeLabel = node.label;
  });
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
  svg.style.removeProperty("max-width");
}

function setFocusState(input: {
  element: HTMLElement;
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

function readNodeId(element: HTMLElement): string {
  return element.dataset.nodeId as string;
}

function clearFocusState(element: HTMLElement): void {
  element.removeAttribute("data-focus-state");
  element.removeAttribute("data-focus-group");
}

function applyFocusAttributes(
  element: HTMLElement,
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
  const connectorLabels = container.querySelectorAll<HTMLElement>('[data-connector-role="label"]');

  connectorLabels.forEach((element) => {
    if (focusGroup.mode === "empty") {
      element.removeAttribute("data-connector-state");

      return;
    }

    element.dataset.connectorState = "context";
  });
}
