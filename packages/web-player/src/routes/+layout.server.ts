import { loadResolvedTourCollection } from "@diagram-tour/parser";
import type { LayoutServerLoad } from "./$types";

import { getSourceTarget, getSourceTargetInfo } from "$lib/source-target";

export const load: LayoutServerLoad = async () => {
  const collection = await loadResolvedTourCollection(getSourceTarget());
  const sourceTarget = getSourceTargetInfo();

  return {
    collection,
    sourceTarget
  };
};
