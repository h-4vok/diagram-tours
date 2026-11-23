<svelte:options runes={false} />

<script lang="ts">
  import TourPlayer from "$lib/tour-player.svelte";
  import { onMount } from "svelte";
  import type { ResolvedDiagramTour, ResolvedDiagramTourCollection } from "@diagram-tour/core";

  export let data: {
    collection: ResolvedDiagramTourCollection;
    initialStepIndex: number;
    selectedSlug: string;
    tour: ResolvedDiagramTour | null;
  };

  let selectedSlug = data.selectedSlug;
  let initialStepIndex = data.initialStepIndex;
  let selectedEntry: ResolvedDiagramTourCollection["entries"][number] | null = null;
  let selectedTour: ResolvedDiagramTour | null = data.tour;

  $: selectedEntry = data.collection.entries.find((entry) => entry.slug === selectedSlug) ?? null;
  $: selectedTour = selectedEntry === null ? data.tour : selectedEntry.tour;

  onMount(() => {
    syncStaticHash();
    window.addEventListener("hashchange", syncStaticHash);

    return () => window.removeEventListener("hashchange", syncStaticHash);
  });

  function syncStaticHash(): void {
    if (!isStaticRuntime()) {
      return;
    }

    const hashState = readHashState(window.location.hash.slice(1));
    selectedSlug = hashState.slug;
    initialStepIndex = hashState.stepIndex;
  }

  function readHashState(hash: string): { slug: string; stepIndex: number } {
    const [rawPath = "", rawQuery = ""] = hash.split("?", 2);
    const hashSlug = rawPath.replace(/^\/+/, "");
    const slug = readHashSlug(hashSlug);

    return { slug, stepIndex: readStepIndex(rawQuery, slug) };
  }

  function readHashSlug(hashSlug: string): string {
    return hashSlug.length === 0 ? data.selectedSlug : hashSlug;
  }

  function readStepIndex(query: string, slug: string): number {
    const entry = data.collection.entries.find((item) => item.slug === slug);
    const rawStep = Number(new URLSearchParams(query).get("step"));
    const lastIndex = (entry === undefined ? 1 : entry.tour.steps.length) - 1;

    if (!Number.isInteger(rawStep)) {
      return 0;
    }

    return Math.max(0, Math.min(rawStep - 1, lastIndex));
  }

  function isStaticRuntime(): boolean {
    return import.meta.env.PUBLIC_DIAGRAM_TOUR_STATIC === "true" ||
      "__DIAGRAM_TOUR_DATA__" in window;
  }
</script>

<svelte:head>
  <title>{selectedTour ? `${selectedTour.title} | Diagram Tour` : "Diagram Tour"}</title>
</svelte:head>

{#if selectedTour}
  {#key selectedSlug}
    <TourPlayer
      initialStepIndex={initialStepIndex}
      selectedSlug={selectedSlug}
      tour={selectedTour}
    />
  {/key}
{:else}
  <p>No tours found.</p>
{/if}
