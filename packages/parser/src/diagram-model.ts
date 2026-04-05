import type {
  DiagramElement,
  DiagramTour,
  DiagramType,
  ResolvedDiagramTour,
  TourStep
} from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";
import { createSequenceDiagramModel } from "./sequence-diagram-model.js";
import {
  createStepFieldMessage,
  invariant,
  normalizePath,
  type TourContext
} from "./tour-context.js";

const FLOWCHART_NODE_PATTERN = /([A-Za-z][A-Za-z0-9_]*)\[([^\]]+)\]/g;
const NODE_REFERENCE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;
const SEQUENCE_DIAGRAM_PATTERN = /^\s*sequenceDiagram\b/mu;

type ElementIndex = Map<string, DiagramElement>;

export function createDiagramModel(source: string, context: TourContext): DiagramModel {
  const type = detectDiagramType(source);

  return type === "sequence"
    ? createSequenceDiagramModel(source, context)
    : createFlowchartDiagramModel(source);
}

export function resolveLoadedTour(input: {
  context: TourContext;
  diagramPath: string;
  diagramSource: string;
  rawTour: DiagramTour;
}): ResolvedDiagramTour {
  const diagramModel = createDiagramModel(input.diagramSource, input.context);
  const elementIndex = createElementIndex(diagramModel.elements);

  return {
    sourceKind: "authored",
    version: input.rawTour.version,
    title: input.rawTour.title,
    diagram: createResolvedDiagram(input.diagramPath, diagramModel),
    steps: resolveLoadedTourSteps(input.rawTour.steps, {
      context: input.context,
      diagramType: diagramModel.type,
      elementIndex
    })
  };
}

export function createGeneratedSteps(
  elements: DiagramElement[],
  title: string
): ResolvedDiagramTour["steps"] {
  return [
    {
      focus: [],
      index: 1,
      text: `Overview of ${title}.`
    },
    ...elements.map((element, index) => ({
      focus: [element],
      index: index + 2,
      text: `Focus on ${element.label}.`
    }))
  ];
}

export function createResolvedDiagram(
  diagramPath: string,
  model: DiagramModel
): ResolvedDiagramTour["diagram"] {
  return {
    elements: model.elements,
    path: normalizePath(diagramPath),
    source: model.renderSource,
    type: model.type
  };
}

export function createElementIndex(elements: DiagramElement[]): Map<string, DiagramElement> {
  return new Map(elements.map((element) => [element.id, element]));
}

export function createUnknownElementMessage(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementId: string;
  kind: "focus" | "text";
  stepIndex: number;
}): string {
  return createStepFieldMessage(
    input,
    input.kind,
    `references unknown Mermaid ${readUnknownElementTarget(input.diagramType)} "${input.elementId}"`
  );
}

export function readTextReferenceIds(text: string): string[] {
  return [...text.matchAll(NODE_REFERENCE_PATTERN)].map((match) => match[1]);
}

function detectDiagramType(source: string): DiagramType {
  return SEQUENCE_DIAGRAM_PATTERN.test(source) ? "sequence" : "flowchart";
}

function createFlowchartDiagramModel(source: string): DiagramModel {
  return {
    elements: extractFlowchartElements(source),
    renderSource: source,
    type: "flowchart"
  };
}

function extractFlowchartElements(source: string): DiagramElement[] {
  const elements = new Map<string, DiagramElement>();

  for (const match of source.matchAll(FLOWCHART_NODE_PATTERN)) {
    elements.set(match[1], {
      id: match[1],
      kind: "node",
      label: match[2].trim()
    });
  }

  return Array.from(elements.values());
}

function resolveLoadedTourSteps(
  steps: TourStep[],
  input: {
    context: TourContext;
    diagramType: DiagramType;
    elementIndex: ElementIndex;
  }
): ResolvedDiagramTour["steps"] {
  return steps.map((step, index) =>
    resolveTourStep({
      context: input.context,
      diagramType: input.diagramType,
      elementIndex: input.elementIndex,
      step,
      stepIndex: index + 1
    })
  );
}

function resolveTourStep(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  step: TourStep;
  stepIndex: number;
}) {
  return {
    index: input.stepIndex,
    focus: resolveFocusElements(input),
    text: resolveTextReferences(input)
  };
}

function resolveFocusElements(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  step: TourStep;
  stepIndex: number;
}): DiagramElement[] {
  return input.step.focus.map((elementId) =>
    resolveElement({
      elementId,
      elementIndex: input.elementIndex,
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "focus",
        stepIndex: input.stepIndex
      })
    })
  );
}

function resolveTextReferences(input: {
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: ElementIndex;
  step: TourStep;
  stepIndex: number;
}): string {
  return input.step.text.replaceAll(NODE_REFERENCE_PATTERN, (_match, elementId: string) =>
    resolveElement({
      elementId,
      elementIndex: input.elementIndex,
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "text",
        stepIndex: input.stepIndex
      })
    }).label
  );
}

function resolveElement(input: {
  elementId: string;
  elementIndex: ElementIndex;
  message: string;
}): DiagramElement {
  const element = input.elementIndex.get(input.elementId);

  invariant(element !== undefined, input.message);

  return element;
}

function readUnknownElementTarget(diagramType: DiagramType): string {
  return diagramType === "sequence" ? "participant or message id" : "node id";
}
