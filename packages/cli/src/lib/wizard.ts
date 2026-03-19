import { validateTargetPath } from "./target.js";
import type { BrowserPreference, ResolvedLaunchOptions } from "./types.js";

export interface WizardIo {
  question: (prompt: string) => Promise<string>;
  write: (text: string) => void;
}

export async function runWizard(
  io: WizardIo,
  defaults: { browser: BrowserPreference; host: string; port: number | null }
): Promise<ResolvedLaunchOptions> {
  const target = await readTarget(io);
  const browser = await readBrowser(io, defaults.browser);

  return {
    browser,
    host: await readHost(io, defaults.host),
    port: await readPort(io, defaults.port),
    target
  };
}

async function readTarget(io: WizardIo): Promise<string> {
  for (;;) {
    io.write(
      "\nChoose what to open:\n1. Open current directory\n2. Open another directory\n3. Open a diagram or tour file\n"
    );
    const choice = await readTargetChoice(io);

    try {
      return resolveWizardTarget(await readChoiceTarget(io, choice));
    } catch (error) {
      handlePromptFailure(io, error);
    }
  }
}

async function readTargetChoice(io: WizardIo): Promise<string> {
  return (await io.question("Select an option: ")).trim();
}

async function readChoiceTarget(io: WizardIo, choice: string): Promise<string> {
  if (choice === "1") {
    return ".";
  }

  return await readValidatedPromptedTarget(io, choice);
}

async function readValidatedPromptedTarget(io: WizardIo, choice: string): Promise<string> {
  const prompt = readTargetPrompt(choice);

  for (;;) {
    try {
      return resolveWizardTarget(await io.question(prompt));
    } catch (error) {
      handlePromptFailure(io, error);
    }
  }
}

function readTargetPrompt(choice: string): string {
  const prompt = TARGET_PROMPTS[choice];

  if (prompt === undefined) {
    throw new Error("Enter 1, 2, or 3.");
  }

  return prompt;
}

function resolveWizardTarget(input: string): string {
  return validateTargetPath(input);
}

async function readBrowser(
  io: WizardIo,
  browser: BrowserPreference
): Promise<ResolvedLaunchOptions["browser"]> {
  if (browser !== "prompt") {
    return browser;
  }

  const selection = readBrowserSelection(
    (await io.question("Open the browser now? (y/n): ")).trim().toLowerCase()
  );

  if (selection !== null) {
    return selection;
  }

  io.write("Enter y or n.\n");
  return await readBrowser(io, browser);
}

async function readHost(io: WizardIo, defaultHost: string): Promise<string> {
  const answer = (await io.question(`Host override (press enter for ${defaultHost}): `)).trim();

  return answer === "" ? defaultHost : answer;
}

async function readPort(io: WizardIo, defaultPort: number | null): Promise<number | null> {
  const port = readPortOverride(
    (await io.question("Port override (press enter for automatic): ")).trim()
  );

  if (port.kind === "default") {
    return defaultPort;
  }

  if (port.kind === "value") {
    return port.value;
  }

  io.write("Enter a port between 1 and 65535, or press enter.\n");
  return await readPort(io, defaultPort);
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not resolve that path.";
}

function handlePromptFailure(io: WizardIo, error: unknown): void {
  if (isClosedReadlineError(error)) {
    throw error;
  }

  io.write(`${readErrorMessage(error)}\n`);
}

function isClosedReadlineError(error: unknown): boolean {
  return error instanceof Error && error.message === "readline was closed";
}

function readBrowserSelection(
  answer: string
): ResolvedLaunchOptions["browser"] | null {
  return YES_ANSWERS.includes(answer) ? "always" : NO_ANSWERS.includes(answer) ? "never" : null;
}

function readPortOverride(answer: string): { kind: "default" | "invalid" } | { kind: "value"; value: number } {
  if (answer === "") {
    return { kind: "default" };
  }

  const port = Number(answer);

  if (isPortNumber(port)) {
    return { kind: "value", value: port };
  }

  return { kind: "invalid" };
}

function isPortNumber(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

const NO_ANSWERS = ["n", "no"];
const TARGET_PROMPTS: Partial<Record<string, string>> = {
  "2": "Directory path: ",
  "3": "Diagram or tour file path: "
};
const YES_ANSWERS = ["y", "yes"];
