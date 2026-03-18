import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, parent, url }) => {
  const { collection } = await parent();
  const selectedSlug = params.tourSlug;
  const entry = collection.entries.find(
    (item: (typeof collection.entries)[number]) => item.slug === selectedSlug
  );

  if (entry === undefined) {
    throw error(404, `Unknown tour slug "${selectedSlug}".`);
  }

  return {
    initialStepIndex: readInitialStepIndex(url, entry.tour.steps.length),
    selectedSlug,
    tour: entry.tour
  };
};

function readInitialStepIndex(url: URL, stepCount: number): number {
  const rawStep = Number(url.searchParams.get("step"));

  if (!Number.isInteger(rawStep)) {
    return 0;
  }

  return clampStepIndex(rawStep - 1, stepCount);
}

function clampStepIndex(stepIndex: number, stepCount: number): number {
  if (stepIndex < 0) {
    return 0;
  }

  if (stepIndex >= stepCount) {
    return stepCount - 1;
  }

  return stepIndex;
}
