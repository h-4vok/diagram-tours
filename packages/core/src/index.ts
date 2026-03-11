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

export interface MermaidNode {
  id: string;
  label: string;
}

export interface ResolvedDiagram {
  path: string;
  source: string;
  nodes: MermaidNode[];
}

export interface ResolvedTourStep {
  index: number;
  focus: MermaidNode[];
  text: string;
}

export interface ResolvedDiagramTour {
  version: number;
  title: string;
  diagram: ResolvedDiagram;
  steps: ResolvedTourStep[];
}

export const SUPPORTED_TOUR_VERSION = 1;
