import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./smoke",
  testMatch: "static-build.file-host.spec.ts",
  use: {
    browserName: "chromium",
    headless: true
  }
});
