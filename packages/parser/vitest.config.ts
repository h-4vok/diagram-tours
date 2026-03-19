import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@diagram-tour/core": resolve(__dirname, "../core/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      all: true,
      provider: "v8",
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: resolve(__dirname, "../../coverage/packages/parser"),
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
