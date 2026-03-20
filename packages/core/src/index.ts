export interface TourStep {
  id?: string;
  focus: string[];
  text: string;
}

export interface DiagramTour {
  version: number;
  title: string;
  diagram: string;
  steps: TourStep[];
}

export type DiagramType = "flowchart" | "sequence";

export type DiagramElementKind = "node" | "participant" | "message";

export interface DiagramElement {
  id: string;
  kind: DiagramElementKind;
  label: string;
}

export interface ResolvedDiagram {
  elements: DiagramElement[];
  path: string;
  source: string;
  type: DiagramType;
}

export interface ResolvedTourStep {
  focus: DiagramElement[];
  index: number;
  text: string;
}

export interface ResolvedDiagramTour {
  sourceKind: "authored" | "generated";
  version: number;
  title: string;
  diagram: ResolvedDiagram;
  steps: ResolvedTourStep[];
}

export interface ResolvedDiagramTourCollectionEntry {
  slug: string;
  sourcePath: string;
  title: string;
  tour: ResolvedDiagramTour;
}

export interface SkippedResolvedDiagramTour {
  sourcePath: string;
  error: string;
}

export interface ResolvedDiagramTourCollection {
  entries: ResolvedDiagramTourCollectionEntry[];
  skipped: SkippedResolvedDiagramTour[];
}

export const SUPPORTED_TOUR_VERSION = 1;
