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
      target: null
    });
  });

  it("reads a directory target and skips the wizard", () => {
    expect(parseCliArgs(["./examples", "--host", "0.0.0.0"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "0.0.0.0",
      mode: "direct",
      port: null,
      target: "./examples"
    });
  });

  it("reads a single tour file target", () => {
    expect(parseCliArgs(["./examples/payment-flow/payment-flow.tour.yaml"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "direct",
      port: null,
      target: "./examples/payment-flow/payment-flow.tour.yaml"
    });
  });

  it("accepts an explicit port override", () => {
    expect(parseCliArgs(["--port", "9000"])).toEqual({
      browser: "prompt",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "wizard",
      port: 9000,
      target: null
    });
  });

  it("reads the short version flag", () => {
    expect(parseCliArgs(["-v"])).toEqual({
      browser: "never",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "version",
      port: null,
      target: null
    });
  });

  it("reads the long version flag", () => {
    expect(parseCliArgs(["--version"])).toEqual({
      browser: "never",
      hasExplicitTarget: false,
      host: "127.0.0.1",
      mode: "version",
      port: null,
      target: null
    });
  });

  it("accepts an explicit open policy", () => {
    expect(parseCliArgs(["./examples", "--open"])).toEqual({
      browser: "always",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "direct",
      port: null,
      target: "./examples"
    });
  });

  it("lets no-open override direct startup explicitly", () => {
    expect(parseCliArgs(["./examples", "--no-open"])).toEqual({
      browser: "never",
      hasExplicitTarget: true,
      host: "127.0.0.1",
      mode: "direct",
      port: null,
      target: "./examples"
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

  it("rejects more than one positional target", () => {
    expect(() => parseCliArgs(["./examples", "./fixtures"])).toThrow(
      "Only one target path may be provided."
    );
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow('Unknown flag "--wat".');
  });
});
