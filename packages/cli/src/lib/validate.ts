import { stdout as output } from "node:process";

import { loadResolvedTour, validateDiscoveredTours } from "@diagram-tour/parser";
import { validateValidationTarget } from "./target.js";
import type { ParsedValidateArgs } from "./types.js";

type Write = (text: string) => void;

export async function runValidateCommand(
  options: ParsedValidateArgs,
  write: Write = writeToStdout
): Promise<number> {
  const target = validateValidationTarget(options.target);

  return target.endsWith(".tour.yaml")
    ? await validateSingleTour(target, write)
    : await validateDirectoryTours(target, write);
}

async function validateSingleTour(target: string, write: Write): Promise<number> {
  await loadResolvedTour(target);
  write(`Validated tour file ${target}\n`);

  return 0;
}

async function validateDirectoryTours(target: string, write: Write): Promise<number> {
  const result = await validateDiscoveredTours(target);

  assertTourFilesFound(target, result.valid.length, result.invalid.length);
  writeDirectorySummary(
    {
      invalidCount: result.invalid.length,
      target,
      validCount: result.valid.length
    },
    write
  );
  writeInvalidTours(result.invalid, write);

  return result.invalid.length === 0 ? 0 : 1;
}

function assertTourFilesFound(target: string, validCount: number, invalidCount: number): void {
  if (validCount === 0 && invalidCount === 0) {
    throw new Error(`No authored .tour.yaml files were discovered in directory "${target}".`);
  }
}

function writeDirectorySummary(
  summary: {
    invalidCount: number;
    target: string;
    validCount: number;
  },
  write: Write
): void {
  write(`Validated ${summary.validCount + summary.invalidCount} tour file(s) under ${summary.target}\n`);
  write(`Valid: ${summary.validCount}\n`);
  write(`Invalid: ${summary.invalidCount}\n`);
}

function writeInvalidTours(
  invalid: Array<{ error: string; sourcePath: string }>,
  write: Write
): void {
  for (const item of invalid) {
    write(`- ${item.sourcePath}: ${item.error}\n`);
  }
}

function writeToStdout(text: string): void {
  output.write(text);
}
