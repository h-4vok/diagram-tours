import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SUPPORTED_FILE_SUFFIXES = [".tour.yaml", ".mmd", ".md", ".mermaid"];

export function validateTargetPath(input: string): string {
  const target = resolve(process.cwd(), input);

  assertTargetExists(target);

  if (isDirectory(target)) {
    return target;
  }

  return validateTourFile(target);
}

function assertTargetExists(target: string): void {
  if (!existsSync(target)) {
    throw new Error(`Path does not exist: ${target}`);
  }
}

function isDirectory(target: string): boolean {
  return statSync(target).isDirectory();
}

function validateTourFile(target: string): string {
  if (!SUPPORTED_FILE_SUFFIXES.some((suffix) => target.endsWith(suffix))) {
    throw new Error(`Expected a .tour.yaml, .mmd, .mermaid, .md file, or a directory: ${target}`);
  }

  return target;
}
