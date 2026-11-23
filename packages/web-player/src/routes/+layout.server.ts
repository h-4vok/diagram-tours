import { readFile } from "node:fs/promises";
import type { LayoutServerLoad } from "./$types";

import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
import { loadResolvedTourCollection } from "@diagram-tour/parser";
import { getSourceTarget, getSourceTargetInfo } from "$lib/source-target";

interface StaticTourPayload {
  version: 1;
  collection: ResolvedDiagramTourCollection;
}

export const load: LayoutServerLoad = async () => {
  const collection = process.env.DIAGRAM_TOUR_STATIC_OUT
    ? await readStaticCollection()
    : await loadResolvedTourCollection(getSourceTarget());

  return {
    collection,
    sourceTarget: getSourceTargetInfo()
  };
};

async function readStaticCollection(): Promise<ResolvedDiagramTourCollection> {
  /* c8 ignore next -- static generation always provides an explicit payload path */
  const payloadPath = process.env.DIAGRAM_TOUR_STATIC_DATA ?? "static/tours-data.json";
  const payload = JSON.parse(await readFile(payloadPath, "utf8")) as StaticTourPayload;
  return payload.collection;
}
