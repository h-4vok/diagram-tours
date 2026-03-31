import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../src/lib/args.js";

describe("parseCliArgs", () => {
  it("uses the wizard when no target is provided", () => {
    expect(parseCliArgs([])).toEqual({
      browser: "prompt",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "wizard",
      port: null,
      target: null,
      targets: []
    });
  });

  it("reads a directory target and skips the wizard", () => {
    expect(parseCliArgs(["./examples", "--host", "0.0.0.0"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "0.0.0.0",
      mode: "direct",
      port: null,
      target: "./examples",
      targets: ["./examples"]
    });
  });

  it("reads a single tour file target", () => {
    expect(parseCliArgs(["./examples/checkout-payment-flow.tour.yaml"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "direct",
      port: null,
      target: "./examples/checkout-payment-flow.tour.yaml",
      targets: ["./examples/checkout-payment-flow.tour.yaml"]
    });
  });

  it("reads validate targets and defaults to the current directory", () => {
    expect(parseCliArgs(["validate"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "validate",
      port: null,
      target: ".",
      targets: ["."]
    });
  });

  it("reads multiple validate targets", () => {
    expect(parseCliArgs(["validate", "./examples", "./docs"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "validate",
      port: null,
      target: "./examples",
      targets: ["./examples", "./docs"]
    });
  });

  it("accepts an explicit port override", () => {
    expect(parseCliArgs(["--port", "9000"])).toEqual({
      browser: "prompt",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "wizard",
      port: 9000,
      target: null,
      targets: []
    });
  });

  it("reads the short version flag", () => {
    expect(parseCliArgs(["-v"])).toEqual({
      browser: "never",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "version",
      port: null,
      target: null,
      targets: []
    });
  });

  it("reads the long version flag", () => {
    expect(parseCliArgs(["--version"])).toEqual({
      browser: "never",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "version",
      port: null,
      target: null,
      targets: []
    });
  });

  it("accepts an explicit open policy", () => {
    expect(parseCliArgs(["./examples", "--open"])).toEqual({
      browser: "always",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "direct",
      port: null,
      target: "./examples",
      targets: ["./examples"]
    });
  });

  it("lets no-open override direct startup explicitly", () => {
    expect(parseCliArgs(["./examples", "--no-open"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "direct",
      port: null,
      target: "./examples",
      targets: ["./examples"]
    });
  });

  it("rejects invalid ports", () => {
    expect(() => parseCliArgs(["--port", "wat"])).toThrow("Expected --port to be an integer.");
  });

  it("rejects out-of-range ports", () => {
    expect(() => parseCliArgs(["--port", "70000"])).toThrow(
      "Expected --port to be between 1 and 65535."
    );
  });

  it("rejects missing flag values", () => {
    expect(() => parseCliArgs(["--host"])).toThrow("Expected a value after --host.");
  });

  it("rejects conflicting browser flags", () => {
    expect(() => parseCliArgs(["--open", "--no-open"])).toThrow(
      "Choose either --open or --no-open."
    );
  });

  it("rejects validate with browser or server flags", () => {
    expect(() => parseCliArgs(["validate", "--port", "9000"])).toThrow(
      "validate does not accept browser or server flags."
    );
  });

  it("rejects more than one positional target", () => {
    expect(() => parseCliArgs(["./examples", "./fixtures"])).toThrow(
      "Only one target path may be provided."
    );
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow('Unknown flag "--wat".');
  });
});
