import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const prerender = Boolean(process.env.DIAGRAM_TOUR_STATIC_OUT);

export const load: PageServerLoad = async ({ parent }) => {
  const { collection } = await parent();

  if (!process.env.DIAGRAM_TOUR_STATIC_OUT) {
    throw redirect(307, `/${collection.entries[0].slug}`);
  }

  return {};
};
