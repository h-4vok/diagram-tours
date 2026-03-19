import { createInterface } from "node:readline/promises";
import type { ChildProcess } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";

import { loadResolvedTourCollection } from "@diagram-tour/parser";
import { defaultBrowserOpener, type BrowserOpener } from "./browser.js";
import { resolveBrowserOpenPolicy } from "./browser-policy.js";
import { parseCliArgs } from "./args.js";
import { resolveServerBinding } from "./port-policy.js";
import { startWebServer } from "./server.js";
import { validateTargetPath } from "./target.js";
import type { ParsedCliArgs, ResolvedLaunchOptions } from "./types.js";
import { readCliVersion } from "./version.js";
import { runWizard } from "./wizard.js";

type LaunchResult =
  | { code: number; kind: "exit" }
  | { kind: "launch"; launch: ResolvedLaunchOptions };
type StartupPlan =
  | { code: number; kind: "exit" }
  | { kind: "launch"; launch: ResolvedLaunchOptions; mode: ParsedCliArgs["mode"] };

export async function runCli(args: string[], opener: BrowserOpener = defaultBrowserOpener): Promise<number> {
  const startupPlan = await readStartupPlan(args);

  if (startupPlan.kind === "exit") {
    return startupPlan.code;
  }

  return await runLaunch(startupPlan.mode, startupPlan.launch, opener);
}

async function resolveLaunchOptions(parsed: ParsedCliArgs): Promise<LaunchResult> {
  if (parsed.mode !== "wizard") {
    return {
      kind: "launch",
      launch: readDirectLaunch(parsed)
    };
  }

  return await readWizardLaunch(parsed);
}

async function readStartupPlan(args: string[]): Promise<StartupPlan> {
  const parsed = parseCliArgs(args);
  const versionExitCode = writeVersionIfRequested(parsed.mode);

  if (versionExitCode !== null) {
    return {
      code: versionExitCode,
      kind: "exit"
    };
  }

  const launchResult = await resolveLaunchOptions(parsed);

  return launchResult.kind === "exit"
    ? launchResult
    : {
        kind: "launch",
        launch: launchResult.launch,
        mode: parsed.mode
      };
}

function writeVersionIfRequested(mode: ParsedCliArgs["mode"]): number | null {
  if (mode !== "version") {
    return null;
  }

  output.write(`diagram-tours ${readCliVersion()}\n`);

  return 0;
}

async function promptForLaunchOptions(parsed: ParsedCliArgs): Promise<ResolvedLaunchOptions> {
  const readline = createInterface({ input, output });

  try {
    return await runWizard(
      {
        question(prompt) {
          return readline.question(prompt);
        },
        write(text: string) {
          output.write(text);
        }
      },
      parsed
    );
  } finally {
    readline.close();
  }
}

async function readWizardLaunch(parsed: ParsedCliArgs): Promise<LaunchResult> {
  try {
    return {
      kind: "launch",
      launch: await promptForLaunchOptions(parsed)
    };
  } catch (error) {
    return handleWizardLaunchError(error);
  }
}

async function runLaunch(
  mode: ParsedCliArgs["mode"],
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

function readDirectLaunch(parsed: ParsedCliArgs): ResolvedLaunchOptions {
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
    mode: ParsedCliArgs["mode"];
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
