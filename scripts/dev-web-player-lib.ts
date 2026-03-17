import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface DevLaunchOptions {
  sourceTarget: string;
  viteArgs: string[];
}

export interface InteractiveChoice {
  key: "all" | "directory" | "file";
  label: string;
}

export const INTERACTIVE_CHOICES: InteractiveChoice[] = [
  {
    key: "all",
    label: "Open all tours"
  },
  {
    key: "directory",
    label: "Open a directory"
  },
  {
    key: "file",
    label: "Open a .tour.yaml file"
  }
];

export function readSourceTarget(input: string[], defaultTarget: string): string {
  return readParsedDevArgs(input, defaultTarget).sourceTarget;
}

export function readViteArgs(input: string[]): string[] {
  return readParsedDevArgs(input, ".").viteArgs;
}

export function hasExplicitSourceTarget(input: string[]): boolean {
  return readParsedDevArgs(input, ".").hasExplicitSourceTarget;
}

export function readInteractiveChoice(input: string): InteractiveChoice["key"] | null {
  const normalized = input.trim();

  switch (normalized) {
    case "1":
      return "all";
    case "2":
      return "directory";
    case "3":
      return "file";
    default:
      return null;
  }
}

export function describeInteractiveChoices(): string {
  return INTERACTIVE_CHOICES.map((choice, index) => `${index + 1}. ${choice.label}`).join("\n");
}

export function validateSourceTarget(input: string, expectedKind: "any" | "directory" | "file"): string {
  const resolvedTarget = resolve(process.cwd(), input);

  if (!existsSync(resolvedTarget)) {
    throw new Error(`Path does not exist: ${resolvedTarget}`);
  }

  if (expectedKind === "any") {
    return resolvedTarget;
  }

  if (!matchesExpectedKind(resolvedTarget, expectedKind)) {
    throw new Error(readKindMismatchMessage(resolvedTarget, expectedKind));
  }

  if (expectedKind === "file" && !resolvedTarget.endsWith(".tour.yaml")) {
    throw new Error(`Expected a .tour.yaml file: ${resolvedTarget}`);
  }

  return resolvedTarget;
}

export function spawnWebPlayer(options: DevLaunchOptions): Bun.Subprocess {
  const bunExecutable = process.execPath;

  return Bun.spawn([bunExecutable, "run", "--cwd", "packages/web-player", "dev", ...options.viteArgs], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DIAGRAM_TOUR_SOURCE_TARGET: resolve(process.cwd(), options.sourceTarget)
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
}

function matchesExpectedKind(pathname: string, expectedKind: "directory" | "file"): boolean {
  return expectedKind === "file" ? statSync(pathname).isFile() : statSync(pathname).isDirectory();
}

function readKindMismatchMessage(pathname: string, expectedKind: "directory" | "file"): string {
  return expectedKind === "file"
    ? `Expected a file target but received a directory: ${pathname}`
    : `Expected a directory target but received a file: ${pathname}`;
}

interface ParsedDevArgs {
  hasExplicitSourceTarget: boolean;
  sourceTarget: string;
  viteArgs: string[];
}

const FLAGS_WITH_VALUES = new Set([
  "--base",
  "--config",
  "--host",
  "--logLevel",
  "--mode",
  "--open",
  "--port"
]);

function readParsedDevArgs(input: string[], defaultTarget: string): ParsedDevArgs {
  let hasExplicitSourceTarget = false;
  let sourceTarget = defaultTarget;
  const viteArgs: string[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];

    if (value.startsWith("--")) {
      viteArgs.push(value);

      if (!flagConsumesNextValue(value, input[index + 1])) {
        continue;
      }

      viteArgs.push(input[index + 1]);
      index += 1;

      continue;
    }

    if (!hasExplicitSourceTarget) {
      hasExplicitSourceTarget = true;
      sourceTarget = value;

      continue;
    }

    viteArgs.push(value);
  }

  return {
    hasExplicitSourceTarget,
    sourceTarget,
    viteArgs
  };
}

function flagConsumesNextValue(flag: string, nextValue: string | undefined): boolean {
  return FLAGS_WITH_VALUES.has(flag) && nextValue !== undefined && !nextValue.startsWith("--");
}
