<svelte:options runes={false} />

<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";

  export let data: {
    collection: ResolvedDiagramTourCollection;
  };

  const fallbackTour = data.collection.entries[0];
  const resolvedStatus = page.status;
  const resolvedMessage = page.error?.message ?? "Unknown tour.";
</script>

<svelte:head>
  <title>{resolvedStatus} | Diagram Tour</title>
</svelte:head>

<section class="hero">
  <p class="step-count">{resolvedStatus}</p>
  <h1>Tour not found</h1>
  <p class="lede">
    We could not find the tour you requested. The docs shell is still available, and you can jump
    back into a valid walkthrough from here.
  </p>
</section>

<section class="page__content">
  <div class="step-panel error-panel">
    <p class="step-text error-panel__message">{resolvedMessage}</p>

    <div class="controls error-actions">
      <a
        class="button error-actions__button error-actions__button--primary"
        href={resolve(`/${fallbackTour.slug}`)}
      >
        Back to Tours
      </a>
    </div>
  </div>
</section>
