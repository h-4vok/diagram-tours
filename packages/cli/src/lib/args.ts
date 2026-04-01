import type {
  BrowserPreference,
  ParsedCliArgs,
  ParsedInitArgs,
  ParsedSetupArgs,
  ParsedStartupArgs,
  ParsedValidateArgs
} from "./types.js";

const DEFAULT_HOST = "127.0.0.1";
const INIT_COMMAND = "init";
const SETUP_COMMAND = "setup";
const VALIDATE_COMMAND = "validate";
const SUBCOMMANDS = new Set([INIT_COMMAND, SETUP_COMMAND, VALIDATE_COMMAND]);

export function parseCliArgs(input: string[]): ParsedCliArgs {
  const command = readCommand(input);

  if (command !== null) {
    return parseSubcommandArgs(command, input.slice(1));
  }

  return parseStartupArgs(input);
}

function parseStartupArgs(input: string[]): ParsedCliArgs {
  const state = createInitialState();

  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];

    if (value.startsWith("-")) {
      index = readFlag(input, index, state);

      continue;
    }

    assignPositional(state, value);
  }

  return readStartupCommand(state);
}

function readStartupCommand(state: ReturnType<typeof createInitialState>): ParsedCliArgs {
  return state.mode === "version"
    ? { command: "version" }
    : {
        command: "startup",
        options: finalizeState(state)
      };
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

function readCommand(input: string[]): "init" | "setup" | "validate" | null {
  const firstValue = input[0];

  return typeof firstValue === "string" && SUBCOMMANDS.has(firstValue)
    ? (firstValue as "init" | "setup" | "validate")
    : null;
}

function parseSubcommandArgs(
  command: "init" | "setup" | "validate",
  input: string[]
): Extract<ParsedCliArgs, { command: "init" | "setup" | "validate" }> {
  if (command === SETUP_COMMAND) {
    return {
      command,
      options: parseSetupArgs(input)
    };
  }

  if (command === VALIDATE_COMMAND) {
    return {
      command,
      options: parseValidateArgs(input)
    };
  }

  return {
    command,
    options: parseInitArgs(input)
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

function readMode(hasExplicitTarget: boolean): ParsedStartupArgs["mode"] {
  return hasExplicitTarget ? "direct" : "wizard";
}

function parseSetupArgs(input: string[]): ParsedSetupArgs {
  const state = {
    agent: "prompt" as ParsedSetupArgs["agent"],
    agentPath: null as string | null,
    overwrite: false
  };

  for (let index = 0; index < input.length; index += 1) {
    const flag = input[index];

    if (!flag.startsWith("-")) {
      throw new Error(`Unexpected positional argument "${flag}" for setup.`);
    }

    index = readSetupFlag(input, index, state);
  }

  return state;
}

function readSetupFlag(input: string[], index: number, state: ParsedSetupArgs): number {
  const flag = input[index];
  const handler = SETUP_FLAG_HANDLERS[flag];

  if (handler === undefined) {
    throw new Error(`Unknown flag "${flag}" for setup.`);
  }

  return handler(input, index, state);
}

function assignSetupAgentMode(
  state: ParsedSetupArgs,
  agent: Exclude<ParsedSetupArgs["agent"], "prompt">
): void {
  if (state.agent !== "prompt" || state.agentPath !== null) {
    throw new Error("Choose only one setup agent installation mode.");
  }

  state.agent = agent;
}

function assignSetupAgentPath(state: ParsedSetupArgs, agentPath: string): void {
  if (state.agent !== "prompt" || state.agentPath !== null) {
    throw new Error("Choose only one setup agent installation mode.");
  }

  state.agent = "default";
  state.agentPath = agentPath;
}

function parseValidateArgs(input: string[]): ParsedValidateArgs {
  if (input.length === 0) {
    return {
      target: null
    };
  }

  assertSingleValidateTarget(input);

  return {
    target: input[0]!
  };
}

function assertSingleValidateTarget(input: string[]): void {
  if (input.length > 1 || input[0]!.startsWith("-")) {
    throw new Error("Expected validate to receive zero or one target path.");
  }
}

function parseInitArgs(input: string[]): ParsedInitArgs {
  const state = {
    overwrite: false,
    target: null as string | null
  };

  input.forEach((value) => readInitValue(value, state));

  if (state.target === null) {
    throw new Error("Expected init to receive a Mermaid diagram path.");
  }

  return state as ParsedInitArgs;
}

function readInitValue(
  value: string,
  state: {
    overwrite: boolean;
    target: string | null;
  }
): void {
  if (value.startsWith("-")) {
    assignInitFlag(value, state);
    return;
  }

  assignInitTarget(state, value);
}

function assignInitFlag(
  value: string,
  state: {
    overwrite: boolean;
  }
): void {
  if (value !== "--overwrite") {
    throw new Error(`Unknown flag "${value}" for init.`);
  }

  state.overwrite = true;
}

function assignInitTarget(
  state: {
    target: string | null;
  },
  target: string
): void {
  if (state.target !== null) {
    throw new Error("Only one diagram path may be provided to init.");
  }

  state.target = target;
}

const SETUP_FLAG_HANDLERS: Partial<Record<
  string,
  (
    input: string[],
    index: number,
    state: ParsedSetupArgs
  ) => number
>> = {
  "--overwrite"(_input, index, state) {
    state.overwrite = true;
    return index;
  },
  "--agent"(_input, index, state) {
    assignSetupAgentMode(state, "default");
    return index;
  },
  "--no-agent"(_input, index, state) {
    assignSetupAgentMode(state, "none");
    return index;
  },
  "--agent-path"(input, index, state) {
    assignSetupAgentPath(state, readFlagValue("--agent-path", input[index + 1]));
    return index + 1;
  }
};

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
