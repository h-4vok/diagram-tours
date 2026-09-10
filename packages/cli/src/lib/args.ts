import type {
  BrowserPreference,
  ParsedCliArgs,
  ParsedInitArgs,
  ParsedSetupArgs,
  ParsedStartupArgs,
  ParsedValidateArgs
} from "./types.js";

const DEFAULT_HOST = "127.0.0.1";
const HELP_COMMAND = "help";
const SERVE_COMMAND = "serve";
const INIT_COMMAND = "init";
const SETUP_COMMAND = "setup";
const VALIDATE_COMMAND = "validate";

// eslint-disable-next-line complexity
export function parseCliArgs(input: string[]): ParsedCliArgs {
  const first = input[0] ?? HELP_COMMAND;
  switch (first) {
    case HELP_COMMAND:
    case "?": return parseHelpArgs(input.slice(1));
    case "--version":
    case "-v": return { command: "version" };
    case SERVE_COMMAND:
    case INIT_COMMAND:
    case SETUP_COMMAND:
    case VALIDATE_COMMAND: return parseSubcommandArgs(first, input.slice(1));
    default: throw new Error(`Unknown command or target "${first}". Use "diagram-tours serve ${first}" or "diagram-tours help".`);
  }
}

type ParsedStartupOrVersionArgs =
  | Extract<ParsedCliArgs, { command: "serve" }>
  | Extract<ParsedCliArgs, { command: "version" }>;

function parseStartupArgs(input: string[]): ParsedStartupOrVersionArgs {
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

function readStartupCommand(state: ReturnType<typeof createInitialState>): ParsedStartupOrVersionArgs {
  return state.mode === "version"
    ? { command: "version" }
    : {
        command: "serve",
        options: finalizeState(state)
      };
}

function createInitialState() {
  return {
    browser: "prompt" as BrowserPreference,
    host: DEFAULT_HOST,
    mode: "direct" as ParsedStartupArgs["mode"] | "version",
    port: null as number | null,
    target: null as string | null,
    targets: [] as string[]
  };
}

// eslint-disable-next-line complexity
function parseSubcommandArgs(
  command: "serve" | "init" | "setup" | "validate",
  input: string[]
): ParsedCliArgs {
  switch (command) {
    case SERVE_COMMAND: return parseServeCommand(input);
    case SETUP_COMMAND: return { command, options: parseSetupArgs(input) };
    case VALIDATE_COMMAND: return { command, options: parseValidateArgs(input) };
    case INIT_COMMAND: return { command, options: parseInitArgs(input) };
  }
}

// eslint-disable-next-line complexity
function parseServeCommand(input: string[]): ParsedCliArgs {
  if (input[0] === "--help" && input.length === 1) {
    return { command: "help", topic: "serve" };
  }
  const parsed = parseStartupArgs(input);
  return parsed.command === "version" ? parsed : { command: "serve", options: parseServeArgs(parsed.options) };
}

// eslint-disable-next-line complexity
function parseHelpArgs(input: string[]): Extract<ParsedCliArgs, { command: "help" }> {
  switch (input.length) {
    case 0: return { command: "help", topic: null };
    case 1:
      if (input[0] === SERVE_COMMAND) {
        return { command: "help", topic: "serve" };
      }
      break;
    default: break;
  }
  throw new Error('Expected help to receive no arguments or "serve".');
}

function parseServeArgs(options: Extract<ParsedCliArgs, { command: "serve" }>['options']): Extract<ParsedCliArgs, { command: "serve" }>['options'] {
  const target = options.target ?? ".";
  return { ...options, browser: options.browser === "prompt" ? "never" : options.browser, mode: "direct", hasExplicitTarget: true, target, targets: [target] };
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
  assignTarget(state, value);
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

function finalizeState(state: ReturnType<typeof createInitialState>): ParsedStartupArgs {
  return finalizeDirectOrWizardState(state);
}

function finalizeDirectOrWizardState(state: ReturnType<typeof createInitialState>): ParsedStartupArgs {
  const hasExplicitTarget = state.target !== null;

  return {
    browser: readBrowserPreference(state.browser, hasExplicitTarget),
    hasExplicitTarget,
    host: state.host,
    mode: readMode(),
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

function readMode(): ParsedStartupArgs["mode"] {
  return "direct";
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
    throw new Error("Expected init to receive a target path.");
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
    throw new Error("Only one target path may be provided to init.");
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
