import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { vi } from "vitest";

export const ORIGINAL_CWD = process.cwd();

export async function writeDiagram(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    [
      "flowchart LR",
      "  client[Client] --> api_gateway[API Gateway]",
      "  api_gateway --> response[Response]"
    ].join("\n"),
    "utf8"
  );
}

export async function writeMarkdown(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export function createMultiBlockMarkdown(): string {
  return [
    "# Overview",
    "",
    "```mermaid",
    "flowchart TD",
    "  start[Start] --> review[Review]",
    "```",
    "",
    "# Details",
    "",
    "```mermaid",
    "flowchart TD",
    "  detail[Detail] --> done[Done]",
    "```"
  ].join("\n");
}

export async function createTempRoot(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");

  return await mkdtemp(join(tmpdir(), "diagram-tours-init-"));
}

export function createIo(answers: string[] = []) {
  const question = vi.fn(async () => answers.shift() ?? "");
  const write = vi.fn();

  return {
    question,
    write
  };
}
