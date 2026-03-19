import { describe, expect, test } from "vitest";

import {
  describeInteractiveChoices,
  hasExplicitSourceTarget,
  readInteractiveChoice,
  readSourceTarget,
  readViteArgs,
  spawnWebPlayer,
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
    expect(normalizePathForAssertion(validateSourceTarget("./examples", "directory"))).toContain(
      "/examples"
    );
  });

  test("validates any existing target without kind checks", () => {
    expect(normalizePathForAssertion(validateSourceTarget("./examples", "any"))).toContain("/examples");
  });

  test("validates .tour.yaml file targets", () => {
    expect(validateSourceTarget("./fixtures/payment-flow.tour.yaml", "file")).toContain(
      "payment-flow.tour.yaml"
    );
  });

  test("rejects missing paths", () => {
    expect(() => validateSourceTarget("./fixtures/does-not-exist", "any")).toThrow("Path does not exist");
  });

  test("rejects non-tour files when a tour file is required", () => {
    expect(() => validateSourceTarget("./fixtures/payment-flow.mmd", "file")).toThrow(
      "Expected a .tour.yaml file"
    );
  });

  test("rejects directories when a file target is required", () => {
    expect(() => validateSourceTarget("./examples", "file")).toThrow(
      "Expected a file target but received a directory"
    );
  });

  test("rejects files when a directory target is required", () => {
    expect(() => validateSourceTarget("./fixtures/payment-flow.tour.yaml", "directory")).toThrow(
      "Expected a directory target but received a file"
    );
  });

  test("spawns the web player with the resolved source target", () => {
    const originalBun = globalThis.Bun;
    const spawnCalls: Array<{
      args: string[];
      options: Record<string, unknown>;
    }> = [];

    globalThis.Bun = {
      spawn(args: string[], options: Record<string, unknown>) {
        spawnCalls.push({ args, options });

        return { pid: 1 };
      }
    } as typeof Bun;

    try {
      const subprocess = spawnWebPlayer({
        sourceTarget: "./examples",
        viteArgs: ["--host", "0.0.0.0"]
      });

      expect(subprocess).toEqual({ pid: 1 });
      expect(spawnCalls).toHaveLength(1);
      expect(spawnCalls[0]?.args).toEqual([
        process.execPath,
        "run",
        "--cwd",
        "packages/web-player",
        "dev",
        "--host",
        "0.0.0.0"
      ]);
      expect(
        normalizePathForAssertion(
          (spawnCalls[0]?.options.env as Record<string, string>).DIAGRAM_TOUR_SOURCE_TARGET
        )
      ).toContain("/examples");
    } finally {
      globalThis.Bun = originalBun;
    }
  });

  test("keeps extra positional args in vite args after the explicit source target", () => {
    expect(readViteArgs(["./examples", "preview", "--mode", "test"])).toEqual([
      "preview",
      "--mode",
      "test"
    ]);
  });

  test("does not consume the next flag as a value for flags that expect input", () => {
    expect(readViteArgs(["./examples", "--host", "--port", "9000"])).toEqual([
      "--host",
      "--port",
      "9000"
    ]);
  });

  test("does not consume a value for flags outside the known value list", () => {
    expect(readViteArgs(["./examples", "--watch", "true"])).toEqual(["--watch", "true"]);
  });
});

function normalizePathForAssertion(input: string): string {
  return input.replaceAll("\\", "/");
}
