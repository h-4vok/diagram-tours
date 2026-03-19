import type { BrowserPreference, ParsedCliArgs } from "./types.js";

const DEFAULT_HOST = "127.0.0.1";

export function parseCliArgs(input: string[]): ParsedCliArgs {
  const state = createInitialState();

  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];

    if (value.startsWith("-")) {
      index = readFlag(input, index, state);

      continue;
    }

    assignTarget(state, value);
  }

  return finalizeState(state);
}

function createInitialState() {
  return {
    browser: "prompt" as BrowserPreference,
    host: DEFAULT_HOST,
    mode: "wizard" as ParsedCliArgs["mode"],
    port: null as number | null,
    target: null as string | null
  };
}

function readFlag(
  input: string[],
  index: number,
  state: ReturnType<typeof createInitialState>
): number {
  const flag = input[index];
  const handler = FLAG_HANDLERS[flag];

  if (handler === undefined) {
    throw new Error(`Unknown flag "${flag}".`);
  }

  return handler(input, index, state);
}

function readFlagValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Expected a value after ${flag}.`);
  }

  return value;
}

function readPort(input: string): number {
  const port = Number(input);

  assertIntegerPort(port);
  assertPortRange(port);

  return port;
}

function assertIntegerPort(port: number): void {
  if (!Number.isInteger(port)) {
    throw new Error("Expected --port to be an integer.");
  }
}

function assertPortRange(port: number): void {
  if (port < 1 || port > 65_535) {
    throw new Error("Expected --port to be between 1 and 65535.");
  }
}

function assignBrowserPreference(
  state: ReturnType<typeof createInitialState>,
  browser: Exclude<BrowserPreference, "prompt">
): void {
  if (state.browser !== "prompt" && state.browser !== browser) {
    throw new Error("Choose either --open or --no-open.");
  }

  state.browser = browser;
}

function assignTarget(state: ReturnType<typeof createInitialState>, target: string): void {
  if (state.target !== null) {
    throw new Error("Only one target path may be provided.");
  }

  state.target = target;
}

function finalizeState(state: ReturnType<typeof createInitialState>): ParsedCliArgs {
  if (state.mode === "version") {
    return {
      browser: "never",
      hasExplicitTarget: false,
      host: state.host,
      mode: "version",
      port: null,
      target: null
    };
  }

  const hasExplicitTarget = state.target !== null;

  return {
    browser: readBrowserPreference(state.browser, hasExplicitTarget),
    hasExplicitTarget,
    host: state.host,
    mode: readMode(hasExplicitTarget),
    port: state.port,
    target: state.target
  };
}

function readBrowserPreference(browser: BrowserPreference, hasExplicitTarget: boolean): BrowserPreference {
  if (hasExplicitTarget && browser === "prompt") {
    return "never";
  }

  return browser;
}

function readMode(hasExplicitTarget: boolean): ParsedCliArgs["mode"] {
  return hasExplicitTarget ? "direct" : "wizard";
}

const FLAG_HANDLERS: Partial<Record<
  string,
  (
    input: string[],
    index: number,
    state: ReturnType<typeof createInitialState>
  ) => number
>> = {
  "--host"(input, index, state) {
    state.host = readFlagValue("--host", input[index + 1]);
    return index + 1;
  },
  "--port"(input, index, state) {
    state.port = readPort(readFlagValue("--port", input[index + 1]));
    return index + 1;
  },
  "--open"(_input, index, state) {
    assignBrowserPreference(state, "always");
    return index;
  },
  "--no-open"(_input, index, state) {
    assignBrowserPreference(state, "never");
    return index;
  },
  "--version"(_input, index, state) {
    state.mode = "version";
    return index;
  },
  "-v"(_input, index, state) {
    state.mode = "version";
    return index;
  }
};
