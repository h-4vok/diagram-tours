import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../src/lib/args.js";

describe("parseCliArgs", () => {
  it("parses static build options", () => {
    expect(parseCliArgs(["build", "./examples", "--out", "site", "--overwrite", "--open"])).toEqual({
      command: "build",
      options: { browser: "always", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "./examples" }
    });
  });

  it("defaults static build target and output", () => {
    expect(parseCliArgs(["build"])).toEqual({
      command: "build",
      options: { browser: "never", continueOnError: false, logLevel: "normal", out: "dist", overwrite: false, target: "." }
    });
  });

  it("supports build help and rejects unsafe argument combinations", () => {
    expect(parseCliArgs(["build", "--help"])).toEqual({ command: "help", topic: "build" });
    expect(() => parseCliArgs(["build", "--open", "--no-open"])).toThrow("Choose either");
    expect(() => parseCliArgs(["build", "--out"])).toThrow("Expected a value");
    expect(() => parseCliArgs(["build", "--wat"])).toThrow("Unknown flag");
    expect(() => parseCliArgs(["build", "one", "two"])).toThrow("Only one target");
  });

  it("parses validation and logging controls", () => {
    expect(parseCliArgs(["build", "--continue", "--verbose"])).toEqual({
      command: "build",
      options: {
        browser: "never",
        continueOnError: true,
        logLevel: "verbose",
        out: "dist",
        overwrite: false,
        target: "."
      }
    });
    expect(parseCliArgs(["build", "--continue-on-error", "--quiet"]).command).toBe("build");
    expect(() => parseCliArgs(["build", "--quiet", "--verbose"])).toThrow("Choose either");
  });

  it("shows help when no command is provided", () => {
    expect(parseCliArgs([])).toEqual({
      command: "help", topic: null
    });
  });

  it.each(["help", "?"])("supports %s help alias", (command) => {
    expect(parseCliArgs([command])).toEqual({ command: "help", topic: null });
  });

  it("parses contextual serve help", () => {
    expect(parseCliArgs(["help", "serve"])).toEqual({ command: "help", topic: "serve" });
    expect(parseCliArgs(["serve", "--help"])).toEqual({ command: "help", topic: "serve" });
  });

  it("rejects unsupported help topics", () => {
    expect(() => parseCliArgs(["help", "init"])).toThrow("Expected help");
    expect(() => parseCliArgs(["help", "serve", "extra"])).toThrow("Expected help");
    expect(() => parseCliArgs(["serve", "--help", "extra"])).toThrow("Unknown flag");
  });

  it("supports serve version and rejects serve unknown flags", () => {
    expect(parseCliArgs(["serve", "-v"])).toEqual({ command: "version" });
    expect(() => parseCliArgs(["serve", "--wat"])).toThrow('Unknown flag "--wat".');
  });

  it("parses serve with an implicit current-directory target", () => {
    expect(parseCliArgs(["serve"])).toEqual({
      command: "serve",
      options: { browser: "never", hasExplicitTarget: true, host: "127.0.0.1", mode: "direct", port: null, target: ".", targets: ["."] }
    });
  });

  it("rejects an implicit target", () => {
    expect(() => parseCliArgs(["./examples"])).toThrow('Use "diagram-tours serve ./examples"');
  });

  it("reads a directory target and skips the wizard", () => {
    expect(parseCliArgs(["serve", "./examples", "--host", "0.0.0.0"])).toEqual({
      command: "serve",
      options: {
        browser: "never",
        hasExplicitTarget: true,
        host: "0.0.0.0",
        mode: "direct",
        port: null,
        target: "./examples",
        targets: ["./examples"]
      }
    });
  });

  it("reads a single tour file target", () => {
    expect(parseCliArgs(["serve", "./examples/flowchart/checkout-payment-flow.tour.yaml"])).toEqual({
      command: "serve",
      options: {
        browser: "never",
        hasExplicitTarget: true,
        host: "127.0.0.1",
        mode: "direct",
        port: null,
        target: "./examples/flowchart/checkout-payment-flow.tour.yaml",
        targets: ["./examples/flowchart/checkout-payment-flow.tour.yaml"]
      }
    });
  });

  it("reads validate targets and defaults to the current directory", () => {
    expect(parseCliArgs(["validate"])).toEqual({
      command: "validate",
      options: {
        target: null
      }
    });
  });

  it("accepts an explicit port override", () => {
    expect(parseCliArgs(["serve", "--port", "9000"])).toEqual({
      command: "serve",
      options: {
        browser: "never",
        hasExplicitTarget: true,
        host: "127.0.0.1",
        mode: "direct",
        port: 9000,
        target: ".",
        targets: ["."]
      }
    });
  });

  it("reads the short version flag", () => {
    expect(parseCliArgs(["-v"])).toEqual({
      command: "version"
    });
  });

  it("reads the long version flag", () => {
    expect(parseCliArgs(["--version"])).toEqual({
      command: "version"
    });
  });

  it("lets version mode win over an explicit target in either order", () => {
    expect(parseCliArgs(["serve", "--version", "./examples"])).toEqual({
      command: "version"
    });
    expect(parseCliArgs(["serve", "./examples", "--version"])).toEqual({
      command: "version"
    });
  });

  it("lets version mode win over explicit browser-opening flags", () => {
    expect(parseCliArgs(["serve", "--version", "--open"])).toEqual({
      command: "version"
    });
    expect(parseCliArgs(["serve", "--version", "--no-open"])).toEqual({
      command: "version"
    });
  });

  it("accepts an explicit open policy", () => {
    expect(parseCliArgs(["serve", "./examples", "--open"])).toEqual({
      command: "serve",
      options: {
        browser: "always",
        hasExplicitTarget: true,
        host: "127.0.0.1",
        mode: "direct",
        port: null,
        target: "./examples",
        targets: ["./examples"]
      }
    });
  });

  it("lets no-open override direct startup explicitly", () => {
    expect(parseCliArgs(["serve", "./examples", "--no-open"])).toEqual({
      command: "serve",
      options: {
        browser: "never",
        hasExplicitTarget: true,
        host: "127.0.0.1",
        mode: "direct",
        port: null,
        target: "./examples",
        targets: ["./examples"]
      }
    });
  });

  it("parses setup with the default agent install flag", () => {
    expect(parseCliArgs(["setup", "--agent"])).toEqual({
      command: "setup",
      options: {
        agent: "default",
        agentPath: null,
        overwrite: false
      }
    });
  });

  it("parses setup with a custom agent path", () => {
    expect(parseCliArgs(["setup", "--agent-path", ".codex/agents/diagram-tours-author.toml"])).toEqual({
      command: "setup",
      options: {
        agent: "default",
        agentPath: ".codex/agents/diagram-tours-author.toml",
        overwrite: false
      }
    });
  });

  it("parses validate with no explicit target", () => {
    expect(parseCliArgs(["validate"])).toEqual({
      command: "validate",
      options: {
        target: null
      }
    });
  });

  it("parses validate with one explicit target", () => {
    expect(parseCliArgs(["validate", "./examples"])).toEqual({
      command: "validate",
      options: {
        target: "./examples"
      }
    });
  });

  it("rejects multiple validate targets", () => {
    expect(() => parseCliArgs(["validate", "./examples", "./docs"])).toThrow(
      "Expected validate to receive zero or one target path."
    );
  });

  it("parses init with overwrite and a diagram target", () => {
    expect(parseCliArgs(["init", "--overwrite", "./examples/flowchart/checkout-payment-flow.mmd"])).toEqual({
      command: "init",
      options: {
        overwrite: true,
        target: "./examples/flowchart/checkout-payment-flow.mmd"
      }
    });
  });

  it("parses init with a markdown fragment target", () => {
    expect(parseCliArgs(["init", "./docs/checklist.md#review"])).toEqual({
      command: "init",
      options: {
        overwrite: false,
        target: "./docs/checklist.md#review"
      }
    });
  });

  it("parses init with an empty-tour target", () => {
    expect(parseCliArgs(["init", "./examples/flowchart/checkout-payment-flow.tour.yaml"])).toEqual({
      command: "init",
      options: {
        overwrite: false,
        target: "./examples/flowchart/checkout-payment-flow.tour.yaml"
      }
    });
  });

  it("rejects invalid ports", () => {
    expect(() => parseCliArgs(["serve", "--port", "wat"])).toThrow("Expected --port to be an integer.");
  });

  it("rejects out-of-range ports", () => {
    expect(() => parseCliArgs(["serve", "--port", "70000"])).toThrow(
      "Expected --port to be between 1 and 65535."
    );
  });

  it("rejects a missing host value at end of input", () => {
    expect(() => parseCliArgs(["serve", "--host"])).toThrow("Expected a value after --host.");
  });

  it("rejects a missing host value when the next token is another flag", () => {
    expect(() => parseCliArgs(["serve", "--host", "--open"])).toThrow("Expected a value after --host.");
  });

  it("rejects a missing port value at end of input", () => {
    expect(() => parseCliArgs(["serve", "--port"])).toThrow("Expected a value after --port.");
  });

  it("rejects a missing port value when the next token is another flag", () => {
    expect(() => parseCliArgs(["serve", "--port", "--open"])).toThrow("Expected a value after --port.");
  });

  it("rejects conflicting browser flags", () => {
    expect(() => parseCliArgs(["serve", "--open", "--no-open"])).toThrow(
      "Choose either --open or --no-open."
    );
  });

  it("rejects validate with browser or server flags", () => {
    expect(() => parseCliArgs(["validate", "--port", "9000"])).toThrow(
      "Expected validate to receive zero or one target path."
    );
  });

  it("rejects more than one positional target", () => {
    expect(() => parseCliArgs(["serve", "./examples", "./fixtures"])).toThrow("Only one target path may be provided.");
  });

  it("rejects init without a target", () => {
    expect(() => parseCliArgs(["init"])).toThrow("Expected init to receive a target path.");
  });

  it("rejects multiple init targets", () => {
    expect(() => parseCliArgs(["init", "./one.mmd", "./two.mmd"])).toThrow("Only one target path may be provided to init.");
  });

  it("rejects unknown init flags", () => {
    expect(() => parseCliArgs(["init", "--wat", "./one.mmd"])).toThrow(
      'Unknown flag "--wat" for init.'
    );
  });

  it("rejects multiple validate targets", () => {
    expect(() => parseCliArgs(["validate", "./examples", "./fixtures"])).toThrow(
      "Expected validate to receive zero or one target path."
    );
  });

  it("rejects a flag-like validate target", () => {
    expect(() => parseCliArgs(["validate", "--wat"])).toThrow(
      "Expected validate to receive zero or one target path."
    );
  });

  it("rejects conflicting setup agent modes", () => {
    expect(() => parseCliArgs(["setup", "--agent", "--agent-path", "custom.toml"])).toThrow(
      "Choose only one setup agent installation mode."
    );
  });

  it("rejects conflicting setup agent modes in reverse order", () => {
    expect(() => parseCliArgs(["setup", "--agent-path", "custom.toml", "--agent"])).toThrow(
      "Choose only one setup agent installation mode."
    );
  });

  it("parses setup overwrite and no-agent flags", () => {
    expect(parseCliArgs(["setup", "--no-agent", "--overwrite"])).toEqual({
      command: "setup",
      options: {
        agent: "none",
        agentPath: null,
        overwrite: true
      }
    });
  });

  it("rejects unexpected setup positional arguments", () => {
    expect(() => parseCliArgs(["setup", "./somewhere"])).toThrow(
      'Unexpected positional argument "./somewhere" for setup.'
    );
  });

  it("rejects unknown setup flags", () => {
    expect(() => parseCliArgs(["setup", "--wat"])).toThrow('Unknown flag "--wat" for setup.');
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow('Unknown command or target "--wat".');
  });
});
