import type {
  DiagramElement,
  DiagramTour,
  DiagramType,
  ResolvedDiagramTour,
  TourStep
} from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";
import { createClassDiagramModel } from "./class-diagram-model.js";
import { createFlowchartDiagramModel } from "./flowchart-diagram-model.js";
import { createEntityRelationshipDiagramModel } from "./entity-relationship-diagram-model.js";
import { createRequirementDiagramModel } from "./requirement-diagram-model.js";
import { createMindmapDiagramModel } from "./mindmap-diagram-model.js";
import { createSankeyDiagramModel } from "./sankey-diagram-model.js";
import { createSequenceDiagramModel } from "./sequence-diagram-model.js";
import { createStateDiagramModel } from "./state-diagram-model.js";
import { createZenUmlDiagramModel } from "./zenuml-diagram-model.js";
import {
  createStepFieldMessage,
  invariant,
  normalizePath,
  type TourContext
} from "./tour-context.js";

const NODE_REFERENCE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
const SEQUENCE_DIAGRAM_PATTERN = /^[ \t]*sequenceDiagram\b/u;
const MINDMAP_DIAGRAM_PATTERN = /^[ \t]*mindmap\b/u;
const STATE_DIAGRAM_PATTERN = /^[ \t]*stateDiagram-v2\b/u;
const CLASS_DIAGRAM_PATTERN = /^[ \t]*classDiagram\b/u;
const SANKEY_DIAGRAM_PATTERN = /^[ \t]*sankey-beta\b/u;
const ZENUML_DIAGRAM_PATTERN = /^[ \t]*zenuml\b/u;
const ENTITY_RELATIONSHIP_DIAGRAM_PATTERN = /^[ \t]*erDiagram\b/u;
const REQUIREMENT_DIAGRAM_PATTERN = /^[ \t]*requirementDiagram\b/iu;
const FLOWCHART_DIAGRAM_PATTERN = /^[ \t]*(?:flowchart|graph)\b/u;
const MINDMAP_FRONTMATTER_PATTERN = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u;
const MINDMAP_DIRECTIVE_PATTERN = /%%\{[\s\S]*?\}%%/gu;
const DIAGRAM_MODEL_FACTORIES = {
  classDiagram: createClassDiagramDiagramModel,
  erDiagram: createEntityRelationshipDiagramModelAdapter,
  requirementDiagram: createRequirementDiagramModelAdapter,
  flowchart: createFlowchartDiagramModelAdapter,
  mindmap: createMindmapDiagramModelAdapter,
  sankey: createSankeyDiagramModelAdapter,
  sequence: createSequenceDiagramModel,
  stateDiagram: createStateDiagramModel,
  zenuml: createZenUmlDiagramModel
} satisfies Record<DiagramType, (source: string, context: TourContext) => DiagramModel>;
const DIAGRAM_TYPE_PATTERNS = [
  [FLOWCHART_DIAGRAM_PATTERN, "flowchart"],
  [CLASS_DIAGRAM_PATTERN, "classDiagram"],
  [MINDMAP_DIAGRAM_PATTERN, "mindmap"],
  [SEQUENCE_DIAGRAM_PATTERN, "sequence"],
  [STATE_DIAGRAM_PATTERN, "stateDiagram"],
  [SANKEY_DIAGRAM_PATTERN, "sankey"],
  [ZENUML_DIAGRAM_PATTERN, "zenuml"],
  [ENTITY_RELATIONSHIP_DIAGRAM_PATTERN, "erDiagram"],
  [REQUIREMENT_DIAGRAM_PATTERN, "requirementDiagram"]
] as const;

type ElementIndex = Map<string, DiagramElement>;

export function createDiagramModel(source: string, context: TourContext): DiagramModel {
  const type = detectDiagramType(source);

  return DIAGRAM_MODEL_FACTORIES[type](source, context);
}

export function resolveLoadedTour(input: {
  context: TourContext;
  diagramPath: string;
  diagramSource: string;
  rawTour: DiagramTour;
}): ResolvedDiagramTour {
  const diagramModel = createDiagramModel(input.diagramSource, input.context);
  const elementIndex = createElementIndex(diagramModel.elements, diagramModel.type);

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

export function createElementIndex(
  elements: DiagramElement[],
  diagramType: DiagramType
): Map<string, DiagramElement> {
  const index = new Map(elements.map((element) => [element.id, element]));

  if (diagramType !== "sankey") {
    return index;
  }

  elements.forEach((element) => {
    if (!index.has(element.label)) {
      index.set(element.label, element);
    }
  });

  return index;
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
  const cleanedSource = source
    .replace(/^\uFEFF/u, "")
    .replace(MINDMAP_FRONTMATTER_PATTERN, "")
    .replace(MINDMAP_DIRECTIVE_PATTERN, "");
  return cleanedSource
    .split(/\r?\n/u)
    .map((line) => DIAGRAM_TYPE_PATTERNS.find(([pattern]) => pattern.test(line))?.[1])
    .find((type) => type !== undefined) ?? "flowchart";
}

function createClassDiagramDiagramModel(source: string, context: TourContext): DiagramModel {
  return createClassDiagramModel(source, context);
}

function createFlowchartDiagramModelAdapter(source: string): DiagramModel {
  return createFlowchartDiagramModel(source);
}

function createMindmapDiagramModelAdapter(source: string): DiagramModel {
  return createMindmapDiagramModel(source);
}

function createSankeyDiagramModelAdapter(source: string): DiagramModel {
  return createSankeyDiagramModel(source);
}

function createEntityRelationshipDiagramModelAdapter(source: string): DiagramModel {
  return createEntityRelationshipDiagramModel(source);
}

function createRequirementDiagramModelAdapter(source: string): DiagramModel {
  return createRequirementDiagramModel(source);
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
  const targets: Partial<Record<DiagramType, string>> = {
    flowchart: "node ID or transition key",
    erDiagram: "entity ID, attribute key, or relationship key",
    sequence: "participant or message id",
    mindmap: "mindmap topic key",
    requirementDiagram: "requirement ID or relationship key",
    stateDiagram: "state or transition key",
    sankey: "node label",
    zenuml: "ZenUML actor, interaction, or block key"
  };

  return targets[diagramType] ?? "node id";
}
