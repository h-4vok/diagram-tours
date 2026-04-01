import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runWizard, type WizardIo } from "../src/lib/wizard.js";
import * as targetModule from "../src/lib/target.js";

const ORIGINAL_CWD = process.cwd();
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

beforeEach(() => {
  process.chdir(REPO_ROOT);
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runWizard", () => {
  it("opens the current directory and keeps default host and automatic port", async () => {
    const result = await runWizard(createIo(["1", "n", "", ""]), {
      browser: "prompt",
      host: "127.0.0.1",
      port: null
    });

    expect(result.browser).toBe("never");
    expect(result.host).toBe("127.0.0.1");
    expect(result.port).toBeNull();
    expect(result.target).toContain("diagram-tours");
  });

  it("recovers from invalid menu input and path input", async () => {
    const io = createIo(["9", "3", "./missing.tour.yaml", "./examples/checkout-payment-flow.mmd", "y", "0.0.0.0", "9000"]);

    const result = await runWizard(io, {
      browser: "prompt",
      host: "127.0.0.1",
      port: null
    });

    expect(io.output).toContain("Enter 1, 2, or 3.");
    expect(io.output).toContain("Path does not exist:");
    expect(io.prompts.filter((prompt) => prompt === "Diagram or tour file path: ")).toHaveLength(2);
    expect(result).toEqual({
      browser: "always",
      host: "0.0.0.0",
      port: 9000,
      target: expect.stringContaining("payment-flow.mmd")
    });
    expect(io.prompts).toEqual([
      "Select an option: ",
      "Select an option: ",
      "Diagram or tour file path: ",
      "Diagram or tour file path: ",
      "Open the browser now? (y/n): ",
      "Host override (press enter for 127.0.0.1): ",
      "Port override (press enter for automatic): "
    ]);
  });

  it("retries the directory path prompt after a missing path without returning to the menu", async () => {
    const io = createIo(["2", "./missing-directory", "./examples", "n", "", ""]);

    const result = await runWizard(io, {
      browser: "prompt",
      host: "127.0.0.1",
      port: null
    });

    expect(io.output).toContain("Path does not exist:");
    expect(io.prompts).toEqual([
      "Select an option: ",
      "Directory path: ",
      "Directory path: ",
      "Open the browser now? (y/n): ",
      "Host override (press enter for 127.0.0.1): ",
      "Port override (press enter for automatic): "
    ]);
    expect(result).toEqual({
      browser: "never",
      host: "127.0.0.1",
      port: null,
      target: expect.stringContaining("examples")
    });
  });

  it("accepts a direct diagram file path from the wizard", async () => {
    const io = createIo(["3", "./examples/checkout-payment-flow.mmd", "n", "", ""]);

    const result = await runWizard(io, {
      browser: "prompt",
      host: "127.0.0.1",
      port: null
    });

    expect(result).toEqual({
      browser: "never",
      host: "127.0.0.1",
      port: null,
      target: expect.stringContaining("payment-flow.mmd")
    });
  });

  it("honors a browser override without prompting again", async () => {
    const io = createIo(["2", "./examples", "", ""]);

    const result = await runWizard(io, {
      browser: "always",
      host: "127.0.0.1",
      port: null
    });

    expect(io.prompts).not.toContain("Open the browser now? (y/n): ");
    expect(result.browser).toBe("always");
  });

  it("recovers from invalid browser and port answers", async () => {
    const io = createIo(["1", "maybe", "yes", "", "wat", "7734"]);

    const result = await runWizard(io, {
      browser: "prompt",
      host: "127.0.0.1",
      port: null
    });

    expect(io.output).toContain("Enter y or n.");
    expect(io.output).toContain("Enter a port between 1 and 65535, or press enter.");
    expect(result.browser).toBe("always");
    expect(result.port).toBe(7734);
  });

  it("falls back to a generic path error for non-Error throws", async () => {
    const validateSpy = vi.spyOn(targetModule, "validateTargetPath");
    const io = createIo(["1", "1", "n", "", ""]);

    validateSpy.mockImplementationOnce(() => {
      throw "bad";
    });

    const result = await runWizard(io, {
      browser: "prompt",
      host: "127.0.0.1",
      port: null
    });

    expect(io.output).toContain("Could not resolve that path.");
    expect(result.target).toContain("diagram-tours");
    validateSpy.mockRestore();
  });

  it("stops retrying when the prompt is interrupted while entering a path", async () => {
    const io = createIo(["3"], {
      "Diagram or tour file path: ": new Error("readline was closed")
    });

    await expect(
      runWizard(io, {
        browser: "prompt",
        host: "127.0.0.1",
        port: null
      })
    ).rejects.toThrow("readline was closed");

    expect(io.prompts.filter((prompt) => prompt === "Diagram or tour file path: ")).toHaveLength(1);
    expect(io.output).not.toContain("readline was closed");
  });
});

function createIo(
  answers: string[],
  failures: Partial<Record<string, Error>> = {}
): WizardIo & { output: string; prompts: string[] } {
  let index = 0;
  let output = "";
  const prompts: string[] = [];

  return {
    output,
    prompts,
    async question(prompt: string) {
      prompts.push(prompt);

      const failure = failures[prompt];

      if (failure !== undefined) {
        delete failures[prompt];
        throw failure;
      }

      return answers[index++] ?? "";
    },
    write(text: string) {
      output += text;
      this.output = output;
    }
  };
}
