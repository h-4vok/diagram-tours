import type { ResolvedDiagramTour } from "@diagram-tour/core";

export interface NodeStepChoice {
  preview: string;
  stepIndex: number;
  stepNumber: number;
}

export function createDiagramElementStepIndex(tour: ResolvedDiagramTour): Record<string, number[]> {
  return tour.steps.reduce<Record<string, number[]>>((index, step, stepIndex) => {
    step.focus.forEach((element) => {
      const matches = index[element.id] ?? [];

      index[element.id] = [...matches, stepIndex];
    });

    return index;
  }, {});
}

export const createNodeStepIndex = createDiagramElementStepIndex;

export function createNodeStepChoices(
  tour: ResolvedDiagramTour,
  stepIndexes: number[]
): NodeStepChoice[] {
  return stepIndexes.map((stepIndex) => ({
    preview: createStepPreview(tour.steps[stepIndex].text),
    stepIndex,
    stepNumber: tour.steps[stepIndex].index
  }));
}

export function hasNodeStepMatches(
  nodeStepIndex: Record<string, number[]>,
  elementId: string
): boolean {
  return readDiagramElementStepMatches(nodeStepIndex, elementId).length > 0;
}

export function readDiagramElementStepMatches(
  nodeStepIndex: Record<string, number[]>,
  elementId: string
): number[] {
  return nodeStepIndex[elementId] ?? [];
}

export const readNodeStepMatches = readDiagramElementStepMatches;

function createStepPreview(text: string): string {
  return normalizeStepPreview(text).slice(0, 88).trimEnd() + readPreviewSuffix(text);
}

function normalizeStepPreview(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function readPreviewSuffix(text: string): string {
  return normalizeStepPreview(text).length > 88 ? "..." : "";
}
