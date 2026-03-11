import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true
  },
  webServer: {
    command: "bun run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: false,
    timeout: 120000
  }
});
