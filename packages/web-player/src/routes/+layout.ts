import { browser } from "$app/environment";
import type { LayoutLoad } from "./$types";
import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";

interface StaticTourPayload {
  version: 1;
  collection: ResolvedDiagramTourCollection;
}

// eslint-disable-next-line complexity
export const load: LayoutLoad = async ({ fetch, data }) => {
  /* c8 ignore next 3 -- browser-only branches are covered by the static runtime smoke test */
  if (!browser) {
    return data;
  }

  const embedded = (globalThis as typeof globalThis & { __DIAGRAM_TOUR_DATA__?: StaticTourPayload }).__DIAGRAM_TOUR_DATA__;
  if (embedded !== undefined) {
    return createStaticLayoutData(embedded);
  }
  if (import.meta.env.PUBLIC_DIAGRAM_TOUR_STATIC !== "true") {
    return data;
  }

  const payload = await fetch("tours-data.json").then((response) => response.json()) as StaticTourPayload;

  return createStaticLayoutData(payload);
};

function createStaticLayoutData(payload: StaticTourPayload): {
  collection: ResolvedDiagramTourCollection;
  sourceTarget: { kind: "directory"; label: string; path: string };
} {
  return {
    collection: payload.collection,
    sourceTarget: { kind: "directory", label: "static build", path: "" }
  };
}
