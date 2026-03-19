import type Mermaid from "mermaid";
import type { DiagramElement, ResolvedDiagram } from "@diagram-tour/core";

import type { FocusGroup } from "$lib/focus-group";

const APP_NODE_CLASS_PREFIX = "diagram_tour_node_";
const FOCUSED_STATE = "focused";
const DIMMED_STATE = "dimmed";
const MERMAID_ERROR_MESSAGE = "Failed to render Mermaid diagram.";
const NODE_FOCUS_GRADIENT_ID = "diagram-tour-node-focus-gradient";
const NODE_HOVER_GRADIENT_ID = "diagram-tour-node-hover-gradient";

type MermaidModule = { default: typeof Mermaid };
type RenderedDiagramElement = HTMLElement | SVGElement;

const MESSAGE_MARKER_ATTRIBUTES = ["marker-start", "marker-mid", "marker-end"] as const;

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
  injectNodeGradients(input.container);
  annotateRenderedElements(input.container, input.diagram);
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

  setFocusGroupMetadata(input.container, input.focusGroup);
  setConnectorContext(input.container, input.focusGroup);

  diagramElements.forEach((element) => {
    setFocusState({
      element,
      focusGroupMode: input.focusGroup.mode,
      isFocused: focusedElementIds.has(readDiagramElementId(element))
    });
  });
}

export function createRenderableDiagramSource(diagram: ResolvedDiagram): string {
  if (diagram.type === "sequence") {
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

function annotateRenderedElements(container: HTMLElement, diagram: ResolvedDiagram): void {
  if (diagram.type === "sequence") {
    annotateSequenceElements(container, diagram.elements);

    return;
  }

  annotateFlowchartElements(container, diagram.elements);
}

function annotateFlowchartElements(container: HTMLElement, elements: DiagramElement[]): void {
  elements.forEach((element) => {
    const renderedElement = container.querySelector<RenderedDiagramElement>(`.${createNodeClass(element.id)}`);

    if (renderedElement === null) {
      return;
    }

    setDiagramElementDataset(renderedElement, element);
  });
}

function annotateSequenceElements(container: HTMLElement, elements: DiagramElement[]): void {
  const participants = elements.filter((element) => element.kind === "participant");
  const messages = elements.filter((element) => element.kind === "message");

  annotateSequenceParticipants(container, participants);
  annotateSequenceMessages(container, messages);
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
    const textIndex = findSequenceMessageTextIndex(textElements, message.label, searchIndex);

    if (textIndex === -1) {
      continue;
    }

    searchIndex = textIndex + 1;
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

function readSequenceParticipantTargets(container: HTMLElement, participantId: string): RenderedDiagramElement[] {
  return Array.from(container.querySelectorAll<RenderedDiagramElement>(`[name="${participantId}"]`)).filter(
    (element) =>
      element.matches(".actor-top, .actor-bottom") ||
      element.closest(".actor-top, .actor-bottom") !== null
  );
}

function findSequenceMessageTextIndex(
  textElements: RenderedDiagramElement[],
  label: string,
  startIndex: number
): number {
  for (let index = startIndex; index < textElements.length; index += 1) {
    if (normalizeTextContent(textElements[index]) === label) {
      return index;
    }
  }

  return -1;
}

function normalizeTextContent(element: RenderedDiagramElement): string {
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
  const connectorLabels = container.querySelectorAll<HTMLElement>('[data-connector-role="label"]');

  connectorLabels.forEach((element) => {
    if (focusGroup.mode === "empty") {
      element.removeAttribute("data-connector-state");

      return;
    }

    element.dataset.connectorState = "context";
  });
}
