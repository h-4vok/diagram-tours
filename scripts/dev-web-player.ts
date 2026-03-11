import { resolve } from "node:path";

const args = process.argv.slice(2);
const sourceTarget = readSourceTarget(args);
const viteArgs = readViteArgs(args);

const child = Bun.spawn(
  ["bun", "run", "--cwd", "packages/web-player", "dev", ...viteArgs],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DIAGRAM_TOUR_SOURCE_TARGET: resolve(process.cwd(), sourceTarget)
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  }
);

process.exit(await child.exited);

function readSourceTarget(input: string[]): string {
  for (const value of input) {
    if (!value.startsWith("--")) {
      return value;
    }
  }

  return ".";
}

function readViteArgs(input: string[]): string[] {
  let skippedTarget = false;

  return input.filter((value) => {
    if (!skippedTarget && !value.startsWith("--")) {
      skippedTarget = true;

      return false;
    }

    return true;
  });
}
