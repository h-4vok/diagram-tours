import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readCliVersion } from "../src/lib/version.js";

const resolveServerBindingMock = vi.fn();
const startWebServerMock = vi.fn();
const validateTargetPathMock = vi.fn();
const validateResolvedTourTargetsMock = vi.fn();
const runWizardMock = vi.fn();
const loadResolvedTourCollectionMock = vi.fn();
const runSetupCommandMock = vi.fn();
const runValidateCommandMock = vi.fn();
const runInitCommandMock = vi.fn();
const questionMock = vi.fn();
const closeMock = vi.fn();

vi.mock("node:readline/promises", () => {
  return {
    createInterface: vi.fn(() => {
      return {
        close: closeMock,
        question: questionMock
      };
    })
  };
});

vi.mock("../src/lib/port-policy.js", () => {
  return {
    resolveServerBinding: resolveServerBindingMock
  };
});

vi.mock("../src/lib/server.js", () => {
  return {
    startWebServer: startWebServerMock
  };
});

vi.mock("../src/lib/target.js", () => {
  return {
    validateTargetPath: validateTargetPathMock
  };
});

vi.mock("../src/lib/wizard.js", () => {
  return {
    runWizard: runWizardMock
  };
});

vi.mock("../src/lib/setup.js", () => {
  return {
    runSetupCommand: runSetupCommandMock
  };
});

vi.mock("../src/lib/validate.js", () => {
  return {
    runValidateCommand: runValidateCommandMock
  };
});

vi.mock("../src/lib/init.js", () => {
  return {
    runInitCommand: runInitCommandMock
  };
});

vi.mock("@diagram-tour/parser", () => {
  return {
    loadResolvedTourCollection: loadResolvedTourCollectionMock,
    validateResolvedTourTargets: validateResolvedTourTargetsMock
  };
});

describe("runCli", () => {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  beforeEach(() => {
    questionMock.mockResolvedValue("");
    loadResolvedTourCollectionMock.mockResolvedValue({ entries: [], skipped: [] });
    validateResolvedTourTargetsMock.mockResolvedValue({
      issues: [],
      total: 0,
      valid: 0
    });
    resolveServerBindingMock.mockResolvedValue({ host: "127.0.0.1", port: 7733 });
    startWebServerMock.mockResolvedValue({
      child: createChild(),
      url: "http://127.0.0.1:7733"
    });
    validateTargetPathMock.mockReturnValue("C:/repo/examples");
    runWizardMock.mockResolvedValue({
      browser: "never",
      host: "127.0.0.1",
      port: null,
      target: "C:/repo/examples"
    });
    runSetupCommandMock.mockResolvedValue(0);
    runValidateCommandMock.mockResolvedValue(0);
    runInitCommandMock.mockResolvedValue(0);
  });

  afterEach(() => {
    closeMock.mockReset();
    questionMock.mockReset();
    loadResolvedTourCollectionMock.mockReset();
    validateResolvedTourTargetsMock.mockReset();
    resolveServerBindingMock.mockReset();
    startWebServerMock.mockReset();
    validateTargetPathMock.mockReset();
    runWizardMock.mockReset();
    runSetupCommandMock.mockReset();
    runValidateCommandMock.mockReset();
    runInitCommandMock.mockReset();
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it("validates an explicit target and does not open the browser by default", async () => {
    const opener = { open: vi.fn() };
    const writes: string[] = [];

    process.stdout.write = vi.fn((text: string) => {
      writes.push(text);
      return true;
    }) as never;

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["serve", "./examples"], opener);

    expect(exitCode).toBe(0);
    expect(validateTargetPathMock).toHaveBeenCalledWith("./examples");
    expect(loadResolvedTourCollectionMock).toHaveBeenCalledWith("C:/repo/examples");
    expect(runWizardMock).not.toHaveBeenCalled();
    expect(opener.open).not.toHaveBeenCalled();
    expect(writes.join("")).toContain("http://127.0.0.1:7733");
  });

  it("prints the CLI version and exits before startup work", async () => {
    const opener = { open: vi.fn() };
    const writes: string[] = [];

    process.stdout.write = vi.fn((text: string) => {
      writes.push(text);
      return true;
    }) as never;

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["--version"], opener);

    expect(exitCode).toBe(0);
    expect(writes.join("")).toContain(`diagram-tours ${readCliVersion()}`);
    expect(validateTargetPathMock).not.toHaveBeenCalled();
    expect(loadResolvedTourCollectionMock).not.toHaveBeenCalled();
    expect(startWebServerMock).not.toHaveBeenCalled();
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("dispatches setup through the setup command module", async () => {
    runSetupCommandMock.mockImplementation(async (_options, io) => {
      io.write("setup");
      await io.question("question");
      return 0;
    });
    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["setup", "--agent"]);

    expect(exitCode).toBe(0);
    expect(runSetupCommandMock).toHaveBeenCalledWith(
      {
        agent: "default",
        agentPath: null,
        overwrite: false
      },
      expect.objectContaining({
        question: expect.any(Function),
        write: expect.any(Function)
      })
    );
    expect(closeMock).toHaveBeenCalledOnce();
    expect(startWebServerMock).not.toHaveBeenCalled();
  });

  it("dispatches validate through the validate command module", async () => {
    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["validate", "./examples"]);

    expect(exitCode).toBe(0);
    expect(runValidateCommandMock).toHaveBeenCalledWith({
      target: "./examples"
    });
    expect(startWebServerMock).not.toHaveBeenCalled();
  });

  it("dispatches init through the init command module", async () => {
    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["init", "./examples/flowchart/checkout-payment-flow.mmd"]);

    expect(exitCode).toBe(0);
    expect(runInitCommandMock).toHaveBeenCalledWith(
      {
        overwrite: false,
        target: "./examples/flowchart/checkout-payment-flow.mmd"
      },
      expect.objectContaining({
        question: expect.any(Function),
        write: expect.any(Function)
      })
    );
    expect(closeMock).toHaveBeenCalledOnce();
    expect(startWebServerMock).not.toHaveBeenCalled();
  });

  it("runs validate against the current directory when no paths are provided", async () => {
    const opener = { open: vi.fn() };
    const writes: string[] = [];

    process.stdout.write = vi.fn((text: string) => {
      writes.push(text);
      return true;
    }) as never;

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["validate"], opener);

    expect(exitCode).toBe(0);
    expect(runValidateCommandMock).toHaveBeenCalledWith({ target: null });
    expect(loadResolvedTourCollectionMock).not.toHaveBeenCalled();
    expect(startWebServerMock).not.toHaveBeenCalled();
    expect(opener.open).not.toHaveBeenCalled();
    expect(writes.join("")).toBe("");
  });

  it("prints validation failures and exits non-zero", async () => {
    const opener = { open: vi.fn() };
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];

    runValidateCommandMock.mockResolvedValue(1);

    process.stdout.write = vi.fn((text: string) => {
      stdoutWrites.push(text);
      return true;
    }) as never;
    process.stderr.write = vi.fn((text: string) => {
      stderrWrites.push(text);
      return true;
    }) as never;

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["validate", "./docs"], opener);

    expect(exitCode).toBe(1);
    expect(runValidateCommandMock).toHaveBeenCalledWith({ target: "./docs" });
    expect(stdoutWrites.join("")).toBe("");
    expect(stderrWrites.join("")).toBe("");
    expect(loadResolvedTourCollectionMock).not.toHaveBeenCalled();
    expect(startWebServerMock).not.toHaveBeenCalled();
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("prints validation failures without a location", async () => {
    const opener = { open: vi.fn() };
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];

    runValidateCommandMock.mockResolvedValue(1);

    process.stdout.write = vi.fn((text: string) => {
      stdoutWrites.push(text);
      return true;
    }) as never;
    process.stderr.write = vi.fn((text: string) => {
      stderrWrites.push(text);
      return true;
    }) as never;

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["validate", "./docs"], opener);

    expect(exitCode).toBe(1);
    expect(runValidateCommandMock).toHaveBeenCalledWith({ target: "./docs" });
    expect(stderrWrites.join("")).not.toContain("C:/repo/docs/checklist.tour.yaml:2:4");
  });

  it("preflights a markdown target before startup", async () => {
    const opener = { open: vi.fn() };

    validateTargetPathMock.mockReturnValue("C:/repo/docs/checklist.md");

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["serve", "./docs/checklist.md"], opener);

    expect(exitCode).toBe(0);
    expect(validateTargetPathMock).toHaveBeenCalledWith("./docs/checklist.md");
    expect(loadResolvedTourCollectionMock).toHaveBeenCalledWith("C:/repo/docs/checklist.md");
  });

  it("serves current directory without wizard", async () => {
    const opener = { open: vi.fn().mockResolvedValue(undefined) };

    const { runCli } = await import("../src/lib/cli.js");
    await runCli(["serve"], opener);

    expect(runWizardMock).not.toHaveBeenCalled();
    expect(validateTargetPathMock).toHaveBeenCalledWith(".");
    expect(loadResolvedTourCollectionMock).toHaveBeenCalledWith("C:/repo/examples");
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("treats an undefined child exit code as success", async () => {
    const opener = { open: vi.fn() };

    startWebServerMock.mockResolvedValue({
      child: createChild(undefined),
      url: "http://127.0.0.1:7733"
    });

    const { runCli } = await import("../src/lib/cli.js");
    const exitCode = await runCli(["serve", "./examples"], opener);

    expect(exitCode).toBe(0);
  });

  it("rejects when the child process emits an error", async () => {
    startWebServerMock.mockResolvedValue({
      child: {
        once(event: string, listener: (error?: Error) => void) {
          if (event === "error") {
            listener(new Error("boom"));
          }

          return this;
        }
      },
      url: "http://127.0.0.1:7733"
    });

    const { runCli } = await import("../src/lib/cli.js");

    await expect(runCli(["serve", "./examples"], { open: vi.fn() })).rejects.toThrow("boom");
  });

  it("fails before starting the server when preflight loading fails", async () => {
    loadResolvedTourCollectionMock.mockRejectedValue(
      new Error("No valid tours or diagrams were discovered in source target \"C:/repo\".")
    );
    const { runCli } = await import("../src/lib/cli.js");

    await expect(runCli(["serve", "./examples"], { open: vi.fn() })).rejects.toThrow(
      "No valid tours or diagrams were discovered in source target"
    );
    expect(startWebServerMock).not.toHaveBeenCalled();
  });

  it("prints help without starting the server when no command is provided", async () => {
    const writes: string[] = [];
    process.stdout.write = vi.fn((text: string) => { writes.push(text); return true; }) as never;
    const { runCli } = await import("../src/lib/cli.js");
    await expect(runCli([], { open: vi.fn() })).resolves.toBe(0);
    expect(writes.join("")).toContain("serve [target]");
    expect(loadResolvedTourCollectionMock).not.toHaveBeenCalled();
    expect(startWebServerMock).not.toHaveBeenCalled();
  });

  it("opens browser when serve requests it", async () => {
    const opener = { open: vi.fn().mockResolvedValue(undefined) };
    const { runCli } = await import("../src/lib/cli.js");
    await runCli(["serve", "./examples", "--open"], opener);
    expect(opener.open).toHaveBeenCalledWith("http://127.0.0.1:7733");
  });

  it("prints main and contextual help without startup work", async () => {
    const writes: string[] = [];
    process.stdout.write = vi.fn((text: string) => { writes.push(text); return true; }) as never;
    const { runCli } = await import("../src/lib/cli.js");

    await expect(runCli(["help"])).resolves.toBe(0);
    expect(writes.join("")).toContain("setup");
    writes.length = 0;
    await expect(runCli(["help", "serve"])).resolves.toBe(0);
    expect(writes.join("")).toContain("--host");
    expect(startWebServerMock).not.toHaveBeenCalled();
  });
});

function createChild(code = 0) {
  return {
    once(event: string, listener: (value?: number) => void) {
      if (event === "exit") {
        listener(code);
      }

      return this;
    }
  };
}
