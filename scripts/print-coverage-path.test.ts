import { describe, expect, test } from "vitest";

import { readCoveragePathMessage } from "./print-coverage-path-lib";

describe("readCoveragePathMessage", () => {
  test("prints the canonical dashboard path", () => {
    expect(readCoveragePathMessage()).toBe("Unified coverage dashboard: coverage/index.html");
  });
});
