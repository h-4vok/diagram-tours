import { mkdir, writeFile } from "node:fs/promises";
import { dirname, parse, relative, resolve } from "node:path";
import { stdout as output } from "node:process";

import { loadResolvedTourCollection } from "@diagram-tour/parser";
import type { ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";
import { validateInitTarget } from "./target.js";
import type { ParsedInitArgs, PromptIo } from "./types.js";

type InitTargetReference = {
  absolutePath: string;
  fragment: string | null;
};

type MarkdownSelection = {
  diagramPath: string;
  entry: ResolvedDiagramTourCollectionEntry;
  tourPath: string;
};

type WritableFile = {
  path: string;
  kind: "diagram" | "tour";
};

export async function runInitCommand(
  options: ParsedInitArgs,
  io: PromptIo = createInitIo()
): Promise<number> {
  const target = parseInitTargetReference(validateInitTarget(options.target));

  if (isEmptyInitTarget(target.absolutePath)) {
    await writeEmptyScaffold(target.absolutePath, options.overwrite);
    io.write(`Created ${target.absolutePath}\n`);
    io.write(`Created ${createSiblingDiagramPath(target.absolutePath)}\n`);
    return 0;
  }

  const selection = await resolveSourceSelection(target, io);

  await assertWritableFiles([{ kind: "tour", path: selection.tourPath }], options.overwrite);
  await writeScaffoldedTour(selection, selection.tourPath);
  io.write(`Created ${selection.tourPath}\n`);

  return 0;
}

function parseInitTargetReference(input: string): InitTargetReference {
  const hashIndex = input.indexOf("#");

  return hashIndex === -1
    ? { absolutePath: input, fragment: null }
    : {
        absolutePath: input.slice(0, hashIndex),
        fragment: input.slice(hashIndex + 1)
      };
}

function isEmptyInitTarget(target: string): boolean {
  return target.endsWith(".tour.yaml");
}

function createSiblingTourPath(diagramPath: string): string {
  const parsedPath = parse(diagramPath);

  return resolve(parsedPath.dir, `${parsedPath.name}.tour.yaml`);
}

function createSiblingDiagramPath(tourPath: string): string {
  const parsedPath = parse(tourPath);

  return resolve(parsedPath.dir, `${parsedPath.name}.mmd`);
}

async function assertWritableFiles(files: WritableFile[], overwrite: boolean): Promise<void> {
  const { access } = await import("node:fs/promises");

  for (const file of files) {
    if (await isMissingFile(access, file.path)) {
      continue;
    }

    assertOverwriteEnabled(file, overwrite);
  }
}

async function writeScaffoldedTour(selection: MarkdownSelection, tourPath: string): Promise<void> {
  await mkdir(dirname(tourPath), { recursive: true });
  await writeFile(tourPath, createTourYaml(selection, tourPath), "utf8");
}

async function writeEmptyScaffold(tourPath: string, overwrite: boolean): Promise<void> {
  const diagramPath = createSiblingDiagramPath(tourPath);

  await assertWritableFiles(
    [
      { kind: "tour", path: tourPath },
      { kind: "diagram", path: diagramPath }
    ],
    overwrite
  );
  await mkdir(dirname(tourPath), { recursive: true });
  await writeFile(diagramPath, createEmptyMermaidScaffold(), "utf8");
  await writeFile(tourPath, createEmptyTourYaml(tourPath, diagramPath), "utf8");
}

async function resolveSourceSelection(target: InitTargetReference, io: PromptIo): Promise<MarkdownSelection> {
  const collection = await loadResolvedTourCollection(target.absolutePath);
  const matches = readMatchingEntries(collection.entries, target.fragment);

  if (matches.length === 0) {
    throw new Error(`Expected exactly one scaffoldable diagram entry for init target "${readTargetLabel(target)}".`);
  }

  if (matches.length === 1) {
    return createMarkdownSelection(matches[0]!, target.absolutePath);
  }

  return await promptForMarkdownSelection(matches, target.absolutePath, io);
}

function readMatchingEntries(
  entries: ResolvedDiagramTourCollectionEntry[],
  fragment: string | null
): ResolvedDiagramTourCollectionEntry[] {
  if (fragment === null) {
    return entries;
  }

  return entries.filter((entry) => readEntryFragment(entry) === fragment);
}

async function promptForMarkdownSelection(
  entries: ResolvedDiagramTourCollectionEntry[],
  absolutePath: string,
  io: PromptIo
): Promise<MarkdownSelection> {
  io.write(`Multiple Mermaid blocks were found in ${absolutePath}.\n`);
  entries.forEach((entry, index) => {
    io.write(`${index + 1}. ${entry.title} -> ${readMarkdownTourPath(absolutePath, entry)}\n`);
  });

  for (;;) {
    const selection = readPromptSelection(await io.question("Select a Mermaid block to scaffold: "), entries.length);

    if (selection !== null) {
      return createMarkdownSelection(entries[selection - 1]!, absolutePath);
    }

    io.write(`Enter a number between 1 and ${entries.length}.\n`);
  }
}

function createMarkdownSelection(
  entry: ResolvedDiagramTourCollectionEntry,
  absolutePath: string
): MarkdownSelection {
  return {
    diagramPath: absolutePath,
    entry,
    tourPath: absolutePath.endsWith(".md") ? readMarkdownTourPath(absolutePath, entry) : createSiblingTourPath(absolutePath)
  };
}

function createTourYaml(selection: MarkdownSelection, tourPath: string): string {
  return [
    "version: 1",
    `title: ${JSON.stringify(selection.entry.title)}`,
    `diagram: ${JSON.stringify(readDiagramReference(selection, tourPath))}`,
    "",
    "steps:",
    ...selection.entry.tour.steps.flatMap((step) =>
      createYamlStep(step.focus.map((item) => item.id), step.text.trimEnd())
    )
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

function readDiagramReference(selection: MarkdownSelection, tourPath: string): string {
  const relativeSource = relative(dirname(tourPath), selection.diagramPath).replaceAll("\\", "/");
  const fragment = readEntryFragment(selection.entry);
  const reference = fragment === null ? relativeSource : `${relativeSource}#${fragment}`;

  return `./${reference}`;
}

function createEmptyTourYaml(tourPath: string, diagramPath: string): string {
  const title = readTitleFromStem(parse(tourPath).name);

  return [
    "version: 1",
    `title: ${JSON.stringify(title)}`,
    `diagram: ${JSON.stringify(readRelativeReference(diagramPath, tourPath))}`,
    "",
    "steps:",
    "  - focus: []",
    `    text: ${JSON.stringify(`Overview of ${title}. Replace this step with your own tour introduction.`)}`,
    "  - focus:",
    "      - start",
    `    text: ${JSON.stringify("Explain how {{start}} begins the flow and what readers should notice first.")}`
  ].join("\n");
}

function createEmptyMermaidScaffold(): string {
  return [
    "flowchart TD",
    "  start[Start] --> review[Review details]",
    "  review --> done[Done]"
  ].join("\n");
}

function readRelativeReference(targetPath: string, fromPath: string): string {
  return `./${relative(dirname(fromPath), targetPath).replaceAll("\\", "/")}`;
}

function readTitleFromStem(stem: string): string {
  return stem
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function readMarkdownTourPath(
  absolutePath: string,
  entry: ResolvedDiagramTourCollectionEntry
): string {
  const parsedPath = parse(absolutePath);
  const fragment = readEntryFragment(entry);
  const stem = fragment === null ? parsedPath.name : `${parsedPath.name}-${fragment}`;

  return resolve(parsedPath.dir, `${stem}.tour.yaml`);
}

function readEntryFragment(entry: ResolvedDiagramTourCollectionEntry): string | null {
  if (typeof entry.sourcePath !== "string") {
    return null;
  }

  const hashIndex = entry.sourcePath.indexOf("#");

  return hashIndex === -1 ? null : entry.sourcePath.slice(hashIndex + 1);
}

function readTargetLabel(target: InitTargetReference): string {
  return target.fragment === null ? target.absolutePath : `${target.absolutePath}#${target.fragment}`;
}

async function isMissingFile(
  access: (path: string) => Promise<void>,
  path: string
): Promise<boolean> {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

function assertOverwriteEnabled(file: WritableFile, overwrite: boolean): void {
  if (!overwrite) {
    throw new Error(`Refusing to overwrite existing ${file.kind} file without --overwrite: ${file.path}`);
  }
}

function readPromptSelection(answer: string, total: number): number | null {
  const selection = Number(answer.trim());

  if (!Number.isInteger(selection)) {
    return null;
  }

  return isSelectionInRange(selection, total) ? selection : null;
}

function isSelectionInRange(selection: number, total: number): boolean {
  return selection >= 1 && selection <= total;
}

function createInitIo(): PromptIo {
  return {
    async question() {
      throw new Error("Interactive input is required to choose a Markdown Mermaid block.");
    },
    write(text: string) {
      output.write(text);
    }
  };
}
