import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { buildCoverageDashboard } from "./build-coverage-dashboard-lib";

describe("buildCoverageDashboard", () => {
  test("writes a unified dashboard and aggregate summary", () => {
    const rootDirectory = mkdtempSync(join(tmpdir(), "diagram-tours-coverage-"));

    writeSummary(rootDirectory, "core", 10);
    writeSummary(rootDirectory, "parser", 20);
    writeSummary(rootDirectory, "web-player", 30);
    writeSummary(rootDirectory, "cli", 40);
    writeSummary(rootDirectory, "scripts", 50);

    const dashboard = buildCoverageDashboard(rootDirectory);
    const html = readFileSync(resolve(rootDirectory, "index.html"), "utf8");
    const summary = JSON.parse(readFileSync(resolve(rootDirectory, "coverage-summary.json"), "utf8")) as {
      overall: {
        statements: { covered: number; total: number; pct: number };
      };
      packages: Array<{ name: string }>;
    };

    expect(dashboard.packages).toHaveLength(5);
    expect(summary.packages.map((item) => item.name)).toEqual([
      "core",
      "parser",
      "web-player",
      "cli",
      "scripts"
    ]);
    expect(summary.overall.statements.total).toBe(150);
    expect(summary.overall.statements.covered).toBe(150);
    expect(summary.overall.statements.pct).toBe(100);
    expect(html).toContain("Unified Coverage Dashboard");
    expect(html).toContain("./packages/scripts/index.html");
    expect(html).toContain("Web Player");
  });

  test("treats zero-total metrics as fully covered in the aggregate summary", () => {
    const rootDirectory = mkdtempSync(join(tmpdir(), "diagram-tours-coverage-empty-"));

    writeSummary(rootDirectory, "core", 0);
    writeSummary(rootDirectory, "parser", 0);
    writeSummary(rootDirectory, "web-player", 0);
    writeSummary(rootDirectory, "cli", 0);
    writeSummary(rootDirectory, "scripts", 0);

    const dashboard = buildCoverageDashboard(rootDirectory);

    expect(dashboard.overall.statements).toEqual({
      covered: 0,
      pct: 100,
      total: 0
    });
  });
});

function writeSummary(rootDirectory: string, name: string, total: number): void {
  const packageDirectory = resolve(rootDirectory, "packages", name);

  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(resolve(packageDirectory, "index.html"), `<html><body>${name}</body></html>`);
  writeFileSync(
    resolve(packageDirectory, "coverage-summary.json"),
    JSON.stringify({
      total: {
        branches: { covered: total, pct: 100, total },
        functions: { covered: total, pct: 100, total },
        lines: { covered: total, pct: 100, total },
        statements: { covered: total, pct: 100, total }
      }
    })
  );
}
