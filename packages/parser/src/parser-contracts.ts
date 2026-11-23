import type {
  DiagramElement,
  DiagramType,
  ResolvedDiagramTour,
  ResolvedDiagramTourCollectionEntry,
  TourDiagnostic
} from "@diagram-tour/core";
import type { Document, ParsedNode, Scalar, YAMLMap, YAMLSeq } from "yaml";

export const DIAGRAM_FILE_SUFFIXES = [".mmd", ".md", ".mermaid"];
export const MARKDOWN_DIAGRAM_FILE_SUFFIX = ".md";
export const TOUR_FILE_SUFFIX = ".tour.yaml";
export const NO_VALID_TOURS_MESSAGE = "No valid tours or diagrams were discovered";
export const NO_MARKDOWN_MERMAID_BLOCKS_MESSAGE = "does not contain any Mermaid fenced blocks.";

export type DiagramReference = {
  fragment: string | null;
  path: string;
};

export type LoadedAuthoredTour = {
  ownedDiagramSourceId: string;
  tour: ResolvedDiagramTour;
};

export type LoadedCollectionEntry = {
  entry: ResolvedDiagramTourCollectionEntry;
  sourceId: string;
};

export type MarkdownBlock = {
  id: string;
  source: string;
  title: string;
};

export type MarkdownFence = {
  character: "`" | "~";
  info: string;
  length: number;
};

export type MarkdownBlockIdentity = {
  baseId: string;
  baseTitle: string;
};

export type MarkdownHeading = MarkdownBlockIdentity;

export type MarkdownFallback = {
  id: string;
  title: string;
};

export type MarkdownFenceState = MarkdownFence & {
  block: MarkdownBlockIdentity;
  lines: string[];
  mermaid: boolean;
};

export type MarkdownBlockAccumulator = {
  blocks: MarkdownBlock[];
  counts: Map<string, number>;
};

export type SourcePaths = {
  diagramPaths: string[];
  tourPaths: string[];
};

export type DiagramModel = {
  elements: DiagramElement[];
  renderSource: string;
  type: DiagramType;
};

export type SequenceDiagramModel = {
  messages: DiagramElement[];
  participants: DiagramElement[];
  renderSource: string;
};

export type StepValueNode = Scalar.Parsed;

export type StepDraft = {
  focus: string[];
  focusNodes: StepValueNode[];
  text: string;
  textNode: StepValueNode;
};

export type AuthoredTourDraft = {
  diagram: string;
  diagramNode: StepValueNode;
  steps: StepDraft[];
  title: string;
  version: number;
};

export type TourField = "diagram" | "focus" | "steps" | "text" | "title" | "version";

export type ParsedYamlDocument = Document.Parsed<ParsedNode>;
export type YamlMapNode = YAMLMap<unknown, unknown>;
export type YamlSeqNode = YAMLSeq<unknown>;

export type TourValidationCollector = {
  diagnostics: TourDiagnostic[];
  seen: Set<string>;
};

export interface TourValidationIssue {
  diagnostic: TourDiagnostic;
  sourceId: string;
  sourcePath: string;
}

export interface TourValidationReport {
  issues: TourValidationIssue[];
  total: number;
  valid: number;
}

export type ValidationTargetState =
  | {
      absolutePath: string;
      kind: "directory" | "file";
    }
  | {
      absolutePath: string;
      kind: "unsupported";
    };

export type ValidationTargetReport = {
  countedSourceIds: string[];
  invalidSourceIds: string[];
  issues: TourValidationIssue[];
};
