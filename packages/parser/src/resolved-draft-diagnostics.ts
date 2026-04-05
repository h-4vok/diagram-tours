import type { DiagramType, TourDiagnostic } from "@diagram-tour/core";

import { createElementIndex, createUnknownElementMessage, readTextReferenceIds } from "./diagram-model.js";
import type { AuthoredTourDraft, DiagramModel, StepDraft, StepValueNode } from "./parser-contracts.js";
import {
  appendDiagnostic,
  createSourceLineCounter,
  createTourValidationCollector,
  readNodeLocation,
  type TourContext
} from "./tour-context.js";

export function validateResolvedTourDraft(input: {
  context: TourContext;
  diagramModel: DiagramModel;
  draft: AuthoredTourDraft;
  source: string;
}): TourDiagnostic[] {
  const collector = createTourValidationCollector();
  const elementIndex = createElementIndex(input.diagramModel.elements);
  const lineCounter = createSourceLineCounter(input.source);

  input.draft.steps.forEach((step, index) =>
    validateResolvedDraftStep({
      collector,
      context: input.context,
      diagramType: input.diagramModel.type,
      elementIndex,
      lineCounter,
      step,
      stepIndex: index + 1
    })
  );

  return collector.diagnostics;
}

function validateResolvedDraftStep(input: {
  collector: ReturnType<typeof createTourValidationCollector>;
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: Map<string, { id: string; kind: string; label: string }>;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  step: StepDraft;
  stepIndex: number;
}): void {
  validateFocusReferences({
    collector: input.collector,
    context: input.context,
    diagramType: input.diagramType,
    elementIndex: input.elementIndex,
    focus: input.step.focus,
    focusNodes: input.step.focusNodes,
    lineCounter: input.lineCounter,
    stepIndex: input.stepIndex
  });
  validateTextReferences({
    collector: input.collector,
    context: input.context,
    diagramType: input.diagramType,
    elementIndex: input.elementIndex,
    lineCounter: input.lineCounter,
    stepIndex: input.stepIndex,
    text: input.step.text,
    textNode: input.step.textNode
  });
}

function validateFocusReferences(input: {
  collector: ReturnType<typeof createTourValidationCollector>;
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: Map<string, unknown>;
  focus: string[];
  focusNodes: StepValueNode[];
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  stepIndex: number;
}): void {
  input.focus.forEach((elementId, index) => {
    if (input.elementIndex.has(elementId)) {
      return;
    }

    appendDiagnostic(input.collector, {
      location: readNodeLocation(input.focusNodes[index]!, input.lineCounter),
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "focus",
        stepIndex: input.stepIndex
      })
    });
  });
}

function validateTextReferences(input: {
  collector: ReturnType<typeof createTourValidationCollector>;
  context: TourContext;
  diagramType: DiagramType;
  elementIndex: Map<string, unknown>;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  stepIndex: number;
  text: string;
  textNode: StepValueNode;
}): void {
  for (const elementId of readTextReferenceIds(input.text)) {
    if (input.elementIndex.has(elementId)) {
      continue;
    }

    appendDiagnostic(input.collector, {
      location: readNodeLocation(input.textNode, input.lineCounter),
      message: createUnknownElementMessage({
        context: input.context,
        diagramType: input.diagramType,
        elementId,
        kind: "text",
        stepIndex: input.stepIndex
      })
    });
  }
}
