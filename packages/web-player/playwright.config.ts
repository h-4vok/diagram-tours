import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { resolveSmokeServerPort } from "./smoke/smoke-port.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const smokeServerPort = process.env.DIAGRAM_TOUR_SMOKE_PORT
  ? Number(process.env.DIAGRAM_TOUR_SMOKE_PORT)
  : await resolveSmokeServerPort({ worktreePath: repoRoot });

process.env.DIAGRAM_TOUR_SMOKE_PORT ??= String(smokeServerPort);

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const examplesTarget = fileURLToPath(new URL("../../examples", import.meta.url));

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: `http://127.0.0.1:${smokeServerPort}`,
    browserName: "chromium",
    headless: true
  },
  webServer: {
    command: "node ./build/index.js",
    cwd: packageRoot,
    env: {
      DIAGRAM_TOUR_SOURCE_TARGET: examplesTarget,
      HOST: "127.0.0.1",
      PORT: String(smokeServerPort)
    },
    url: `http://127.0.0.1:${smokeServerPort}`,
    reuseExistingServer: false,
    timeout: 120000
  }
});
