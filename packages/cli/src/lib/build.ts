import { existsSync } from "node:fs";
import { cp, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
import { loadResolvedTourCollection } from "@diagram-tour/parser";
import type { BrowserOpener } from "./browser.js";
import type { ParsedBuildArgs } from "./types.js";
import { validateTargetPath } from "./target.js";

export interface StaticTourPayload { version: 1; collection: ResolvedDiagramTourCollection }

function workspaceRoot(): string { return resolve(import.meta.dirname, "../../../../"); }
const require = createRequire(import.meta.url);

export async function runBuildCommand(options: ParsedBuildArgs, opener: BrowserOpener): Promise<number> {
  const target = validateTargetPath(options.target);
  const out = resolve(options.out);
  assertOutputAvailable(out, options.overwrite);
  const collection = await loadResolvedTourCollection(target, { allowEmpty: options.continueOnError });
  reportBuildIssues(collection, options);
  assertBuildCanContinue(collection, options.continueOnError);
  await buildStaticOutput({ collection, out, overwrite: options.overwrite, target });
  process.stdout.write(`Static build generated at ${out} (${collection.entries.length} tours)\n`);
  if (options.browser === "always") { await opener.open(`file://${resolve(out, "index.html")}`); }
  return 0;
}

function assertOutputAvailable(out: string, overwrite: boolean): void {
  if (existsSync(out) && !overwrite) {
    throw new Error(`Output directory already exists: ${out}. Use --overwrite.`);
  }
}

function reportBuildIssues(
  collection: ResolvedDiagramTourCollection,
  options: ParsedBuildArgs
): void {
  if (!shouldReportBuildIssues(collection, options)) {
    return;
  }

  process.stderr.write(`Warning: ${collection.skipped.length} invalid tour file(s) omitted. See Issues panel.\n`);
  writeVerboseSkippedDetails(collection, options.logLevel);
}

function shouldReportBuildIssues(
  collection: ResolvedDiagramTourCollection,
  options: ParsedBuildArgs
): boolean {
  return collection.skipped.length > 0 && options.logLevel !== "quiet";
}

function writeVerboseSkippedDetails(
  collection: ResolvedDiagramTourCollection,
  logLevel: ParsedBuildArgs["logLevel"]
): void {
  if (logLevel === "verbose") {
    process.stderr.write(readSkippedDetails(collection));
  }
}

function readSkippedDetails(collection: ResolvedDiagramTourCollection): string {
  return collection.skipped
    .flatMap((skipped) => skipped.diagnostics.map((diagnostic) => `  ${skipped.sourcePath}: ${diagnostic.message}\n`))
    .join("");
}

function assertBuildCanContinue(
  collection: ResolvedDiagramTourCollection,
  continueOnError: boolean
): void {
  if (continueOnError || collection.skipped.length === 0) {
    return;
  }

  throw new Error(
    `Build stopped: ${collection.skipped.length} invalid tour file(s) found. Use --continue to build anyway.`
  );
}

async function buildStaticOutput(input: {
  collection: ResolvedDiagramTourCollection;
  out: string;
  overwrite: boolean;
  target: string;
}): Promise<void> {
  await mkdir(dirname(input.out), { recursive: true });
  let stagingDir: string | null = null;
  let payloadDir: string | null = null;
  try {
    stagingDir = await mkdtemp(resolve(dirname(input.out), ".diagram-tours-static-"));
    payloadDir = await mkdtemp(resolve(tmpdir(), "diagram-tours-payload-"));
    const payload = resolve(payloadDir, "tours-data.json");
    await writeFile(payload, `${JSON.stringify({ version: 1, collection: input.collection })}\n`, "utf8");
    await runStaticPlayerBuild(stagingDir, input.target, payload);
    await copyFile(payload, resolve(stagingDir, "tours-data.json"));
    await materializeTourRoutes(stagingDir, input.collection);
    await publishOutput(stagingDir, input.out, input.overwrite);
    stagingDir = null;
  } finally {
    if (stagingDir !== null) {
      await rm(stagingDir, { recursive: true, force: true });
    }
    if (payloadDir !== null) {
      await rm(payloadDir, { recursive: true, force: true });
    }
  }
}

async function materializeTourRoutes(out: string, collection: ResolvedDiagramTourCollection): Promise<void> {
  const indexPath = resolve(out, "index.html");
  const html = await readFile(indexPath, "utf8");
  const serialized = JSON.stringify({ version: 1, collection }).replaceAll("<", "\\u003c");
  const payloadScript = `<script>globalThis.__DIAGRAM_TOUR_DATA__=${serialized};</script>`;
  await writeFile(indexPath, addStaticPayload(html, payloadScript, "./"), "utf8");
  for (const entry of collection.entries) {
    const routeDir = resolve(out, entry.slug);
    await mkdir(routeDir, { recursive: true });
    const assetPrefix = "../".repeat(entry.slug.split("/").length);
    await writeFile(resolve(routeDir, "index.html"), addStaticPayload(html, payloadScript, assetPrefix), "utf8");
    await copyFile(resolve(out, "tours-data.json"), resolve(routeDir, "tours-data.json"));
  }
}

function addStaticPayload(html: string, payloadScript: string, assetPrefix: string): string {
  return html
    .replace("</head>", `${payloadScript}</head>`)
    .replace(/(?:\.\.\/|\.\/|\/)_app\//g, `${assetPrefix}_app/`);
}

async function publishOutput(stagingDir: string, out: string, overwrite: boolean): Promise<void> {
  if (canPublishDirectly(out, overwrite)) {
    await rename(stagingDir, out);

    return;
  }

  const backupPath = await createBackupPath(out);
  await rename(out, backupPath);
  try {
    await rename(stagingDir, out);
  } catch (error) {
    await restoreOutput(backupPath, out);
    throw error;
  }
  await rm(backupPath, { recursive: true, force: true });
}

function canPublishDirectly(out: string, overwrite: boolean): boolean {
  return !overwrite || !existsSync(out);
}

async function createBackupPath(out: string): Promise<string> {
  const backupPath = await mkdtemp(resolve(dirname(out), ".diagram-tours-backup-"));
  await rm(backupPath, { recursive: true, force: true });

  return backupPath;
}

async function restoreOutput(backupPath: string, out: string): Promise<void> {
  if (existsSync(out)) {
    await rm(out, { recursive: true, force: true });
  }
  await rename(backupPath, out);
}

async function runStaticPlayerBuild(out: string, target: string, payload: string): Promise<void> {
  const sourceRoot = resolve(workspaceRoot(), "packages/web-player");
  if (!existsSync(resolve(sourceRoot, "svelte.config.js"))) {
    const packageRoot = dirname(require.resolve("@diagram-tour/web-player/package.json"));
    await cp(resolve(packageRoot, "build-static"), out, { recursive: true, force: true });
    return;
  }
  await new Promise<void>((resolveBuild, rejectBuild) => {
    /* c8 ignore next -- platform-specific executable suffix */
    const command = process.platform === "win32" ? "bun.cmd" : "bun";
    const child = spawn(command, ["run", "build:static"], {
      cwd: sourceRoot,
      env: { ...process.env, DIAGRAM_TOUR_STATIC_OUT: out, DIAGRAM_TOUR_STATIC_DATA: payload, DIAGRAM_TOUR_SOURCE_TARGET: target, PUBLIC_DIAGRAM_TOUR_STATIC: "true" },
      stdio: "inherit",
      shell: true
    });
    child.once("error", rejectBuild);
    child.once("exit", (code) => {
      if (code === 0) { resolveBuild(); return; }
      rejectBuild(new Error(`Static player build failed (${code}).`));
    });
  });
}
