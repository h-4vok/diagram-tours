import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildCoverageDashboard } from "./build-coverage-dashboard-lib";

const rootCoverageDirectory = resolve(process.cwd(), "coverage");

if (!existsSync(rootCoverageDirectory)) {
  throw new Error("Coverage directory does not exist. Run `bun run coverage` or `bun run test` first.");
}

buildCoverageDashboard(rootCoverageDirectory);
