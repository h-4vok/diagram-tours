import type Mermaid from "mermaid";
import type { MermaidNode, ResolvedDiagram } from "@diagram-tour/core";

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
  annotateRenderedNodes(input.container, input.diagram.nodes);
}

export function applyFocusState(input: {
  container: HTMLElement;
  focusedNodeIds: string[];
}): void {
  const focusedNodeIds = new Set(input.focusedNodeIds);
  const nodeElements = input.container.querySelectorAll<HTMLElement>("[data-node-id]");

  nodeElements.forEach((element) => {
    setFocusState({
      element,
      isEmptyFocus: focusedNodeIds.size === 0,
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

function setFocusState(input: {
  element: HTMLElement;
  isEmptyFocus: boolean;
  isFocused: boolean;
}): void {
  if (input.isEmptyFocus) {
    input.element.removeAttribute("data-focus-state");

    return;
  }

  input.element.dataset.focusState = input.isFocused ? FOCUSED_STATE : DIMMED_STATE;
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
