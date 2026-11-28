import { describe, expect, it, vi } from "vitest";
import type * as FsPromises from "node:fs/promises";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    readFile: (path: Parameters<typeof actual.readFile>[0], options?: Parameters<typeof actual.readFile>[1]) => {
      if (String(path).endsWith("generic-error.mmd")) {
        return Promise.reject(new Error("unexpected generated source read failure"));
      }
      return actual.readFile(path, options);
    }
  };
});

import { loadResolvedTourCollection } from "../src/index.js";
import { createTempDiagramDirectory } from "./parser-test-support.js";

describe("generated source discovery errors", () => {
  it("rethrows unexpected read failures instead of converting them into diagnostics", async () => {
    const sourceRoot = await createTempDiagramDirectory({ "generic-error.mmd": "architecture-beta" });

    await expect(loadResolvedTourCollection(sourceRoot)).rejects.toThrow("unexpected generated source read failure");
  });
});
