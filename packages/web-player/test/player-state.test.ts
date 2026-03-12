import { describe, expect, it } from "vitest";

import { createTourPlayer } from "../src/lib/player-state";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

describe("createTourPlayer", () => {
  it("starts on the first step", () => {
    const player = createTourPlayer(resolvedPaymentFlowTour, 0);

    expect(player.getState()).toEqual({
      stepIndex: 0,
      step: resolvedPaymentFlowTour.steps[0],
      canGoPrevious: false,
      canGoNext: true,
      focusedNodeIds: ["api_gateway"]
    });
  });

  it("moves to the next and previous step within bounds", () => {
    const player = createTourPlayer(resolvedPaymentFlowTour, 0);

    expect(player.goNext().step.index).toBe(2);
    expect(player.goPrevious().step.index).toBe(1);
  });

  it("does not move before the first step or after the last step", () => {
    const player = createTourPlayer(resolvedPaymentFlowTour, 0);

    expect(player.goPrevious().step.index).toBe(1);
    player.goNext();
    player.goNext();
    player.goNext();

    expect(player.goNext()).toEqual({
      stepIndex: 3,
      step: resolvedPaymentFlowTour.steps[3],
      canGoPrevious: true,
      canGoNext: false,
      focusedNodeIds: ["response"]
    });
  });
});
