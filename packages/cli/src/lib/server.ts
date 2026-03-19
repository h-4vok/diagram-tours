import { spawn, type ChildProcess } from "node:child_process";

import { resolveWebPlayerEntry } from "./runtime-package.js";
import type { ServerBinding } from "./types.js";

export interface StartedServer {
  child: ChildProcess;
  url: string;
}

export async function startWebServer(options: {
  binding: ServerBinding;
  target: string;
}): Promise<StartedServer> {
  const child = spawn(process.execPath, [resolveWebPlayerEntry()], {
    env: {
      ...process.env,
      DIAGRAM_TOUR_SOURCE_TARGET: options.target,
      HOST: options.binding.host,
      PORT: String(options.binding.port)
    },
    stdio: "inherit"
  });
  const url = `http://${options.binding.host}:${options.binding.port}`;

  await waitForServer(url);

  return { child, url };
}

async function waitForServer(url: string): Promise<void> {
  const timeoutAt = Date.now() + 120_000;

  while (Date.now() < timeoutAt) {
    if (await isReady(url)) {
      return;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

async function isReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { redirect: "manual" });

    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}
