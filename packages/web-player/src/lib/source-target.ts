import { resolve } from "node:path";

const DEFAULT_SOURCE_TARGET = resolve(process.cwd(), "../../examples");

export function getSourceTarget(): string {
  return process.env.DIAGRAM_TOUR_SOURCE_TARGET ?? DEFAULT_SOURCE_TARGET;
}
