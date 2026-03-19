import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface CliPackageJson {
  version: string;
}

export function readCliVersion(): string {
  const packageJson = JSON.parse(readFileSync(readPackageJsonPath(), "utf8")) as CliPackageJson;

  return packageJson.version;
}

function readPackageJsonPath(): string {
  return fileURLToPath(new URL("../../package.json", import.meta.url));
}
