import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { ParsedSetupArgs, PromptIo } from "./types.js";

const DEFAULT_AGENT_PATH = ".codex/agents/diagram-tours-author.toml";
const INSTRUCTIONS_PATH = ".diagram-tours/instructions.md";

type ResolvedSetupPaths = {
  agentPath: string | null;
  instructionsPath: string;
};

export async function runSetupCommand(
  options: ParsedSetupArgs,
  io: PromptIo,
  cwd = process.cwd()
): Promise<number> {
  const resolvedOptions = await readSetupOptions(options, io);
  const resolvedPaths = resolveSetupPaths(resolvedOptions, cwd);
  const approvedOverwrites = await readApprovedOverwrites({
    cwd,
    interactive: options.agent === "prompt" && !options.overwrite,
    io,
    paths: resolvedPaths
  });

  await assertWritableTargets(resolvedPaths, options.overwrite, approvedOverwrites);
  await writeSetupFiles(resolvedPaths);
  writeSetupSummary(io, resolvedPaths, cwd);

  return 0;
}

async function readSetupOptions(options: ParsedSetupArgs, io: PromptIo): Promise<ParsedSetupArgs> {
  return options.agent === "prompt" ? await promptForSetupOptions(io) : options;
}

async function promptForSetupOptions(io: PromptIo): Promise<ParsedSetupArgs> {
  io.write("Diagram Tours setup installs repository-local authoring guidance.\n");

  const installAgent = await io.question("Install an optional Codex subagent definition too? [y/N]: ");

  if (!isAffirmative(installAgent)) {
    return {
      agent: "none",
      agentPath: null,
      overwrite: false
    };
  }

  io.write(`1. ${DEFAULT_AGENT_PATH}\n2. Custom path\n`);
  const choice = await io.question("Choose agent location [1/2]: ");

  return choice.trim() === "2" ? readCustomAgentOption(io) : readDefaultAgentOption(choice);
}

function readDefaultAgentOption(choice: string): ParsedSetupArgs {
  if (choice.trim() !== "1") {
    throw new Error("Expected setup agent location selection to be 1 or 2.");
  }

  return {
    agent: "default",
    agentPath: null,
    overwrite: false
  };
}

async function readCustomAgentOption(io: PromptIo): Promise<ParsedSetupArgs> {
  const customPath = await io.question("Enter the custom agent definition path: ");

  if (customPath.trim().length === 0) {
    throw new Error("Expected a non-empty custom agent definition path.");
  }

  return {
    agent: "default",
    agentPath: customPath.trim(),
    overwrite: false
  };
}

function resolveSetupPaths(options: ParsedSetupArgs, cwd: string): ResolvedSetupPaths {
  return {
    agentPath: readResolvedAgentPath(options, cwd),
    instructionsPath: resolve(cwd, INSTRUCTIONS_PATH)
  };
}

function readResolvedAgentPath(options: ParsedSetupArgs, cwd: string): string | null {
  if (options.agent === "none") {
    return null;
  }

  return resolve(cwd, options.agentPath ?? DEFAULT_AGENT_PATH);
}

async function readApprovedOverwrites(input: {
  cwd: string;
  interactive: boolean;
  io: PromptIo;
  paths: ResolvedSetupPaths;
}): Promise<Set<string>> {
  if (!input.interactive) {
    return new Set<string>();
  }

  return await promptForApprovedOverwrites(input);
}

async function promptForApprovedOverwrites(input: {
  cwd: string;
  io: PromptIo;
  paths: ResolvedSetupPaths;
}): Promise<Set<string>> {
  const approvedTargets = new Set<string>();

  await maybeApproveOverwrite({
    approvedTargets,
    cwd: input.cwd,
    io: input.io,
    target: input.paths.instructionsPath
  });

  if (input.paths.agentPath !== null) {
    await maybeApproveOverwrite({
      approvedTargets,
      cwd: input.cwd,
      io: input.io,
      target: input.paths.agentPath
    });
  }

  return approvedTargets;
}

async function maybeApproveOverwrite(input: {
  approvedTargets: Set<string>;
  cwd: string;
  io: PromptIo;
  target: string;
}): Promise<void> {
  if (!(await pathExists(input.target))) {
    return;
  }

  if (!isAffirmative(await input.io.question(overwritePrompt(input.target, input.cwd)))) {
    throw new Error(`Setup cancelled because overwrite was declined for ${input.target}`);
  }

  input.approvedTargets.add(input.target);
}

async function assertWritableTargets(
  paths: ResolvedSetupPaths,
  overwrite: boolean,
  approvedTargets: Set<string>
): Promise<void> {
  await assertWritableTarget(paths.instructionsPath, overwrite, approvedTargets);

  if (paths.agentPath !== null) {
    await assertWritableTarget(paths.agentPath, overwrite, approvedTargets);
  }
}

async function assertWritableTarget(
  target: string,
  overwrite: boolean,
  approvedTargets: Set<string>
): Promise<void> {
  if ((await pathExists(target)) && !canOverwriteTarget(target, overwrite, approvedTargets)) {
    throw new Error(`Refusing to overwrite existing file without --overwrite: ${target}`);
  }
}

function canOverwriteTarget(
  target: string,
  overwrite: boolean,
  approvedTargets: Set<string>
): boolean {
  return overwrite || approvedTargets.has(target);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function writeSetupFiles(paths: ResolvedSetupPaths): Promise<void> {
  await writeTextFile(paths.instructionsPath, createInstructionsContent());

  if (paths.agentPath !== null) {
    await writeTextFile(paths.agentPath, createAgentDefinitionContent());
  }
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function createInstructionsContent(): string {
  return INSTRUCTIONS_CONTENT.join("\n");
}

function createAgentDefinitionContent(): string {
  return [
    'name = "Diagram Tours Author"',
    'description = "Author and maintain Diagram Tours content in this repository."',
    'model = "gpt-5.4-mini"',
    'sandbox_mode = "workspace-write"',
    "",
    'developer_instructions = """',
    'Read `.diagram-tours/instructions.md` before creating or editing any `*.tour.yaml` file.',
    "",
    "Prefer these commands:",
    "- `diagram-tours init <diagram.mmd>` for starter authored tours",
    "- `diagram-tours validate [target]` before handoff",
    "- `diagram-tours <target>` to preview runtime behavior",
    '"""'
  ].join("\n");
}

function writeSetupSummary(io: PromptIo, paths: ResolvedSetupPaths, cwd: string): void {
  io.write(`Created ${readRelativePath(paths.instructionsPath, cwd)}\n`);

  if (paths.agentPath !== null) {
    io.write(`Created ${readRelativePath(paths.agentPath, cwd)}\n`);
  }
}

function readRelativePath(path: string, cwd: string): string {
  return relative(cwd, path).replaceAll("\\", "/");
}

function overwritePrompt(path: string, cwd: string): string {
  return `Overwrite existing ${readRelativePath(path, cwd)}? [y/N]: `;
}

function isAffirmative(input: string): boolean {
  return input.trim().toLowerCase() === "y";
}

const INSTRUCTIONS_CONTENT = [
  "# Diagram Tours Instructions",
  "",
  "Use this file as the repository-local reference for authored `*.tour.yaml` files.",
  "",
  "## File Placement",
  "",
  "- Keep tours next to the Mermaid source they explain.",
  "- Use a sibling `name.tour.yaml` file for a Mermaid source such as `name.mmd`.",
  "- Prefer one diagram and one authored tour per feature-sized folder.",
  "",
  "## Authoring Contract",
  "",
  "- Version 1 tours use `version`, `title`, `diagram`, and `steps`.",
  "- Each step must include `focus` and `text`.",
  "- `focus` contains Mermaid element IDs such as flowchart node IDs or sequence participant/message IDs.",
  "- Step text may interpolate Mermaid labels with `{{element_id}}`.",
  "",
  "## Mermaid ID Guidance",
  "",
  "- Prefer specific, stable Mermaid IDs that describe the role of the element.",
  "- Avoid generic IDs such as `A`, `B`, or `C` when authoring or revising diagrams.",
  "- If a source diagram uses fragile IDs, prefer updating the diagram to stable names before authoring a tour.",
  "",
  "Example diagram:",
  "",
  "```mermaid",
  "flowchart LR",
  "  client[Client] --> api_gateway[API Gateway]",
  "  api_gateway --> validation_service[Validation Service]",
  "  validation_service --> payment_service[Payment Service]",
  "```",
  "",
  "Example starter tour:",
  "",
  "```yaml",
  "version: 1",
  "title: Payment Flow",
  "diagram: ./payment-flow.mmd",
  "",
  "steps:",
  "  - focus:",
  "      - api_gateway",
  "    text: >",
  "      The {{api_gateway}} is the public entry point.",
  "```",
  "",
  "## Local Workflow",
  "",
  "- Create a starter tour with `diagram-tours init <diagram.mmd>`.",
  "- Validate one file or a directory tree with `diagram-tours validate [target]`.",
  "- Preview a diagram or authored tour with `diagram-tours <target>`.",
  "",
  "## Writing Style",
  "",
  "- Keep steps linear and readable.",
  "- Use `focus: []` for overview or reset steps.",
  "- Prefer small, concrete steps over long multi-idea paragraphs."
];
