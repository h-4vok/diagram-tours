import type { PageLoad } from "./$types";
import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";

export const load: PageLoad = async ({ parent }) => {
  const data = await parent();
  return createRootPageData(data.collection);
};

function createRootPageData(collection: ResolvedDiagramTourCollection) {
  const entry = collection.entries.at(0);
  return {
    collection,
    initialStepIndex: 0,
    selectedSlug: readEntrySlug(entry),
    tour: readEntryTour(entry)
  };
}

function readEntrySlug(entry: ResolvedDiagramTourCollection["entries"][number] | undefined): string {
  return entry?.slug ?? "";
}

function readEntryTour(
  entry: ResolvedDiagramTourCollection["entries"][number] | undefined
): ResolvedDiagramTourCollection["entries"][number]["tour"] | null {
  return entry?.tour ?? null;
}
