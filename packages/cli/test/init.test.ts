import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInitCommand } from "../src/lib/init.js";

const { loadResolvedTourCollectionMock } = vi.hoisted(() => {
  return {
    loadResolvedTourCollectionMock: vi.fn()
  };
});

vi.mock("@diagram-tour/parser", () => {
  return {
    loadResolvedTourCollection: loadResolvedTourCollectionMock
  };
});

const ORIGINAL_CWD = process.cwd();

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

beforeEach(() => {
  loadResolvedTourCollectionMock.mockImplementation(async (absolutePath: string) => {
    return { entries: readCollectionEntries(absolutePath) };
  });
});

describe("runInitCommand", () => {
  it("creates a sibling starter tour for a mermaid diagram", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    const io = createIo();

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

    await expect(runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mermaid" }, createIo())).resolves.toBe(
      0
    );

    const scaffold = await readFile(resolve(root, "checkout/payment-flow.tour.yaml"), "utf8");

    expect(scaffold).toContain('diagram: "./payment-flow.mermaid"');
  });

  it("creates a sibling starter tour for a markdown diagram with one mermaid block", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(
      diagramPath,
      ["# Checklist", "", "```mermaid", "flowchart TD", "  start[Start] --> done[Done]", "```"].join("\n")
    );
    process.chdir(root);

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md" }, createIo())).resolves.toBe(0);

    const scaffold = await readFile(resolve(root, "docs/checklist.tour.yaml"), "utf8");

    expect(scaffold).toContain('title: "Checklist"');
    expect(scaffold).toContain('diagram: "./checklist.md"');
  });

  it("creates a markdown starter tour from an explicit fragment target", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(
      diagramPath,
      [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> review[Review]",
        "```",
        "",
        "# Details",
        "",
        "```mermaid",
        "flowchart TD",
        "  detail[Detail] --> done[Done]",
        "```"
      ].join("\n")
    );
    process.chdir(root);

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md#details" }, createIo())).resolves.toBe(
      0
    );

    const scaffold = await readFile(resolve(root, "docs/checklist-details.tour.yaml"), "utf8");

    expect(scaffold).toContain('title: "Details"');
    expect(scaffold).toContain('diagram: "./checklist.md#details"');
    expect(scaffold).toContain("- detail");
  });

  it("prompts for a markdown block when a markdown target has multiple mermaid blocks", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "docs/checklist.md");

    await writeMarkdown(
      diagramPath,
      [
        "# Overview",
        "",
        "```mermaid",
        "flowchart TD",
        "  start[Start] --> review[Review]",
        "```",
        "",
        "# Details",
        "",
        "```mermaid",
        "flowchart TD",
        "  detail[Detail] --> done[Done]",
        "```"
      ].join("\n")
    );
    process.chdir(root);

    const io = createIo(["wat", "2"]);

    await expect(runInitCommand({ overwrite: false, target: "./docs/checklist.md" }, io)).resolves.toBe(0);

    const scaffold = await readFile(resolve(root, "docs/checklist-details.tour.yaml"), "utf8");

    expect(scaffold).toContain('diagram: "./checklist.md#details"');
    expect(io.question).toHaveBeenCalledWith("Select a Mermaid block to scaffold: ");
    expect(io.write).toHaveBeenCalledWith(expect.stringContaining("1. Details"));
    expect(io.write).toHaveBeenCalledWith(expect.stringContaining("2. Overview"));
    expect(io.write).toHaveBeenCalledWith("Enter a number between 1 and 2.\n");
  });

  it("refuses to overwrite an existing tour file without the overwrite flag", async () => {
    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");
    const tourPath = resolve(root, "checkout/payment-flow.tour.yaml");

    await writeDiagram(diagramPath);
    await writeFile(tourPath, "existing", "utf8");
    process.chdir(root);

    await expect(
      runInitCommand({ overwrite: false, target: "./checkout/payment-flow.mmd" }, createIo())
    ).rejects.toThrow("Refusing to overwrite existing tour file without --overwrite:");
  });

  it("creates a valid empty tour scaffold and mermaid companion", async () => {
    const root = await createTempRoot();

    process.chdir(root);

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

    await expect(
      runInitCommand({ overwrite: false, target: "./checkout/payment-flow.tour.yaml" }, createIo())
    ).rejects.toThrow("Refusing to overwrite existing diagram file without --overwrite:");
  });

  it("fails when the init target would resolve to multiple scaffoldable entries", async () => {
    loadResolvedTourCollectionMock.mockResolvedValueOnce({
      entries: [
        { title: "One", tour: { steps: [] } },
        { title: "Two", tour: { steps: [] } }
      ]
    });

    const root = await createTempRoot();
    const diagramPath = resolve(root, "checkout/payment-flow.mmd");

    await writeDiagram(diagramPath);
    process.chdir(root);

    await expect(
      runInitCommand({ overwrite: true, target: "./checkout/payment-flow.mmd" }, createIo())
    ).rejects.toThrow('Expected exactly one scaffoldable diagram entry for init target');
  });
});

function readCollectionEntries(absolutePath: string) {
  const bySuffix = [
    {
      entries: [createEntry({ sourcePath: absolutePath, title: "Payment Flow", focusIds: ["api_gateway"] })],
      suffixes: ["payment-flow.mmd", "payment-flow.mermaid"]
    },
    {
      entries: [
        createEntry({ sourcePath: `${absolutePath}#details`, title: "Details", focusIds: ["detail"] }),
        createEntry({ sourcePath: `${absolutePath}#overview`, title: "Overview", focusIds: ["start"] })
      ],
      suffixes: ["checklist.md"]
    }
  ];
  const match = bySuffix.find((candidate) => candidate.suffixes.some((suffix) => absolutePath.endsWith(suffix)));

  if (match) {
    return match.entries;
  }

  throw new Error(`Unexpected mocked init source: ${absolutePath}`);
}

function createEntry(options: { focusIds: string[]; sourcePath: string; title: string }) {
  return {
    sourcePath: options.sourcePath,
    title: options.title,
    tour: {
      steps: [
        {
          focus: options.focusIds.map((id) => ({ id })),
          text: `${options.title} step`
        }
      ]
    }
  };
}

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

async function writeMarkdown(path: string, content: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function createTempRoot(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");

  return await mkdtemp(join(tmpdir(), "diagram-tours-init-"));
}

function createIo(answers: string[] = []) {
  const question = vi.fn(async () => answers.shift() ?? "");
  const write = vi.fn();

  return {
    question,
    write
  };
}
