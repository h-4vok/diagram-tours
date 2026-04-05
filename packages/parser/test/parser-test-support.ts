import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, vi } from "vitest";

import type { loadResolvedTourCollection } from "../src/index.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ORIGINAL_CWD = process.cwd();

export const FIXTURE_TOUR_PATH = resolve(
  TEST_DIR,
  "../../../fixtures/flowchart/payment-flow.tour.yaml"
);
export const DISCOVERY_FIXTURE_ROOT = resolve(TEST_DIR, "./fixtures/discovery");
export const INVALID_ONLY_FIXTURE_ROOT = resolve(TEST_DIR, "./fixtures/invalid-only");
export const EXAMPLES_ROOT = resolve(TEST_DIR, "../../../examples");

export function restoreParserTestState(): void {
  vi.restoreAllMocks();
  process.chdir(ORIGINAL_CWD);
}

export async function createTempTour(input: {
  diagramPath?: string;
  mermaid: string;
  yaml: string;
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "diagram-tour-parser-"));
  const diagramPath = join(dir, input.diagramPath ?? "diagram.mmd");
  const tourPath = join(dir, "tour.tour.yaml");

  await import("node:fs/promises").then(async ({ mkdir }) => {
    await mkdir(dirname(diagramPath), { recursive: true });
  });
  await writeFile(diagramPath, input.mermaid);
  await writeFile(tourPath, input.yaml);

  return tourPath;
}

export async function createTempDiagramDirectory(input: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "diagram-tour-parser-discovery-"));

  await Promise.all(
    Object.entries(input).map(async ([relativePath, source]) => {
      const absolutePath = join(dir, relativePath);
      const parent = dirname(absolutePath);

      await import("node:fs/promises").then(async ({ mkdir }) => {
        await mkdir(parent, { recursive: true });
      });
      await writeFile(absolutePath, source);
    })
  );

  return dir;
}

export function readCollectionEntryAt(
  collection: Awaited<ReturnType<typeof loadResolvedTourCollection>>,
  index: number
) {
  const entry = collection.entries[index];

  expect(entry).toBeDefined();

  return entry!;
}

export function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
