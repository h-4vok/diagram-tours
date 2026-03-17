import { describe, expect, test } from "bun:test";

import {
  describeInteractiveChoices,
  hasExplicitSourceTarget,
  readInteractiveChoice,
  readSourceTarget,
  readViteArgs,
  validateSourceTarget
} from "./dev-web-player-lib";

describe("dev-web-player-lib", () => {
  test("reads an explicit source target when one is provided", () => {
    expect(readSourceTarget(["./examples/payment-flow", "--host", "0.0.0.0"], ".")).toBe(
      "./examples/payment-flow"
    );
  });

  test("falls back to the provided default source target", () => {
    expect(readSourceTarget(["--host", "0.0.0.0"], ".")).toBe(".");
  });

  test("strips the first positional target from vite args", () => {
    expect(readViteArgs(["./examples/payment-flow", "--host", "0.0.0.0"])).toEqual([
      "--host",
      "0.0.0.0"
    ]);
  });

  test("detects whether a source target was explicitly provided", () => {
    expect(hasExplicitSourceTarget(["./examples"])).toBe(true);
    expect(hasExplicitSourceTarget(["--host", "0.0.0.0"])).toBe(false);
  });

  test("maps interactive menu choices to source target modes", () => {
    expect(readInteractiveChoice("1")).toBe("all");
    expect(readInteractiveChoice("2")).toBe("directory");
    expect(readInteractiveChoice("3")).toBe("file");
    expect(readInteractiveChoice("9")).toBeNull();
  });

  test("describes the interactive choices for the prompt", () => {
    expect(describeInteractiveChoices()).toContain("1. Open all tours");
    expect(describeInteractiveChoices()).toContain("2. Open a directory");
    expect(describeInteractiveChoices()).toContain("3. Open a .tour.yaml file");
  });

  test("validates directory targets", () => {
    expect(validateSourceTarget("./examples", "directory")).toContain("\\examples");
  });

  test("validates .tour.yaml file targets", () => {
    expect(validateSourceTarget("./fixtures/payment-flow.tour.yaml", "file")).toContain(
      "payment-flow.tour.yaml"
    );
  });

  test("rejects non-tour files when a tour file is required", () => {
    expect(() => validateSourceTarget("./fixtures/payment-flow.mmd", "file")).toThrow(
      "Expected a .tour.yaml file"
    );
  });
});
