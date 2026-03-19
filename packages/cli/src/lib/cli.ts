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

export async function runCli(args: string[], opener: BrowserOpener = defaultBrowserOpener): Promise<number> {
  const parsed = parseCliArgs(args);
  const versionExitCode = writeVersionIfRequested(parsed.mode);

  if (versionExitCode !== null) {
    return versionExitCode;
  }

  const launch = await resolveLaunchOptions(parsed);

  await loadResolvedTourCollection(launch.target);

  const binding = await readBinding(launch);
  const server = await startWebServer({
    binding,
    target: launch.target
  });

  output.write(`Diagram Tours is available at ${server.url}\n`);

  await openBrowserIfNeeded(opener, {
    browser: launch.browser,
    mode: parsed.mode,
    url: server.url
  });

  return await waitForExit(server.child);
}

async function resolveLaunchOptions(parsed: ParsedCliArgs): Promise<ResolvedLaunchOptions> {
  return parsed.mode === "wizard" ? promptForLaunchOptions(parsed) : readDirectLaunch(parsed);
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
