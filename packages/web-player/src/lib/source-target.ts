import { statSync } from "node:fs";
import { basename, resolve } from "node:path";

const DEFAULT_SOURCE_TARGET = resolve(process.cwd(), "../../examples");

export function getSourceTarget(): string {
  return process.env.DIAGRAM_TOUR_SOURCE_TARGET ?? DEFAULT_SOURCE_TARGET;
}

export interface SourceTargetInfo {
  kind: "directory" | "file";
  label: string;
  path: string;
}

export function getSourceTargetInfo(): SourceTargetInfo {
  return describeSourceTarget(getSourceTarget());
}

export function describeSourceTarget(sourceTarget: string): SourceTargetInfo {
  return {
    kind: readSourceTargetKind(sourceTarget),
    label: basename(sourceTarget),
    path: sourceTarget
  };
}

function readSourceTargetKind(sourceTarget: string): SourceTargetInfo["kind"] {
  return statSync(sourceTarget).isFile() ? "file" : "directory";
}
