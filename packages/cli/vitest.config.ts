import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolveFromPackageRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@diagram-tour/core": resolveFromPackageRoot("../core/src/index.ts"),
      "@diagram-tour/parser": resolveFromPackageRoot("../parser/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["test/init.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: resolveFromPackageRoot("../../coverage/packages/cli"),
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/init.ts", "src/lib/types.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
