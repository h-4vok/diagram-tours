import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const channel = process.argv[2];

if (!["alpha", "beta", "release"].includes(channel)) {
  throw new Error('Expected a release channel: "alpha", "beta", or "release".');
}

if (channel === "release") {
  leavePreMode();
  runChangeset(["version"]);
  process.exit(0);
}

enterPreMode(channel);
runChangeset(["version"]);

function enterPreMode(tag) {
  const currentTag = readCurrentTag();

  if (currentTag === tag) {
    return;
  }

  leavePreMode();
  runChangeset(["pre", "enter", tag]);
}

function leavePreMode() {
  if (!existsSync(".changeset/pre.json")) {
    return;
  }

  runChangeset(["pre", "exit"]);
}

function readCurrentTag() {
  if (!existsSync(".changeset/pre.json")) {
    return null;
  }

  const preState = JSON.parse(readFileSync(".changeset/pre.json", "utf8"));

  return typeof preState.tag === "string" ? preState.tag : null;
}

function runChangeset(args) {
  const result = spawnSync("bunx", ["changeset", ...args], {
    shell: true,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
