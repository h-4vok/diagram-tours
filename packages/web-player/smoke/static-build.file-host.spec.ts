import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import { expect, test } from "@playwright/test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const cliEntry = resolve(repoRoot, "packages/cli/dist/bin/diagram-tours.js");

test.setTimeout(120000);

test("build output works from file:// without a server", async ({ page }) => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "diagram-tours-file-smoke-"));
  const output = resolve(tempRoot, "dist");
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    const build = await runBuild(output);
    expect(build.code, build.output).toBe(0);
    await page.goto(pathToFileURL(resolve(output, "index.html")).href);
    await expect(page.getByText("Example Fixtures").first()).toBeVisible();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await page.getByRole("button", { name: /Search tours/ }).click();
    await page.getByRole("option", { name: /Payments Platform Overview/ }).click();
    await expect(page.getByTestId("diagram-stage-inner").getByText("Customer Apps")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

function runBuild(output: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, [cliEntry, "build", ".", "--out", output, "--continue", "--quiet"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let outputText = "";
    child.stdout?.on("data", (chunk) => { outputText += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { outputText += chunk.toString(); });
    child.once("error", rejectProcess);
    child.once("exit", (code) => resolveProcess({ code, output: outputText }));
  });
}
