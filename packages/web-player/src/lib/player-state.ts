import type { ResolvedDiagramTour, ResolvedTourStep } from "@diagram-tour/core";

export interface TourPlayerState {
  stepIndex: number;
  step: ResolvedTourStep;
  canGoPrevious: boolean;
  canGoNext: boolean;
  focusedNodeIds: string[];
}

export interface TourPlayer {
  getState: () => TourPlayerState;
  goPrevious: () => TourPlayerState;
  goNext: () => TourPlayerState;
  setStepIndex: (stepIndex: number) => TourPlayerState;
}

export function createTourPlayer(
  tour: ResolvedDiagramTour,
  initialStepIndex: number
): TourPlayer {
  let stepIndex = clampStepIndex(initialStepIndex, tour.steps.length);

  return {
    getState: () => createState(tour, stepIndex),
    goPrevious: () => {
      stepIndex = clampStepIndex(stepIndex - 1, tour.steps.length);

      return createState(tour, stepIndex);
    },
    goNext: () => {
      stepIndex = clampStepIndex(stepIndex + 1, tour.steps.length);

      return createState(tour, stepIndex);
    },
    setStepIndex: (nextStepIndex) => {
      stepIndex = clampStepIndex(nextStepIndex, tour.steps.length);

      return createState(tour, stepIndex);
    }
  };
}

function createState(tour: ResolvedDiagramTour, stepIndex: number): TourPlayerState {
  return {
    stepIndex,
    step: tour.steps[stepIndex],
    canGoPrevious: stepIndex > 0,
    canGoNext: stepIndex < tour.steps.length - 1,
    focusedNodeIds: tour.steps[stepIndex].focus.map((node) => node.id)
  };
}

function clampStepIndex(stepIndex: number, stepCount: number): number {
  if (stepIndex < 0) {
    return 0;
  }

  if (stepIndex >= stepCount) {
    return stepCount - 1;
  }

  return stepIndex;
}
