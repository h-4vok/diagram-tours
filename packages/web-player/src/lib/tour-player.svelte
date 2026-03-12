<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import {
    applyFocusState,
    getMermaidErrorMessage,
    renderMermaidDiagram
  } from "$lib/mermaid-diagram";
  import { createTourPlayer } from "$lib/player-state";
  import type { ResolvedDiagramTour } from "@diagram-tour/core";

  export let tour: ResolvedDiagramTour;
  const player = createTourPlayer(tour);

  let state = player.getState();
  let diagramContainer: HTMLDivElement;
  let diagramError = "";

  function goPrevious(): void {
    state = player.goPrevious();
    syncFocusState();
  }

  function goNext(): void {
    state = player.goNext();
    syncFocusState();
  }

  function syncFocusState(): void {
    applyFocusState({
      container: diagramContainer,
      focusedNodeIds: state.focusedNodeIds
    });
  }

  onMount(async () => {
    try {
      await renderMermaidDiagram({
        container: diagramContainer,
        diagram: tour.diagram
      });
      syncFocusState();
    } catch (_error) {
      diagramError = getMermaidErrorMessage();
      toast.error(diagramError);
    }
  });
</script>

<header class="hero">
  <h1>{tour.title}</h1>
  <p class="lede">A minimal linear player for the resolved diagram tour collection.</p>
</header>

<section class="page__content">
  <aside class="step-panel">
    <p class="step-count">Step {state.step.index} of {tour.steps.length}</p>
    <p data-testid="step-text" class="step-text">{state.step.text}</p>

    <div class="controls">
      <button
        type="button"
        class="button button--secondary"
        onclick={goPrevious}
        disabled={!state.canGoPrevious}
        data-testid="previous-button"
      >
        Previous
      </button>
      <button
        type="button"
        class="button"
        onclick={goNext}
        disabled={!state.canGoNext}
        data-testid="next-button"
      >
        Next
      </button>
    </div>
  </aside>

  <section class="diagram-stage">
    <div class="diagram-shell">
      <div bind:this={diagramContainer} data-testid="diagram-container" class="diagram"></div>
      {#if diagramError.length > 0}
        <p data-testid="diagram-error" class="diagram-error">{diagramError}</p>
      {/if}
    </div>
  </section>
</section>
