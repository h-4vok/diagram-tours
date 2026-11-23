import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const cliEntry = resolve(repoRoot, "packages/cli/dist/bin/diagram-tours.js");

test.setTimeout(120000);

test("build output works on a generic static host", async ({ page }) => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "diagram-tours-static-smoke-"));
  const output = resolve(tempRoot, "dist");
  const build = await runProcess(process.execPath, [cliEntry, "build", ".", "--out", output, "--continue", "--quiet"]);
  expect(build.code, build.output).toBe(0);

  const server = await startStaticServer(output);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  try {
    await page.goto(`${server.baseUrl}/#/docs/authoring-guide/example-fixtures`);
    await expect(page.getByText("Example Fixtures").first()).toBeVisible();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await page.getByRole("button", { name: /Search tours/ }).click();
    await page.getByRole("option", { name: /Payments Platform Overview/ }).click();
    await expect(page.getByTestId("diagram-stage-inner").getByText("Customer Apps")).toBeVisible();
    await page.goto(`${server.baseUrl}/#/examples/flowchart/payments-platform-overview?step=2`);
    await expect(page.getByTestId("diagram-stage-inner").getByText("Traffic Router")).toBeVisible();
    await expect(page.getByText("Step 2 of 6")).toBeVisible();
    expect(requests.filter((url) => !isStaticRequest(url, server.baseUrl))).toEqual([]);
    server.process.kill();
    await assertFileUrlBehavior(page, output);
  } finally {
    server.process.kill();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function startStaticServer(directory: string): Promise<{ baseUrl: string; process: ChildProcess }> {
  const port = await readFreePort();
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(command, ["--yes", "serve", directory, "-l", String(port)], { shell: true, stdio: "ignore" });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);

  return { baseUrl, process: child };
}

async function assertFileUrlBehavior(page: Page, output: string): Promise<void> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(output, "index.html")).href);
  await expect(page.getByText("Example Fixtures").first()).toBeVisible();
  try {
    await page.getByRole("button", { name: "Next step" }).click({ timeout: 5000 });
  } catch (error) {
    throw new Error(`file:// interaction failed: ${errors.join(" | ")} (${String(error)})`);
  }
  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  expect(errors).toEqual([]);
}

function isStaticRequest(url: string, baseUrl: string): boolean {
  return url.startsWith(baseUrl) || url.startsWith("https://fonts.googleapis.com") || url.startsWith("https://fonts.gstatic.com");
}

async function readFreePort(): Promise<number> {
  const server = createServer();

  return await new Promise<number>((resolvePort, rejectPort) => {
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === "object" && address !== null ? address.port : 0));
    });
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isServerReady(baseUrl)) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function isServerReady(baseUrl: string): Promise<boolean> {
  try {
    return (await fetch(baseUrl)).ok;
  } catch {
    return false;
  }
}

function runProcess(command: string, args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", rejectProcess);
    child.once("exit", (code) => resolveProcess({ code, output }));
  });
}
