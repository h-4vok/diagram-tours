import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runSetupCommand } from "../src/lib/setup.js";

const ORIGINAL_CWD = process.cwd();

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

describe("runSetupCommand", () => {
  it("creates the default instructions file", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    process.chdir(root);

    await expect(
      runSetupCommand(
        {
          agent: "none",
          agentPath: null,
          overwrite: false
        },
        createIo(writes)
      )
    ).resolves.toBe(0);

    await expect(readFile(resolve(root, ".diagram-tours/instructions.md"), "utf8")).resolves.toContain(
      "diagram-tours init <diagram.mmd>"
    );
    expect(writes.join("")).toContain(".diagram-tours/instructions.md");
  });

  it("creates the default agent definition when requested", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    await runSetupCommand(
      {
        agent: "default",
        agentPath: null,
        overwrite: false
      },
      createIo()
    );

    await expect(readFile(resolve(root, ".codex/agents/diagram-tours-author.toml"), "utf8")).resolves.toContain(
      "Read `.diagram-tours/instructions.md`"
    );
  });

  it("creates the agent definition at a custom path", async () => {
    const root = await createTempRoot();
    const customPath = ".agents/custom-diagram-tours.toml";

    process.chdir(root);

    await runSetupCommand(
      {
        agent: "default",
        agentPath: customPath,
        overwrite: false
      },
      createIo()
    );

    await expect(readFile(resolve(root, customPath), "utf8")).resolves.toContain(
      'name = "Diagram Tours Author"'
    );
  });

  it("refuses to overwrite existing files without the overwrite flag", async () => {
    const root = await createTempRoot();

    process.chdir(root);
    await mkdir(resolve(root, ".diagram-tours"), { recursive: true });
    await writeFile(resolve(root, ".diagram-tours/instructions.md"), "existing", "utf8");

    await expect(
      runSetupCommand(
        {
          agent: "none",
          agentPath: null,
          overwrite: false
        },
        createIo()
      )
    ).rejects.toThrow("Refusing to overwrite existing file without --overwrite:");
  });

  it("prompts for overwrite in the interactive flow when instructions already exist", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    process.chdir(root);
    await mkdir(resolve(root, ".diagram-tours"), { recursive: true });
    await writeFile(resolve(root, ".diagram-tours/instructions.md"), "existing", "utf8");

    await expect(
      runSetupCommand(
        {
          agent: "prompt",
          agentPath: null,
          overwrite: false
        },
        createPromptIo(["n", "y"], writes)
      )
    ).resolves.toBe(0);

    await expect(readFile(resolve(root, ".diagram-tours/instructions.md"), "utf8")).resolves.not.toBe(
      "existing"
    );
    expect(writes.join("")).toContain("Overwrite existing .diagram-tours/instructions.md?");
  });

  it("stops the interactive flow when overwrite is declined", async () => {
    const root = await createTempRoot();

    process.chdir(root);
    await mkdir(resolve(root, ".diagram-tours"), { recursive: true });
    await writeFile(resolve(root, ".diagram-tours/instructions.md"), "existing", "utf8");

    await expect(
      runSetupCommand(
        {
          agent: "prompt",
          agentPath: null,
          overwrite: false
        },
        createPromptIo(["n", "n"])
      )
    ).rejects.toThrow("Setup cancelled because overwrite was declined");
  });

  it("prompts separately for an existing agent definition in the interactive flow", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    process.chdir(root);
    await mkdir(resolve(root, ".diagram-tours"), { recursive: true });
    await mkdir(resolve(root, ".agents"), { recursive: true });
    await writeFile(resolve(root, ".diagram-tours/instructions.md"), "existing instructions", "utf8");
    await writeFile(resolve(root, ".agents/diagram-tours.toml"), "existing agent", "utf8");

    await expect(
      runSetupCommand(
        {
          agent: "prompt",
          agentPath: null,
          overwrite: false
        },
        createPromptIo(["y", "2", ".agents/diagram-tours.toml", "y", "y"], writes)
      )
    ).resolves.toBe(0);

    expect(writes.join("")).toContain("Overwrite existing .diagram-tours/instructions.md?");
    expect(writes.join("")).toContain("Overwrite existing .agents/diagram-tours.toml?");
  });

  it("supports the interactive instructions-only path", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];

    process.chdir(root);

    await expect(
      runSetupCommand(
        {
          agent: "prompt",
          agentPath: null,
          overwrite: false
        },
        createPromptIo(["n"], writes)
      )
    ).resolves.toBe(0);

    await expect(readFile(resolve(root, ".diagram-tours/instructions.md"), "utf8")).resolves.toContain(
      "# Diagram Tours Instructions"
    );
  });

  it("supports the interactive default agent preset", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    await runSetupCommand(
      {
        agent: "prompt",
        agentPath: null,
        overwrite: false
      },
      createPromptIo(["y", "1"])
    );

    await expect(readFile(resolve(root, ".codex/agents/diagram-tours-author.toml"), "utf8")).resolves.toContain(
      'sandbox_mode = "workspace-write"'
    );
  });

  it("supports the interactive custom agent path flow", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    await runSetupCommand(
      {
        agent: "prompt",
        agentPath: null,
        overwrite: false
      },
      createPromptIo(["y", "2", ".agents/diagram-tours.toml"])
    );

    await expect(readFile(resolve(root, ".agents/diagram-tours.toml"), "utf8")).resolves.toContain(
      'name = "Diagram Tours Author"'
    );
  });

  it("rejects an invalid interactive preset choice", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    await expect(
      runSetupCommand(
        {
          agent: "prompt",
          agentPath: null,
          overwrite: false
        },
        createPromptIo(["y", "9"])
      )
    ).rejects.toThrow("Expected setup agent location selection to be 1 or 2.");
  });

  it("rejects an empty interactive custom agent path", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    await expect(
      runSetupCommand(
        {
          agent: "prompt",
          agentPath: null,
          overwrite: false
        },
        createPromptIo(["y", "2", "   "])
      )
    ).rejects.toThrow("Expected a non-empty custom agent definition path.");
  });

  it("writes authoring guidance about stable Mermaid ids and includes a concrete example", async () => {
    const root = await createTempRoot();

    process.chdir(root);

    await runSetupCommand(
      {
        agent: "none",
        agentPath: null,
        overwrite: false
      },
      createIo()
    );

    const content = await readFile(resolve(root, ".diagram-tours/instructions.md"), "utf8");

    expect(content).toContain("Prefer specific, stable Mermaid IDs");
    expect(content).toContain("Avoid generic IDs such as `A`, `B`, or `C`");
    expect(content).toContain("flowchart LR");
    expect(content).toContain("api_gateway[API Gateway]");
    expect(content).toContain("version: 1");
  });
});

function createIo(writes: string[] = []) {
  return {
    question() {
      throw new Error("question should not be called");
    },
    write(text: string) {
      writes.push(text);
    }
  };
}

function createPromptIo(answers: string[], writes: string[] = []) {
  let index = 0;

  return {
    async question(prompt: string) {
      writes.push(prompt);
      return answers[index++] ?? "";
    },
    write(text: string) {
      writes.push(text);
    }
  };
}

async function createTempRoot(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");

  return await mkdtemp(join(tmpdir(), "diagram-tours-setup-"));
}
