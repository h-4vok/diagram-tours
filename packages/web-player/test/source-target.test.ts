import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getSourceTarget } from "../src/lib/source-target";

const ORIGINAL_TARGET = process.env.DIAGRAM_TOUR_SOURCE_TARGET;

afterEach(() => {
  if (ORIGINAL_TARGET === undefined) {
    delete process.env.DIAGRAM_TOUR_SOURCE_TARGET;

    return;
  }

  process.env.DIAGRAM_TOUR_SOURCE_TARGET = ORIGINAL_TARGET;
});

describe("source-target", () => {
  it("uses the environment override when it is provided", () => {
    process.env.DIAGRAM_TOUR_SOURCE_TARGET = "/tmp/custom-source";

    expect(getSourceTarget()).toBe("/tmp/custom-source");
  });

  it("defaults to the examples directory for package-local runtime commands", () => {
    delete process.env.DIAGRAM_TOUR_SOURCE_TARGET;

    expect(getSourceTarget()).toBe(resolve(process.cwd(), "../../examples"));
  });
});
