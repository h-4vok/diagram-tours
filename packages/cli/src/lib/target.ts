import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INITIAL_TOUR_FILE_SUFFIX = ".tour.yaml";
const INIT_FILE_SUFFIXES = [".mmd", ".md", ".mermaid", INITIAL_TOUR_FILE_SUFFIX];
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
  const reference = readTargetReference(input);
  const target = readInitPath(reference.path, input);

  if (!isSupportedInitTarget(target, reference.fragment)) {
    throw new Error(`Expected a .mmd, .mermaid, .md, or .tour.yaml file for init: ${target}`);
  }

  return reference.fragment === null ? target : `${target}#${reference.fragment}`;
}

function readTargetReference(input: string): { fragment: string | null; path: string } {
  const hashIndex = input.indexOf("#");

  return hashIndex === -1
    ? { fragment: null, path: input }
    : {
        fragment: input.slice(hashIndex + 1),
        path: input.slice(0, hashIndex)
      };
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

function readInitPath(path: string, rawInput: string): string {
  if (isEmptyInitPath(path)) {
    return resolve(process.cwd(), path);
  }

  return readExistingInitSourcePath(path, rawInput);
}

function readExistingInitSourcePath(path: string, rawInput: string): string {
  const target = resolve(process.cwd(), path);

  if (!existsSync(target)) {
    throw new Error(readInitMissingPathMessage(target, rawInput));
  }

  return target;
}

function isAllowedInitFragment(target: string, fragment: string | null): boolean {
  return fragment === null ? true : target.endsWith(".md");
}

function isSupportedInitTarget(target: string, fragment: string | null): boolean {
  return INIT_FILE_SUFFIXES.some((suffix) => target.endsWith(suffix)) && isAllowedInitFragment(target, fragment);
}

function isEmptyInitPath(path: string): boolean {
  return path.endsWith(INITIAL_TOUR_FILE_SUFFIX);
}

function readInitMissingPathMessage(target: string, rawInput: string): string {
  return isSimpleInitStem(rawInput)
    ? [
        `Path does not exist: ${target}`,
        `If you want to create a new authored tour from scratch, run: diagram-tours init ./${rawInput}.tour.yaml`
      ].join("\n")
    : `Path does not exist: ${target}`;
}

function isSimpleInitStem(input: string): boolean {
  return !input.includes("/") && !input.includes("\\") && !input.includes(".");
}
