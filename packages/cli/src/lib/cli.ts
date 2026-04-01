import type { ChildProcess } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadResolvedTourCollection } from "@diagram-tour/parser";

import { parseCliArgs } from "./args.js";
import { defaultBrowserOpener, type BrowserOpener } from "./browser.js";
import { resolveBrowserOpenPolicy } from "./browser-policy.js";
import { runInitCommand } from "./init.js";
import { resolveServerBinding } from "./port-policy.js";
import { startWebServer } from "./server.js";
import { runSetupCommand } from "./setup.js";
import { validateTargetPath } from "./target.js";
import type { ParsedStartupArgs, PromptIo, ResolvedLaunchOptions } from "./types.js";
import { runValidateCommand } from "./validate.js";
import { readCliVersion } from "./version.js";
import { runWizard } from "./wizard.js";

type LaunchResult = { code: number; kind: "exit" } | { kind: "launch"; launch: ResolvedLaunchOptions };
export async function runCli(args: string[], opener: BrowserOpener = defaultBrowserOpener): Promise<number> {
  const parsed = parseCliArgs(args);

  return await dispatchParsedArgs(parsed, opener);
}

async function dispatchParsedArgs(
  parsed:
    | { command: "init"; options: { overwrite: boolean; target: string } }
    | { command: "setup"; options: Parameters<typeof runSetupCommand>[0] }
    | { command: "startup"; options: ParsedStartupArgs }
    | { command: "validate"; options: Parameters<typeof runValidateCommand>[0] }
    | { command: "version" },
  opener: BrowserOpener
): Promise<number> {
  return await CLI_COMMAND_HANDLERS[parsed.command](parsed, opener);
}

const CLI_COMMAND_HANDLERS = {
  init(parsed: Extract<Parameters<typeof dispatchParsedArgs>[0], { command: "init" }>) {
    return runInitCommand(parsed.options);
  },
  setup(parsed: Extract<Parameters<typeof dispatchParsedArgs>[0], { command: "setup" }>) {
    return withPromptIo((io) => runSetupCommand(parsed.options, io));
  },
  startup(parsed: Extract<Parameters<typeof dispatchParsedArgs>[0], { command: "startup" }>, opener: BrowserOpener) {
    return runStartupCommand(parsed.options, opener);
  },
  validate(parsed: Extract<Parameters<typeof dispatchParsedArgs>[0], { command: "validate" }>) {
    return runValidateCommand(parsed.options);
  },
  version() {
    output.write(`diagram-tours ${readCliVersion()}\n`);
    return Promise.resolve(0);
  }
} satisfies Record<
  Parameters<typeof dispatchParsedArgs>[0]["command"],
  (parsed: Parameters<typeof dispatchParsedArgs>[0], opener: BrowserOpener) => Promise<number>
>;

async function runStartupCommand(parsed: ParsedStartupArgs, opener: BrowserOpener): Promise<number> {
  const launchResult = parsed.mode === "wizard" ? await readWizardLaunch(parsed) : readDirectLaunch(parsed);

  if (launchResult.kind === "exit") {
    return launchResult.code;
  }

  return await runLaunch(parsed.mode, launchResult.launch, opener);
}

async function runLaunch(
  mode: ParsedStartupArgs["mode"],
  launch: ResolvedLaunchOptions,
  opener: BrowserOpener
): Promise<number> {
  await loadResolvedTourCollection(launch.target);
  const server = await startLaunchServer(launch);

  await openBrowserIfNeeded(opener, {
    browser: launch.browser,
    mode,
    url: server.url
  });

  return await waitForExit(server.child);
}

async function withPromptIo<T>(action: (io: PromptIo) => Promise<T>): Promise<T> {
  const readline = createInterface({ input, output });

  try {
    return await action({
      question(prompt) {
        return readline.question(prompt);
      },
      write(text: string) {
        output.write(text);
      }
    });
  } finally {
    readline.close();
  }
}

async function readWizardLaunch(parsed: ParsedStartupArgs): Promise<LaunchResult> {
  try {
    return {
      kind: "launch",
      launch: await withPromptIo((io) => runWizard(io, parsed))
    };
  } catch (error) {
    return handleWizardLaunchError(error);
  }
}

function readDirectLaunch(parsed: ParsedStartupArgs): LaunchResult {
  return {
    kind: "launch",
    launch: {
      browser: parsed.browser as ResolvedLaunchOptions["browser"],
      host: parsed.host,
      port: parsed.port,
      target: validateTargetPath(parsed.target as string)
    }
  };
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise<number>((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code) => {
      resolveExit(Number(code));
    });
  });
}

function readBinding(launch: ResolvedLaunchOptions) {
  return resolveServerBinding({
    host: launch.host,
    requestedPort: launch.port
  });
}

async function startLaunchServer(launch: ResolvedLaunchOptions) {
  const server = await startWebServer({
    binding: await readBinding(launch),
    target: launch.target
  });

  output.write(`Diagram Tours is available at ${server.url}\n`);

  return server;
}

async function openBrowserIfNeeded(
  opener: BrowserOpener,
  options: {
    browser: ResolvedLaunchOptions["browser"];
    mode: ParsedStartupArgs["mode"];
    url: string;
  }
): Promise<void> {
  if (!resolveBrowserOpenPolicy({ browser: options.browser, mode: options.mode })) {
    return;
  }

  await opener.open(options.url);
}

function isWizardCancellationError(error: unknown): boolean {
  return error instanceof Error && error.message === "readline was closed";
}

function handleWizardLaunchError(error: unknown): LaunchResult {
  if (isWizardCancellationError(error)) {
    return { code: 130, kind: "exit" };
  }

  throw error;
}
