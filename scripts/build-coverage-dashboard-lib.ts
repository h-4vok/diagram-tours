import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface CoverageMetricSummary {
  covered: number;
  pct: number;
  total: number;
}

export interface CoveragePackageSummary {
  branches: CoverageMetricSummary;
  functions: CoverageMetricSummary;
  lines: CoverageMetricSummary;
  name: string;
  statements: CoverageMetricSummary;
}

export interface CoverageDashboardData {
  overall: CoveragePackageSummary;
  packages: CoveragePackageSummary[];
}

interface JsonSummaryMetric {
  covered: number;
  pct: number;
  total: number;
}

interface JsonCoverageSummary {
  total: {
    branches: JsonSummaryMetric;
    functions: JsonSummaryMetric;
    lines: JsonSummaryMetric;
    statements: JsonSummaryMetric;
  };
}

const PACKAGE_NAMES = ["core", "parser", "web-player", "cli", "scripts"] as const;

export function buildCoverageDashboard(rootDirectory: string): CoverageDashboardData {
  const packages = PACKAGE_NAMES.map((name) => readCoveragePackageSummary(rootDirectory, name));
  const dashboardData = {
    overall: readOverallCoverageSummary(packages),
    packages
  };

  writeCoverageDashboard(rootDirectory, dashboardData);

  return dashboardData;
}

function readCoveragePackageSummary(
  rootDirectory: string,
  name: (typeof PACKAGE_NAMES)[number]
): CoveragePackageSummary {
  const summaryPath = resolve(rootDirectory, "packages", name, "coverage-summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as JsonCoverageSummary;

  return {
    branches: summary.total.branches,
    functions: summary.total.functions,
    lines: summary.total.lines,
    name,
    statements: summary.total.statements
  };
}

function readOverallCoverageSummary(packages: CoveragePackageSummary[]): CoveragePackageSummary {
  return {
    branches: readAggregateMetricSummary(packages, "branches"),
    functions: readAggregateMetricSummary(packages, "functions"),
    lines: readAggregateMetricSummary(packages, "lines"),
    name: "overall",
    statements: readAggregateMetricSummary(packages, "statements")
  };
}

function readAggregateMetricSummary(
  packages: CoveragePackageSummary[],
  key: keyof Omit<CoveragePackageSummary, "name">
): CoverageMetricSummary {
  const covered = packages.reduce((total, packageSummary) => total + packageSummary[key].covered, 0);
  const count = packages.reduce((total, packageSummary) => total + packageSummary[key].total, 0);

  return {
    covered,
    pct: count === 0 ? 100 : Number(((covered / count) * 100).toFixed(2)),
    total: count
  };
}

function writeCoverageDashboard(rootDirectory: string, dashboardData: CoverageDashboardData): void {
  const dashboardPath = resolve(rootDirectory, "index.html");
  const summaryPath = resolve(rootDirectory, "coverage-summary.json");

  mkdirSync(dirname(dashboardPath), { recursive: true });
  writeFileSync(dashboardPath, renderCoverageDashboardHtml(dashboardData));
  writeFileSync(summaryPath, JSON.stringify(dashboardData, null, 2));
}

function renderCoverageDashboardHtml(dashboardData: CoverageDashboardData): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "  <title>diagram-tours coverage dashboard</title>",
    "  <style>",
    "    :root { color-scheme: dark; font-family: 'Segoe UI', sans-serif; }",
    "    body { background: #121212; color: #f4efe7; margin: 0; padding: 2rem; }",
    "    main { margin: 0 auto; max-width: 1100px; }",
    "    h1, h2 { margin: 0 0 1rem; }",
    "    p { color: #d3c6b8; line-height: 1.5; }",
    "    .hero { background: #1c1c1c; border: 1px solid #3a342e; border-radius: 20px; padding: 1.5rem; margin-bottom: 1.5rem; }",
    "    .totals { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 1rem; }",
    "    .metric { background: #191611; border: 1px solid #40362b; border-radius: 16px; padding: 1rem; }",
    "    .metric strong { display: block; font-size: 1.75rem; margin-top: 0.25rem; }",
    "    table { border-collapse: collapse; width: 100%; background: #1c1c1c; border: 1px solid #3a342e; border-radius: 20px; overflow: hidden; }",
    "    th, td { border-bottom: 1px solid #332c25; padding: 0.9rem 1rem; text-align: left; }",
    "    th { color: #f8d7a7; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; }",
    "    tr:last-child td { border-bottom: 0; }",
    "    a { color: #8fb7ff; text-decoration: none; }",
    "    a:hover { text-decoration: underline; }",
    "    .package-link { font-weight: 600; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <section class=\"hero\">",
    "      <h1>Unified Coverage Dashboard</h1>",
    "      <p>Open this page first, then drill into each package or script report for file-level detail.</p>",
    `      ${renderMetricCards(dashboardData.overall)}`,
    "    </section>",
    "    <section>",
    "      <h2>Package Coverage</h2>",
    "      <table>",
    "        <thead>",
    "          <tr>",
    "            <th>Section</th>",
    "            <th>Statements</th>",
    "            <th>Branches</th>",
    "            <th>Functions</th>",
    "            <th>Lines</th>",
    "            <th>Detail</th>",
    "          </tr>",
    "        </thead>",
    "        <tbody>",
    ...dashboardData.packages.map((packageSummary) => renderPackageRow(packageSummary)),
    "        </tbody>",
    "      </table>",
    "    </section>",
    "  </main>",
    "</body>",
    "</html>"
  ].join("\n");
}

function renderMetricCards(summary: CoveragePackageSummary): string {
  return [
    "      <div class=\"totals\">",
    renderMetricCard("Statements", summary.statements.pct),
    renderMetricCard("Branches", summary.branches.pct),
    renderMetricCard("Functions", summary.functions.pct),
    renderMetricCard("Lines", summary.lines.pct),
    "      </div>"
  ].join("\n");
}

function renderMetricCard(label: string, percentage: number): string {
  return [
    "        <div class=\"metric\">",
    `          <span>${label}</span>`,
    `          <strong>${percentage.toFixed(2)}%</strong>`,
    "        </div>"
  ].join("\n");
}

function renderPackageRow(summary: CoveragePackageSummary): string {
  return [
    "          <tr>",
    `            <td>${capitalize(summary.name)}</td>`,
    `            <td>${summary.statements.pct.toFixed(2)}%</td>`,
    `            <td>${summary.branches.pct.toFixed(2)}%</td>`,
    `            <td>${summary.functions.pct.toFixed(2)}%</td>`,
    `            <td>${summary.lines.pct.toFixed(2)}%</td>`,
    `            <td><a class="package-link" href="./packages/${summary.name}/index.html">Open detail report</a></td>`,
    "          </tr>"
  ].join("\n");
}

function capitalize(input: string): string {
  return input
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
