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
import type { ParsedCliArgs, ParsedStartupArgs, PromptIo, ResolvedLaunchOptions } from "./types.js";
import { runValidateCommand } from "./validate.js";
import { readCliVersion } from "./version.js";
import { writeHelp } from "./help.js";
import { runBuildCommand } from "./build.js";

export async function runCli(args: string[], opener: BrowserOpener = defaultBrowserOpener): Promise<number> {
  const parsed = parseCliArgs(args);

  return await dispatchParsedArgs(parsed, opener);
}
async function dispatchParsedArgs(
  parsed: ParsedCliArgs,
  opener: BrowserOpener
): Promise<number> {
  return await (DISPATCHERS[parsed.command] as (parsed: ParsedCliArgs, opener: BrowserOpener) => Promise<number>)(
    parsed,
    opener
  );
}
type CommandHandlerMap = {
  help(parsed: Extract<ParsedCliArgs, { command: "help" }>, opener: BrowserOpener): Promise<number>;
  init(parsed: Extract<ParsedCliArgs, { command: "init" }>, opener: BrowserOpener): Promise<number>;
  build(parsed: Extract<ParsedCliArgs, { command: "build" }>, opener: BrowserOpener): Promise<number>;
  setup(parsed: Extract<ParsedCliArgs, { command: "setup" }>, opener: BrowserOpener): Promise<number>;
  serve(parsed: Extract<ParsedCliArgs, { command: "serve" }>, opener: BrowserOpener): Promise<number>;
  validate(parsed: Extract<ParsedCliArgs, { command: "validate" }>, opener: BrowserOpener): Promise<number>;
  version(parsed: Extract<ParsedCliArgs, { command: "version" }>, opener: BrowserOpener): Promise<number>;
};

const DISPATCHERS = {
  help: handleHelpCommand,
  init: handleInitCommand,
  build: handleBuildCommand,
  setup: handleSetupCommand,
  serve: handleServeCommand,
  validate: handleValidateCommand,
  version: handleVersionCommand
} satisfies CommandHandlerMap;

async function handleHelpCommand(
  parsed: Extract<ParsedCliArgs, { command: "help" }>,
  _opener: BrowserOpener
): Promise<number> {
  writeHelp(parsed.topic);
  return 0;
}

async function handleBuildCommand(
  parsed: Extract<ParsedCliArgs, { command: "build" }>, opener: BrowserOpener
): Promise<number> {
  return await runBuildCommand(parsed.options, opener);
}
async function handleInitCommand(
  parsed: Extract<ParsedCliArgs, { command: "init" }>,
  _opener: BrowserOpener
): Promise<number> {
  return await withPromptIo((io) => runInitCommand(parsed.options, io));
}

async function handleSetupCommand(
  parsed: Extract<ParsedCliArgs, { command: "setup" }>,
  _opener: BrowserOpener
): Promise<number> {
  return await withPromptIo((io) => runSetupCommand(parsed.options, io));
}

async function handleServeCommand(
  parsed: Extract<ParsedCliArgs, { command: "serve" }>,
  opener: BrowserOpener
): Promise<number> {
  return await runServeCommand(parsed.options, opener);
}

async function handleValidateCommand(
  parsed: Extract<ParsedCliArgs, { command: "validate" }>,
  _opener: BrowserOpener
): Promise<number> {
  return await runValidateCommand(parsed.options);
}

async function handleVersionCommand(
  _parsed: Extract<ParsedCliArgs, { command: "version" }>,
  _opener: BrowserOpener
): Promise<number> {
  output.write(`diagram-tours ${readCliVersion()}\n`);
  return 0;
}

async function runServeCommand(parsed: ParsedStartupArgs, opener: BrowserOpener): Promise<number> {
  return await runLaunch(parsed.mode, readDirectLaunch(parsed), opener);
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

function readDirectLaunch(parsed: ParsedStartupArgs): ResolvedLaunchOptions {
  return {
    browser: parsed.browser as ResolvedLaunchOptions["browser"],
    host: parsed.host,
    port: parsed.port,
    target: validateTargetPath(parsed.target as string)
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

