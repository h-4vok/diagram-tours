import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INITIAL_TOUR_FILE_SUFFIX = ".tour.yaml";
const INIT_FILE_SUFFIXES = [".mmd", ".mermaid"];
const SUPPORTED_FILE_SUFFIXES = [".tour.yaml", ".mmd", ".md", ".mermaid"];

export function validateTargetPath(input: string): string {
  const target = readExistingPath(input);

  if (isDirectoryPath(target)) {
    return target;
  }

  return validateStartupFile(target);
}

export function validateValidationTarget(input: string | null): string {
  const target = readExistingPath(input ?? ".");

  if (isDirectoryPath(target)) {
    return target;
  }

  return validateTourValidationFile(target);
}

export function validateInitTarget(input: string): string {
  const target = readExistingPath(input);

  if (INIT_FILE_SUFFIXES.some((suffix) => target.endsWith(suffix))) {
    return target;
  }

  throw new Error(`Expected a .mmd or .mermaid file for init: ${target}`);
}

function readExistingPath(input: string): string {
  const target = resolve(process.cwd(), input);

  assertTargetExists(target);

  return target;
}

function assertTargetExists(target: string): void {
  if (!existsSync(target)) {
    throw new Error(`Path does not exist: ${target}`);
  }
}

function isDirectoryPath(target: string): boolean {
  return statSync(target).isDirectory();
}

function validateStartupFile(target: string): string {
  if (!SUPPORTED_FILE_SUFFIXES.some((suffix) => target.endsWith(suffix))) {
    throw new Error(`Expected a .tour.yaml, .mmd, .mermaid, .md file, or a directory: ${target}`);
  }

  return target;
}

function validateTourValidationFile(target: string): string {
  if (!target.endsWith(INITIAL_TOUR_FILE_SUFFIX)) {
    throw new Error(`Expected a .tour.yaml file or a directory: ${target}`);
  }

  return target;
}
