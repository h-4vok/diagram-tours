import { resolve } from "node:path";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    conditions: ["browser"]
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      all: true,
      provider: "v8",
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: resolve(__dirname, "../../coverage/packages/web-player"),
      include: ["src/lib/**/*.ts", "src/routes/**/*.ts"],
      exclude: ["src/app.d.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
