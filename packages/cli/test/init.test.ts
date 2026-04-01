import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CWD = process.cwd();

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runInitCommand", () => {
  it("creates a sibling starter tour for a mermaid diagram", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" })).resolves.toBe(0);

    const scaffold = await readFile(resolve(root, "checkout/payment-flow.tour.yaml"), "utf8");

    expect(scaffold).toContain('title: "Payment Flow"');
    expect(scaffold).toContain('diagram: "./payment-flow.mmd"');
    expect(scaffold).toContain("focus: []");
    expect(scaffold).toContain("- api_gateway");
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("payment-flow.tour.yaml"));
    stdoutWrite.mockRestore();
  });

  it("refuses to overwrite an existing tour file without the overwrite flag", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");
    const tourPath = resolve(root, "checkout/payment-flow.tour.yaml");

    await writeDiagram(diagramPath);
    await writeFile(tourPath, "existing", "utf8");
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(
      runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" })
    ).rejects.toThrow("Refusing to overwrite existing file without --overwrite:");
  });

  it("fails when the init target would resolve to multiple scaffoldable entries", async () => {
    vi.resetModules();
    vi.doMock("@diagram-tour/parser", () => {
      return {
        loadResolvedTourCollection: vi.fn().mockResolvedValue({
          entries: [
            { title: "One", tour: { steps: [] } },
            { title: "Two", tour: { steps: [] } }
          ]
        })
      };
    });

    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(
      runInitCommand({ overwrite: true, target: "./checkout/payment-flow.mmd" }, () => undefined)
    ).rejects.toThrow('Expected exactly one scaffoldable diagram entry for init target');

    vi.doUnmock("@diagram-tour/parser");
    vi.resetModules();
  });
});

async function writeDiagram(path: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    [
      "flowchart LR",
      "  client[Client] --> api_gateway[API Gateway]",
      "  api_gateway --> response[Response]"
    ].join("\n"),
    "utf8"
  );
}

async function createTempRoot(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");

  return await mkdtemp(join(tmpdir(), "diagram-tours-init-"));
}
