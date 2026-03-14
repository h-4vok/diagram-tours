<svelte:options runes={false} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import {
    applyFocusState,
    getMermaidErrorMessage,
    renderMermaidDiagram
  } from "$lib/mermaid-diagram";
  import { focusDiagramViewport } from "$lib/diagram-viewport";
  import { createFocusGroup } from "$lib/focus-group";
  import { createTourPlayer } from "$lib/player-state";
  import type { ResolvedDiagramTour } from "@diagram-tour/core";

  export let initialStepIndex: number;
  export let selectedSlug: string;
  export let tour: ResolvedDiagramTour;
  const player = createTourPlayer(tour, initialStepIndex);

  let state = player.getState();
  let diagramContainer: HTMLDivElement;
  let diagramContent: HTMLDivElement;
  let diagramError = "";
  let hasRenderedDiagram = false;
  let previousInitialStepIndex = initialStepIndex;

  async function goPrevious(): Promise<void> {
    state = player.goPrevious();
    await syncFocusState();
    await navigateToStep(state.step.index);
  }

  async function goNext(): Promise<void> {
    state = player.goNext();
    await syncFocusState();
    await navigateToStep(state.step.index);
  }

  async function syncFocusState(): Promise<void> {
    if (!hasRenderedDiagram) {
      return;
    }

    await waitForDiagramLayout();

    const currentContext = readDiagramContext();

    if (currentContext === null) {
      return;
    }

    const focusGroup = createFocusGroup(state.focusedNodeIds);

    applyFocusState({
      container: currentContext.container,
      focusGroup
    });
    focusDiagramViewport({
      container: currentContext.container,
      content: currentContext.content,
      focusGroup
    });
  }

  onMount(async () => {
    try {
      await renderMermaidDiagram({
        container: diagramContent,
        diagram: tour.diagram
      });
      hasRenderedDiagram = true;
      await syncFocusState();
    } catch (_error) {
      diagramError = getMermaidErrorMessage();
      toast.error(diagramError);
    }
  });

  $: if (initialStepIndex !== previousInitialStepIndex) {
    previousInitialStepIndex = initialStepIndex;
    state = player.setStepIndex(initialStepIndex);
    void syncFocusState();
  }

  async function navigateToStep(stepIndex: number): Promise<void> {
    await goto(resolve(`/${selectedSlug}?step=${stepIndex}`), {
      invalidateAll: false,
      keepFocus: true,
      noScroll: true
    });
  }

  function waitForDiagramLayout(): Promise<void> {
    return new Promise((resolveLayout) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolveLayout();
        });
      });
    });
  }

  function readDiagramContext(): {
    container: HTMLDivElement;
    content: HTMLDivElement;
  } | null {
    const container = readBoundElement(diagramContainer);
    const content = readBoundElement(diagramContent);

    return container !== null && content !== null ? { container, content } : null;
  }

  function readBoundElement<T extends HTMLElement>(value: T | undefined): T | null {
    return value ?? null;
  }
</script>

<section class="player-canvas" data-testid="player-canvas">
  <div class="diagram-shell diagram-shell--canvas" data-testid="diagram-shell">
    <div class="tour-identity" data-testid="tour-identity">
      <p class="tour-identity__label">Current tour</p>
      <p class="tour-identity__title">{tour.title}</p>
    </div>

    <div bind:this={diagramContainer} data-testid="diagram-container" class="diagram">
      <div
        bind:this={diagramContent}
        data-testid="diagram-stage-inner"
        class="diagram-stage-inner"
      ></div>
    </div>

    <aside class="step-panel step-panel--overlay" data-testid="step-overlay">
      <p class="step-count">Step {state.step.index} of {tour.steps.length}</p>
      <p data-testid="step-text" class="step-text">{state.step.text}</p>

      <div class="controls">
        <button
          type="button"
          class="button button--secondary"
          on:click={goPrevious}
          disabled={!state.canGoPrevious}
          data-testid="previous-button"
        >
          Previous
        </button>
        <button
          type="button"
          class="button"
          on:click={goNext}
          disabled={!state.canGoNext}
          data-testid="next-button"
        >
          Next
        </button>
      </div>
    </aside>

    {#if diagramError.length > 0}
      <p data-testid="diagram-error" class="diagram-error diagram-error--overlay">{diagramError}</p>
    {/if}
  </div>
</section>
