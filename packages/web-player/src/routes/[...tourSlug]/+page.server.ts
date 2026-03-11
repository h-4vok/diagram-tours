import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, parent }) => {
  const { collection } = await parent();
  const selectedSlug = params.tourSlug;
  const entry = collection.entries.find((item) => item.slug === selectedSlug);

  if (entry === undefined) {
    throw error(404, `Unknown tour slug "${selectedSlug}".`);
  }

  return {
    selectedSlug,
    tour: entry.tour
  };
};
