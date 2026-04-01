import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true
  },
  webServer: {
    command: "node ../../packages/cli/dist/bin/diagram-tours.js ../../examples --host 127.0.0.1 --port 4173 --no-open",
    port: 4173,
    reuseExistingServer: false,
    timeout: 120000
  }
});
