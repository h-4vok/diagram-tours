<svelte:options runes={false} />

<script lang="ts">
  import TourPlayer from "$lib/tour-player.svelte";
  import type { ResolvedDiagramTour } from "@diagram-tour/core";

  export let data: {
    selectedSlug: string;
    tour: ResolvedDiagramTour;
  };
</script>

<svelte:head>
  <title>{data.tour.title} | Diagram Tour</title>
  <meta
    name="description"
    content="Diagram Tour documentation player for discovered Mermaid tours."
  />
</svelte:head>

{#key data.selectedSlug}
  <TourPlayer tour={data.tour} />
{/key}
