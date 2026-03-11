import { resolve } from "node:path";

import { loadResolvedTour } from "@diagram-tour/parser";
import type { PageServerLoad } from "./$types";

const PAYMENT_FLOW_TOUR_PATH = resolve(
  process.cwd(),
  "../../examples/payment-flow/payment-flow.tour.yaml"
);

export const load: PageServerLoad = async () => {
  const tour = await loadResolvedTour(PAYMENT_FLOW_TOUR_PATH);

  return {
    tour
  };
};
