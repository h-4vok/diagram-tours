import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ORIGINAL_CWD, createIo, createTempRoot, writeDiagram } from "./init-test-support.js";

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runInitCommand diagram sources", () => {
  it("creates a sibling starter tour for a mermaid diagram", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    const io = createIo();
    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" }, io)).resolves.toBe(0);

    const scaffold = await readFile(resolve(root, "checkout/payment-flow.tour.yaml"), "utf8");

    expect(scaffold).toContain('title: "Payment Flow"');
    expect(scaffold).toContain('diagram: "./payment-flow.mmd"');
    expect(scaffold).toContain("focus: []");
    expect(scaffold).toContain("- api_gateway");
    expect(io.write).toHaveBeenCalledWith(expect.stringContaining("payment-flow.tour.yaml"));
  });

  it("creates a sibling starter tour for a .mermaid diagram", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mermaid");

    await writeDiagram(diagramPath);
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mermaid" }, createIo())).resolves.toBe(
      0
    );

    const scaffold = await readFile(resolve(root, "checkout/payment-flow.tour.yaml"), "utf8");

    expect(scaffold).toContain('diagram: "./payment-flow.mermaid"');
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
      runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" }, createIo())
    ).rejects.toThrow("Refusing to overwrite existing tour file without --overwrite:");
  });
});
