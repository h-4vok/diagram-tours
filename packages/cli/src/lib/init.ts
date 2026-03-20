import { mkdir, writeFile } from "node:fs/promises";
import { dirname, parse, relative, resolve } from "node:path";
import { stdout as output } from "node:process";

import { loadResolvedTourCollection } from "@diagram-tour/parser";
import type { ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";
import { validateInitTarget } from "./target.js";
import type { ParsedInitArgs } from "./types.js";

export async function runInitCommand(
  options: ParsedInitArgs,
  write = writeToStdout
): Promise<number> {
  const diagramPath = validateInitTarget(options.target);
  const tourPath = createSiblingTourPath(diagramPath);

  await assertInitTargetWritable(tourPath, options.overwrite);
  await writeScaffoldedTour(diagramPath, tourPath);
  write(`Created ${tourPath}\n`);

  return 0;
}

function createSiblingTourPath(diagramPath: string): string {
  const parsedPath = parse(diagramPath);

  return resolve(parsedPath.dir, `${parsedPath.name}.tour.yaml`);
}

async function assertInitTargetWritable(tourPath: string, overwrite: boolean): Promise<void> {
  const { access } = await import("node:fs/promises");

  try {
    await access(tourPath);
  } catch {
    return;
  }

  if (!overwrite) {
    throw new Error(`Refusing to overwrite existing file without --overwrite: ${tourPath}`);
  }
}

async function writeScaffoldedTour(diagramPath: string, tourPath: string): Promise<void> {
  const collection = await loadResolvedTourCollection(diagramPath);
  const entry = readSingleCollectionEntry(collection.entries, diagramPath);

  await mkdir(dirname(tourPath), { recursive: true });
  await writeFile(tourPath, createTourYaml(entry, diagramPath, tourPath), "utf8");
}

function readSingleCollectionEntry(
  entries: ResolvedDiagramTourCollectionEntry[],
  diagramPath: string
): ResolvedDiagramTourCollectionEntry {
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one scaffoldable diagram entry for init target "${diagramPath}".`);
  }

  return entries[0]!;
}

function createTourYaml(
  entry: ResolvedDiagramTourCollectionEntry,
  diagramPath: string,
  tourPath: string
): string {
  return [
    "version: 1",
    `title: ${JSON.stringify(entry.title)}`,
    `diagram: ${JSON.stringify(readDiagramReference(diagramPath, tourPath))}`,
    "",
    "steps:",
    ...entry.tour.steps.flatMap((step) => createYamlStep(step.focus.map((item) => item.id), step.text.trimEnd()))
  ].join("\n");
}

function createYamlStep(focus: string[], text: string): string[] {
  return focus.length === 0
    ? ['  - focus: []', `    text: ${JSON.stringify(text)}`]
    : [
        "  - focus:",
        ...focus.map((item) => `      - ${item}`),
        `    text: ${JSON.stringify(text)}`
      ];
}

function readDiagramReference(diagramPath: string, tourPath: string): string {
  const reference = relative(dirname(tourPath), diagramPath).replaceAll("\\", "/");

  return `./${reference}`;
}

function writeToStdout(text: string): void {
  output.write(text);
}
