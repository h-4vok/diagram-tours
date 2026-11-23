import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ORIGINAL_CWD, createIo, createTempRoot, writeDiagram } from "./init-test-support.js";

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runInitCommand generated entry handling", () => {
  it("treats a non-string sourcePath as a plain diagram reference", async () => {
    vi.resetModules();
    vi.doMock("@diagram-tour/parser", () => {
      return {
        loadResolvedTourCollection: vi.fn().mockResolvedValue({
          entries: [
            {
              sourcePath: null,
              title: "Payment Flow",
              tour: {
                steps: [
                  {
                    focus: [{ id: "api_gateway" }],
                    text: "Payment Flow step"
                  }
                ]
              }
            }
          ]
        })
      };
    });

    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    try {
      const { runInitCommand } = await import("../src/lib/init.js");

      await expect(runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" }, createIo())).resolves.toBe(0);

      const scaffold = await readFile(resolve(root, "checkout/payment-flow.tour.yaml"), "utf8");

      expect(scaffold).toContain('diagram: "./payment-flow.mmd"');
    } finally {
      vi.doUnmock("@diagram-tour/parser");
      vi.resetModules();
    }
  });

  it("includes the plain target path in the no-entry error when no fragment is present", async () => {
    vi.resetModules();
    vi.doMock("@diagram-tour/parser", () => {
      return {
        loadResolvedTourCollection: vi.fn().mockResolvedValue({
          entries: []
        })
      };
    });

    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    try {
      const { runInitCommand } = await import("../src/lib/init.js");

      await expect(
        runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" }, createIo())
      ).rejects.toThrow('Expected exactly one scaffoldable diagram entry for init target');
    } finally {
      vi.doUnmock("@diagram-tour/parser");
      vi.resetModules();
    }
  });
});
