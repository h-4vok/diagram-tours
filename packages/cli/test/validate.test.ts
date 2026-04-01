import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runValidateCommand } from "../src/lib/validate.js";

const ORIGINAL_CWD = process.cwd();

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runValidateCommand", () => {
  it("validates one authored tour file", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    await writeTourFixture(root, {
      diagramName: "payment-flow.mmd",
      tourName: "payment-flow.tour.yaml",
      yaml: validTourYaml("./payment-flow.mmd")
    });
    process.chdir(root);

    await expect(runValidateCommand({ target: "./payment-flow.tour.yaml" }, writeCollector(writes))).resolves.toBe(
      0
    );
    expect(writes.join("")).toContain("Validated tour file");
  });

  it("validates authored tours recursively under a directory", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    await writeTourFixture(resolve(root, "docs/checkout"), {
      diagramName: "payment-flow.mmd",
      tourName: "payment-flow.tour.yaml",
      yaml: validTourYaml("./payment-flow.mmd")
    });
    process.chdir(root);

    await expect(runValidateCommand({ target: "./docs" }, writeCollector(writes))).resolves.toBe(0);
    expect(writes.join("")).toContain("Valid: 1");
    expect(writes.join("")).toContain("Invalid: 0");
  });

  it("reports invalid authored tours inside a directory", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    await writeTourFixture(resolve(root, "docs/broken"), {
      diagramName: "payment-flow.mmd",
      tourName: "payment-flow.tour.yaml",
      yaml: invalidTourYaml("./payment-flow.mmd")
    });
    process.chdir(root);

    await expect(runValidateCommand({ target: "./docs" }, writeCollector(writes))).resolves.toBe(1);
    expect(writes.join("")).toContain("Invalid: 1");
    expect(writes.join("")).toContain("missing_node");
  });

  it("fails clearly when a directory contains no authored tours", async () => {
    const root = await createTempRoot();

    await mkdir(resolve(root, "docs"), { recursive: true });
    await writeFile(resolve(root, "docs/payment-flow.mmd"), "flowchart LR\n  start[Start]", "utf8");
    process.chdir(root);

    await expect(runValidateCommand({ target: "./docs" })).rejects.toThrow(
      'No authored .tour.yaml files were discovered in directory'
    );
  });

  it("writes to stdout when no custom writer is provided", async () => {
    const root = await createTempRoot();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await writeTourFixture(root, {
      diagramName: "payment-flow.mmd",
      tourName: "payment-flow.tour.yaml",
      yaml: validTourYaml("./payment-flow.mmd")
    });
    process.chdir(root);

    await expect(runValidateCommand({ target: "./payment-flow.tour.yaml" })).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining("Validated tour file"));
    stdoutWrite.mockRestore();
  });
});

function writeCollector(writes: string[]) {
  return (text: string) => {
    writes.push(text);
  };
}

async function writeTourFixture(
  directory: string,
  input: {
    diagramName: string;
    tourName: string;
    yaml: string;
  }
): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, input.diagramName), "flowchart LR\n  start[Start]", "utf8");
  await writeFile(resolve(directory, input.tourName), input.yaml, "utf8");
}

function validTourYaml(diagramPath: string): string {
  return [
    "version: 1",
    'title: "Payment Flow"',
    `diagram: "${diagramPath}"`,
    "",
    "steps:",
    "  - focus:",
    "      - start",
    '    text: "Focus on {{start}}."'
  ].join("\n");
}

function invalidTourYaml(diagramPath: string): string {
  return [
    "version: 1",
    'title: "Broken Tour"',
    `diagram: "${diagramPath}"`,
    "",
    "steps:",
    "  - focus:",
    "      - missing_node",
    '    text: "Broken {{missing_node}}."'
  ].join("\n");
}

async function createTempRoot(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");

  return await mkdtemp(join(tmpdir(), "diagram-tours-validate-"));
}
