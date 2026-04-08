import { defineConfig } from "@playwright/test";
import { resolveSmokeServerPort } from "./smoke/smoke-port.js";

const smokeServerPort = await resolveSmokeServerPort();

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
    command: `node ../../packages/cli/dist/bin/diagram-tours.js ../../examples --host 127.0.0.1 --port ${smokeServerPort} --no-open`,
    port: smokeServerPort,
    reuseExistingServer: false,
    timeout: 120000
  }
});
