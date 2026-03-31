import { createInterface } from "node:readline/promises";
import type { ChildProcess } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";

import {
  loadResolvedTourCollection,
  validateResolvedTourTargets,
  type TourValidationIssue
} from "@diagram-tour/parser";
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
type ValidateResult = {
  kind: "validate";
  targets: string[];
};
type ExecutionPlan =
  | { code: number; kind: "exit" }
  | ValidateResult
  | { kind: "launch"; launch: ResolvedLaunchOptions; mode: ParsedCliArgs["mode"] };

export async function runCli(args: string[], opener: BrowserOpener = defaultBrowserOpener): Promise<number> {
  const executionPlan = await readExecutionPlan(args);
  return await handleExecutionPlan(executionPlan, opener);
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

async function readExecutionPlan(args: string[]): Promise<ExecutionPlan> {
  const parsed = parseCliArgs(args);
  const versionExitCode = writeVersionIfRequested(parsed.mode);

  if (versionExitCode !== null) {
    return {
      code: versionExitCode,
      kind: "exit"
    };
  }

  if (parsed.mode === "validate") {
    return {
      kind: "validate",
      targets: parsed.targets
    };
  }

  return await readLaunchExecutionPlan(parsed);
}

async function readLaunchExecutionPlan(parsed: ParsedCliArgs): Promise<ExecutionPlan> {
  const launchResult = await resolveLaunchOptions(parsed);

  if (launchResult.kind === "exit") {
    return launchResult;
  }

  return {
    kind: "launch",
    launch: launchResult.launch,
    mode: parsed.mode
  };
}

async function handleExecutionPlan(
  executionPlan: ExecutionPlan,
  opener: BrowserOpener
): Promise<number> {
  if (executionPlan.kind === "exit") {
    return executionPlan.code;
  }

  if (executionPlan.kind === "validate") {
    return await runValidate(executionPlan.targets);
  }

  return await runLaunch(executionPlan.mode, executionPlan.launch, opener);
}

async function runValidate(targets: string[]): Promise<number> {
  const report = await validateResolvedTourTargets(targets);

  output.write(`${report.valid}/${report.total} tours valid.\n`);

  if (report.issues.length === 0) {
    return 0;
  }

  for (const issue of report.issues) {
    process.stderr.write(`${formatValidationIssue(issue)}\n`);
  }

  return 1;
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

function formatValidationIssue(issue: TourValidationIssue): string {
  const location = issue.diagnostic.location;
  const locationText = location === null ? "" : `:${location.line}:${location.column}`;

  return `${issue.sourceId}${locationText} ${issue.diagnostic.message}`;
}
