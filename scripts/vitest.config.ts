import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    coverage: {
      all: true,
      provider: "v8",
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: resolve(__dirname, "../coverage/packages/scripts"),
      include: [
        "scripts/build-coverage-dashboard-lib.ts",
        "scripts/dev-web-player-lib.ts",
        "scripts/print-coverage-path-lib.ts"
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
