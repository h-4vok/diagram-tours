import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  describeInteractiveChoices,
  hasExplicitSourceTarget,
  readInteractiveChoice,
  readSourceTarget,
  readViteArgs,
  spawnWebPlayer,
  validateSourceTarget
} from "./dev-web-player-lib";

const args = process.argv.slice(2);
const sourceTarget = hasExplicitSourceTarget(args)
  ? readSourceTarget(args, ".")
  : await promptForSourceTarget();
const viteArgs = readViteArgs(args);
const child = spawnWebPlayer({ sourceTarget, viteArgs });

process.exit(await child.exited);

async function promptForSourceTarget(): Promise<string> {
  const readline = createInterface({ input, output });

  try {
    return await readSourceTargetFromPrompt(readline);
  } finally {
    readline.close();
  }
}

async function readSourceTargetFromPrompt(
  readline: ReturnType<typeof createInterface>
): Promise<string> {
  while (true) {
    output.write("\nChoose what to preview:\n");
    output.write(`${describeInteractiveChoices()}\n`);

    const choice = readInteractiveChoice(await readline.question("Select an option: "));

    if (choice === null) {
      output.write("Enter 1, 2, or 3.\n");

      continue;
    }

    try {
      return await resolveChoiceSourceTarget(readline, choice);
    } catch (error) {
      output.write(`${readPromptErrorMessage(error)}\n`);
    }
  }
}

async function resolveChoiceSourceTarget(
  readline: ReturnType<typeof createInterface>,
  choice: "all" | "directory" | "file"
): Promise<string> {
  switch (choice) {
    case "all":
      return validateSourceTarget(".", "any");
    case "directory":
      return validateSourceTarget(await readline.question("Directory path: "), "directory");
    case "file":
      return validateSourceTarget(await readline.question("Tour file path: "), "file");
  }
}

function readPromptErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not resolve that source target.";
}
