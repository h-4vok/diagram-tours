import type { ResolvedDiagramTour } from "@diagram-tour/core";

export interface NodeStepChoice {
  preview: string;
  stepIndex: number;
  stepNumber: number;
}

export function createNodeStepIndex(tour: ResolvedDiagramTour): Record<string, number[]> {
  return tour.steps.reduce<Record<string, number[]>>((index, step, stepIndex) => {
    step.focus.forEach((node) => {
      const matches = index[node.id] ?? [];

      index[node.id] = [...matches, stepIndex];
    });

    return index;
  }, {});
}

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
  nodeId: string
): boolean {
  return readNodeStepMatches(nodeStepIndex, nodeId).length > 0;
}

export function readNodeStepMatches(
  nodeStepIndex: Record<string, number[]>,
  nodeId: string
): number[] {
  return nodeStepIndex[nodeId] ?? [];
}

function createStepPreview(text: string): string {
  return normalizeStepPreview(text).slice(0, 88).trimEnd() + readPreviewSuffix(text);
}

function normalizeStepPreview(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function readPreviewSuffix(text: string): string {
  return normalizeStepPreview(text).length > 88 ? "..." : "";
}
