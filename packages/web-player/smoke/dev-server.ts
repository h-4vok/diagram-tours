import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface StartDevServerOptions {
  args?: string[];
  port: number;
  promptInputs?: string[];
  script: "dev" | "dev:interactive";
}

export interface StartedDevServer {
  baseUrl: string;
  output: string;
  stop: () => Promise<void>;
}

export async function startDevServer(options: StartDevServerOptions): Promise<StartedDevServer> {
  const baseUrl = readBaseUrl(options.port);
  const child = spawnDevServer(options);
  let output = "";
  const promptInputs = [...(options.promptInputs ?? [])];

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();

    output += text;
    writePromptInput(child, promptInputs, text);
  });

  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await waitForServer(baseUrl, () => output);

  return {
    baseUrl,
    get output() {
      return output;
    },
    stop: async () => {
      await stopChildProcess(child);
    }
  };
}

function spawnDevServer(options: StartDevServerOptions): ChildProcessWithoutNullStreams {
  return spawn(readBunCommand(), readCommandArgs(options), {
    cwd: readRepositoryRoot(),
    shell: process.platform === "win32",
    stdio: "pipe"
  });
}

function readBunCommand(): string {
  return "bun";
}

function readCommandArgs(options: StartDevServerOptions): string[] {
  return [
    "run",
    options.script,
    ...(options.args ?? []),
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(options.port)
  ];
}

function readRepositoryRoot(): string {
  return fileURLToPath(new URL("../../..", import.meta.url));
}

function readBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function writePromptInput(
  child: ChildProcessWithoutNullStreams,
  pendingInputs: string[],
  text: string
): void {
  if (pendingInputs.length === 0 || !includesPrompt(text)) {
    return;
  }

  child.stdin.write(`${pendingInputs.shift()}\n`);
}

function includesPrompt(text: string): boolean {
  return (
    text.includes("Select an option:") ||
    text.includes("Directory path:") ||
    text.includes("Tour file path:")
  );
}

async function waitForServer(baseUrl: string, readOutput: () => string): Promise<void> {
  const timeoutAt = Date.now() + 120_000;

  while (Date.now() < timeoutAt) {
    if (await isServerReady(baseUrl)) {
      return;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for server at ${baseUrl}\n${readOutput()}`);
}

async function isServerReady(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, {
      redirect: "manual"
    });

    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function stopChildProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child);
}

async function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    if (child.exitCode !== null) {
      return;
    }

    await delay(100);
  }

  child.kill("SIGKILL");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}
