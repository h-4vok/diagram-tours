import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { collection } = await parent();

  throw redirect(307, `/${collection.entries[0].slug}`);
};
