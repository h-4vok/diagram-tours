import type * as FsPromises from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { validateResolvedTourTargets } from "../src/index.js";
import {
  DISCOVERY_FIXTURE_ROOT,
  FIXTURE_TOUR_PATH,
  createTempDiagramDirectory,
  normalizePath,
  restoreParserTestState
} from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser validation targets", () => {
  it("treats dot as the current working directory discovery root", async () => {
    process.chdir(DISCOVERY_FIXTURE_ROOT);

    const report = await validateResolvedTourTargets([]);

    expect(report).toMatchObject({
      total: 4,
      valid: 3
    });
    expect(report.issues).toHaveLength(2);
  });

  it("validates dot and returns discovery issues without dropping skipped tours", async () => {
    process.chdir(DISCOVERY_FIXTURE_ROOT);

    const report = await validateResolvedTourTargets([]);

    expect(report.issues[0]).toMatchObject({
      diagnostic: {
        code: null,
        location: { column: 10, line: 6 },
        message: 'step 1 focus references unknown Mermaid node id "missing_node"'
      },
      sourcePath: "invalid-tour/invalid.tour.yaml"
    });
    expect(report.issues[1]).toMatchObject({
      diagnostic: {
        code: null,
        location: { column: 12, line: 7 },
        message: 'step 1 text references unknown Mermaid node id "missing_node"'
      },
      sourcePath: "invalid-tour/invalid.tour.yaml"
    });
  });

  it("dedupes overlapping validation targets", async () => {
    const report = await validateResolvedTourTargets([
      DISCOVERY_FIXTURE_ROOT,
      DISCOVERY_FIXTURE_ROOT
    ]);

    expect(report).toMatchObject({
      total: 4,
      valid: 3
    });
    expect(report.issues).toHaveLength(2);
    expect(report.issues[0]?.sourcePath).toBe("invalid-tour/invalid.tour.yaml");
  });

  it("reports a missing validation target", async () => {
    const missingTarget = "./missing-tour";

    const report = await validateResolvedTourTargets([missingTarget]);

    expect(report).toEqual({
      issues: [
        {
          diagnostic: {
            code: null,
            location: null,
            message: `Path does not exist: ${normalizePath(resolve(missingTarget))}`
          },
          sourceId: normalizePath(resolve(missingTarget)),
          sourcePath: normalizePath(missingTarget)
        }
      ],
      total: 0,
      valid: 0
    });
  });

  it("reports an unsupported validation target", async () => {
    const unsupportedTarget = "./package.json";

    const report = await validateResolvedTourTargets([unsupportedTarget]);

    expect(report).toEqual({
      issues: [
        {
          diagnostic: {
            code: null,
            location: null,
            message: `Expected a .tour.yaml, .mmd, .mermaid, .md file, or a directory: ${normalizePath(resolve(unsupportedTarget))}`
          },
          sourceId: normalizePath(resolve(unsupportedTarget)),
          sourcePath: normalizePath(unsupportedTarget)
        }
      ],
      total: 0,
      valid: 0
    });
  });

  it("validates a direct invalid file target", async () => {
    const invalidFilePath = resolve(DISCOVERY_FIXTURE_ROOT, "./invalid-tour/invalid.tour.yaml");

    const report = await validateResolvedTourTargets([invalidFilePath]);

    expect(report).toMatchObject({
      total: 1,
      valid: 0
    });
    expect(report.issues).toHaveLength(2);
    expect(report.issues[0]).toMatchObject({
      diagnostic: {
        code: null,
        location: { column: 10, line: 6 },
        message: 'step 1 focus references unknown Mermaid node id "missing_node"'
      },
      sourceId: normalizePath(invalidFilePath),
      sourcePath: "invalid.tour.yaml"
    });
    expect(report.issues[1]).toMatchObject({
      diagnostic: {
        code: null,
        location: { column: 12, line: 7 },
        message: 'step 1 text references unknown Mermaid node id "missing_node"'
      },
      sourceId: normalizePath(invalidFilePath),
      sourcePath: "invalid.tour.yaml"
    });
  });

  it("validates a direct valid file target", async () => {
    const report = await validateResolvedTourTargets([FIXTURE_TOUR_PATH]);

    expect(report).toEqual({
      issues: [],
      total: 1,
      valid: 1
    });
  });

  it("reports a generic issue when a folder has no supported tours", async () => {
    const emptyRoot = await createTempDiagramDirectory({});

    const report = await validateResolvedTourTargets([emptyRoot]);

    expect(report).toEqual({
      issues: [
        {
          diagnostic: {
            code: null,
            location: null,
            message: `No valid tours or diagrams were discovered in source target "${normalizePath(emptyRoot)}".`
          },
          sourceId: normalizePath(emptyRoot),
          sourcePath: normalizePath(emptyRoot)
        }
      ],
      total: 0,
      valid: 0
    });
  });

  it("wraps unexpected directory discovery errors during validation", async () => {
    const discoveryRoot = await createTempDiagramDirectory({
      "broken.tour.yaml": [
        "version: 1",
        "title: Broken",
        "diagram: ./missing.mmd",
        "",
        "steps:",
        "  - focus: []",
        "    text: >",
        "      Broken."
      ].join("\n")
    });

    vi.resetModules();
    vi.doMock("node:fs/promises", async () => {
      const actual = (await vi.importActual("node:fs/promises")) as typeof FsPromises;

      return {
        ...actual,
        async readdir(
          path: Parameters<typeof actual.readdir>[0],
          options?: Parameters<typeof actual.readdir>[1]
        ) {
          if (String(path) === discoveryRoot) {
            throw new Error("boom");
          }

          return actual.readdir(path, options as never);
        }
      };
    });

    const parser = await import("../src/index.js");
    const report = await parser.validateResolvedTourTargets([discoveryRoot]);

    expect(report).toEqual({
      issues: [
        {
          diagnostic: {
            code: null,
            location: null,
            message: "boom"
          },
          sourceId: normalizePath(discoveryRoot),
          sourcePath: normalizePath(discoveryRoot)
        }
      ],
      total: 0,
      valid: 0
    });

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });
});
