import { createInterface } from "node:readline/promises";
import type { ChildProcess } from "node:child_process";
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

type LaunchResult =
  | { code: number; kind: "exit" }
  | { kind: "launch"; launch: ResolvedLaunchOptions };

export async function runCli(args: string[], opener: BrowserOpener = defaultBrowserOpener): Promise<number> {
  const parsed = parseCliArgs(args);

  if (parsed.command === "startup") {
    return await runStartupCommand(parsed.options, opener);
  }

  return await runUtilityCommand(parsed);
}

async function runUtilityCommand(
  parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "init" | "setup" | "validate" | "version" }>
): Promise<number> {
  return await readUtilityHandler(parsed.command)(parsed);
}

async function runStartupCommand(
  parsed: ParsedStartupArgs,
  opener: BrowserOpener
): Promise<number> {
  const launchResult = parsed.mode === "wizard" ? await readWizardLaunch(parsed) : readDirectLaunch(parsed);

  if (launchResult.kind === "exit") {
    return launchResult.code;
  }

  await loadResolvedTourCollection(launchResult.launch.target);
  const server = await startLaunchServer(launchResult.launch);

  await openBrowserIfNeeded(opener, {
    browser: launchResult.launch.browser,
    mode: parsed.mode,
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
    return {
      code: 130,
      kind: "exit"
    };
  }

  throw error;
}

const UTILITY_COMMAND_HANDLERS = {
  init(parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "init" }>) {
    return runInitCommand(parsed.options);
  },
  setup(parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "setup" }>) {
    return withPromptIo((io) => runSetupCommand(parsed.options, io));
  },
  validate(parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "validate" }>) {
    return runValidateCommand(parsed.options);
  },
  version(_parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "version" }>) {
    output.write(`diagram-tours ${readCliVersion()}\n`);
    return Promise.resolve(0);
  }
};

function readUtilityHandler(
  command: Extract<ReturnType<typeof parseCliArgs>, { command: "init" | "setup" | "validate" | "version" }>["command"]
): (
  parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "init" | "setup" | "validate" | "version" }>
) => Promise<number> {
  return UTILITY_COMMAND_HANDLERS[command] as (
    parsed: Extract<ReturnType<typeof parseCliArgs>, { command: "init" | "setup" | "validate" | "version" }>
  ) => Promise<number>;
}
