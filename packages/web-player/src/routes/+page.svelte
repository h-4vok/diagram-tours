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
  import { DEFAULT_THEME, getThemeToggleLabel, toggleTheme } from "$lib/theme";
  import type { ResolvedDiagramTour } from "@diagram-tour/core";

  export let data: { tour: ResolvedDiagramTour };
  const player = createTourPlayer(data.tour);

  let state = player.getState();
  let diagramContainer: HTMLDivElement;
  let diagramError = "";
  let theme = DEFAULT_THEME;

  function goPrevious(): void {
    state = player.goPrevious();
    syncFocusState();
  }

  function goNext(): void {
    state = player.goNext();
    syncFocusState();
  }

  function handleThemeToggle(): void {
    theme = toggleTheme(theme);
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
        diagram: data.tour.diagram
      });
      syncFocusState();
    } catch (_error) {
      diagramError = getMermaidErrorMessage();
      toast.error(diagramError);
    }
  });
</script>

<svelte:head>
  <title>{data.tour.title} | Diagram Tour</title>
  <meta
    name="description"
    content="Linear Mermaid tour player for the payment-flow example."
  />
</svelte:head>

<div class="theme-root" data-theme={theme} data-testid="theme-root">
  <div class="page">
    <section class="page__header">
      <header class="hero">
        <div class="hero__bar">
          <p class="eyebrow">diagram-tour</p>
          <button
            type="button"
            class="button button--secondary theme-toggle"
            data-testid="theme-toggle"
            onclick={handleThemeToggle}
          >
            {getThemeToggleLabel(theme)}
          </button>
        </div>
        <h1>{data.tour.title}</h1>
        <p class="lede">A minimal linear player for the resolved payment-flow example.</p>
      </header>

      <section class="player-meta">
        <aside class="step-panel">
          <p class="step-count">Step {state.step.index} of {data.tour.steps.length}</p>
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
      </section>
    </section>

    <section class="page__content">
      <section class="diagram-stage">
        <div class="diagram-shell">
          <div bind:this={diagramContainer} data-testid="diagram-container" class="diagram"></div>
          {#if diagramError.length > 0}
            <p data-testid="diagram-error" class="diagram-error">{diagramError}</p>
          {/if}
        </div>
      </section>
    </section>
  </div>
</div>
