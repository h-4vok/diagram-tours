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

    assignPositional(state, value);
  }

  return finalizeState(state);
}

function createInitialState() {
  return {
    browser: "prompt" as BrowserPreference,
    host: DEFAULT_HOST,
    mode: "wizard" as ParsedCliArgs["mode"],
    hasLaunchFlags: false,
    port: null as number | null,
    target: null as string | null,
    targets: [] as string[]
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

function assignPositional(state: ReturnType<typeof createInitialState>, value: string): void {
  if (isValidateMode(state)) {
    appendValidateTarget(state, value);
    return;
  }

  if (isValidateCommand(state, value)) {
    enableValidateMode(state);
    return;
  }

  assignTarget(state, value);
}

function isValidateMode(state: ReturnType<typeof createInitialState>): boolean {
  return state.mode === "validate";
}

function appendValidateTarget(state: ReturnType<typeof createInitialState>, value: string): void {
  state.targets.push(value);
}

function isValidateCommand(state: ReturnType<typeof createInitialState>, value: string): boolean {
  return state.target === null && value === "validate";
}

function enableValidateMode(state: ReturnType<typeof createInitialState>): void {
  state.mode = "validate";
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
  state.hasLaunchFlags = true;

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
    return finalizeVersionState(state);
  }

  if (state.mode === "validate") {
    return finalizeValidateState(state);
  }

  return finalizeDirectOrWizardState(state);
}

function finalizeVersionState(state: ReturnType<typeof createInitialState>): ParsedCliArgs {
  return {
    browser: "never",
    hasExplicitTarget: false,
    host: state.host,
    mode: "version",
    port: null,
    target: null,
    targets: []
  };
}

function finalizeValidateState(state: ReturnType<typeof createInitialState>): ParsedCliArgs {
  assertValidateLaunchFlags(state.hasLaunchFlags);
  const targets = readValidateTargets(state.targets);
  return {
    browser: "never",
    hasExplicitTarget: true,
    host: state.host,
    mode: "validate",
    port: null,
    target: targets[0]!,
    targets
  };
}

function assertValidateLaunchFlags(hasLaunchFlags: boolean): void {
  if (hasLaunchFlags) {
    throw new Error("validate does not accept browser or server flags.");
  }
}

function readValidateTargets(targets: string[]): string[] {
  return targets.length === 0 ? ["."] : targets;
}

function finalizeDirectOrWizardState(state: ReturnType<typeof createInitialState>): ParsedCliArgs {
  const hasExplicitTarget = state.target !== null;

  return {
    browser: readBrowserPreference(state.browser, hasExplicitTarget),
    hasExplicitTarget,
    host: state.host,
    mode: readMode(hasExplicitTarget),
    port: state.port,
    target: state.target,
    targets: state.target === null ? [] : [state.target]
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
    state.hasLaunchFlags = true;
    state.host = readFlagValue("--host", input[index + 1]);
    return index + 1;
  },
  "--port"(input, index, state) {
    state.hasLaunchFlags = true;
    state.port = readPort(readFlagValue("--port", input[index + 1]));
    return index + 1;
  },
  "--open"(_input, index, state) {
    state.hasLaunchFlags = true;
    assignBrowserPreference(state, "always");
    return index;
  },
  "--no-open"(_input, index, state) {
    state.hasLaunchFlags = true;
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
