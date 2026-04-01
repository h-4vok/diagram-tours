import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateInitTarget, validateTargetPath, validateValidationTarget } from "../src/lib/target.js";

const ORIGINAL_CWD = process.cwd();
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

beforeEach(() => {
  process.chdir(REPO_ROOT);
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("validateTargetPath", () => {
  it("accepts a directory target", () => {
    expect(validateTargetPath("./examples")).toContain("examples");
  });

  it("accepts a tour file target", () => {
    expect(validateTargetPath("./examples/checkout-payment-flow.tour.yaml")).toContain(
      "payment-flow.tour.yaml"
    );
  });

  it("accepts a mermaid diagram target", () => {
    expect(validateTargetPath("./examples/checkout-payment-flow.mmd")).toContain(
      "payment-flow.mmd"
    );
  });

  it("accepts a .mermaid diagram target", async () => {
    const directory = await mkdtemp(join(tmpdir(), "diagram-tours-cli-"));
    const target = join(directory, "preview.mermaid");

    await writeFile(target, "flowchart LR\n  start[Start] --> finish[Finish]");

    expect(validateTargetPath(target)).toContain("preview.mermaid");
  });

  it("accepts a markdown diagram target", async () => {
    const directory = await mkdtemp(join(tmpdir(), "diagram-tours-cli-"));
    const target = join(directory, "preview.md");

    await writeFile(
      target,
      ["# Preview", "", "```mermaid", "flowchart LR", "  start[Start] --> finish[Finish]", "```"].join(
        "\n"
      )
    );

    expect(validateTargetPath(target)).toContain("preview.md");
  });

  it("rejects missing paths", () => {
    expect(() => validateTargetPath("./missing")).toThrow("Path does not exist:");
  });

  it("rejects unsupported files", () => {
    expect(() => validateTargetPath("./package.json")).toThrow(
      "Expected a .tour.yaml, .mmd, .mermaid, .md file, or a directory:"
    );
  });

  it("accepts a validation directory target", () => {
    expect(validateValidationTarget("./examples")).toContain("examples");
  });

  it("defaults validation to the current working directory", () => {
    expect(validateValidationTarget(null)).toBe(REPO_ROOT);
  });

  it("accepts a validation tour file target", () => {
    expect(validateValidationTarget("./examples/checkout/payment-flow.tour.yaml")).toContain(
      "payment-flow.tour.yaml"
    );
  });

  it("rejects diagram files for validation", () => {
    expect(() => validateValidationTarget("./examples/checkout/payment-flow.mmd")).toThrow(
      "Expected a .tour.yaml file or a directory:"
    );
  });

  it("accepts mermaid files for init", () => {
    expect(validateInitTarget("./examples/checkout/payment-flow.mmd")).toContain("payment-flow.mmd");
  });

  it("rejects tour files for init", () => {
    expect(() => validateInitTarget("./examples/checkout/payment-flow.tour.yaml")).toThrow(
      "Expected a .mmd or .mermaid file for init:"
    );
  });
});
