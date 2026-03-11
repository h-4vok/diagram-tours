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

  export let data: { tour: ResolvedDiagramTour };
  const player = createTourPlayer(data.tour);

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

<div class="page">
  <header class="hero">
    <p class="eyebrow">diagram-tour</p>
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
          onclick={goPrevious}
          disabled={!state.canGoPrevious}
          data-testid="previous-button"
        >
          Previous
        </button>
        <button
          type="button"
          onclick={goNext}
          disabled={!state.canGoNext}
          data-testid="next-button"
        >
          Next
        </button>
      </div>
    </aside>
  </section>

  <section class="diagram-stage">
    <div class="diagram-shell">
      <div bind:this={diagramContainer} data-testid="diagram-container" class="diagram"></div>
      {#if diagramError.length > 0}
        <p data-testid="diagram-error" class="diagram-error">{diagramError}</p>
      {/if}
    </div>
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at top left, rgba(218, 165, 32, 0.2), transparent 30%),
      linear-gradient(180deg, #f7f5ee 0%, #ebe6da 100%);
    color: #18212b;
  }

  .page {
    min-height: 100vh;
    padding: 1.5rem 0.75rem 3rem;
    max-width: 90rem;
    margin: 0 auto;
  }

  .hero,
  .player-meta,
  .diagram-stage {
    width: 100%;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.8rem;
    color: #8a5a44;
  }

  h1 {
    margin: 0;
    font-size: clamp(2.25rem, 6vw, 4rem);
    line-height: 0.95;
  }

  .lede {
    max-width: 44rem;
    font-size: 1rem;
    line-height: 1.6;
    color: #425466;
  }

  .diagram-shell,
  .step-panel {
    padding: 1.25rem;
    border: 1px solid rgba(24, 33, 43, 0.08);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 24px 60px rgba(24, 33, 43, 0.08);
  }

  .player-meta {
    margin-top: 2rem;
    display: flex;
    justify-content: flex-start;
  }

  .diagram-shell {
    margin-top: 1.5rem;
    overflow: auto;
  }

  .diagram {
    min-height: 420px;
  }

  .diagram-error {
    margin: 0.75rem 0 0;
    color: #8f2d19;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  :global([data-node-id]) {
    transition: opacity 120ms ease;
  }

  :global([data-focus-state="focused"]) {
    opacity: 1;
  }

  :global([data-focus-state="dimmed"]) {
    opacity: 0.25;
  }

  .step-count {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #8a5a44;
  }

  .step-text {
    margin: 0.75rem 0 0;
    line-height: 1.65;
    font-size: 1rem;
  }

  .controls {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  button {
    border: 0;
    border-radius: 999px;
    padding: 0.8rem 1.1rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    background: #18212b;
    color: #f8f6f1;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (min-width: 900px) {
    .page {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }

    .step-panel {
      max-width: 28rem;
    }

    .diagram {
      min-height: 520px;
    }
  }
</style>
