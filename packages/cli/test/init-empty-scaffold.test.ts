import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ORIGINAL_CWD, createIo, createTempRoot, writeDiagram } from "./init-test-support.js";

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runInitCommand empty scaffold", () => {
  it("creates a valid empty tour scaffold and mermaid companion", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(runInitCommand({ overwrite: false, target: "./checkout/payment-flow.tour.yaml" }, createIo())).resolves.toBe(
      0
    );

    const mermaid = await readFile(resolve(root, "checkout/payment-flow.mmd"), "utf8");
    const scaffold = await readFile(resolve(root, "checkout/payment-flow.tour.yaml"), "utf8");

    expect(mermaid).toContain("flowchart TD");
    expect(scaffold).toContain('title: "Payment Flow"');
    expect(scaffold).toContain('diagram: "./payment-flow.mmd"');
    expect(scaffold).toContain("focus: []");
    expect(scaffold).toContain("- start");
    expect(scaffold).toContain("Overview of Payment Flow.");
    expect(scaffold).toContain("Explain how {{start}} begins the flow");
  });

  it("refuses to overwrite an existing companion mermaid file without the overwrite flag", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    const { runInitCommand } = await import("../src/lib/init.js");

    await expect(
      runInitCommand({ overwrite: false, target: "./checkout/payment-flow.tour.yaml" }, createIo())
    ).rejects.toThrow("Refusing to overwrite existing diagram file without --overwrite:");
  });
});
