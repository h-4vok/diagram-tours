import type { DiagramAsset, DiagramTour, TourAsset } from "@diagram-tour/core";

export interface MermaidParseResult {
  asset: DiagramAsset;
}

export interface TourParseResult {
  asset: TourAsset;
}

export function parseMermaid(source: string, path = "diagram.mmd"): MermaidParseResult {
  return {
    asset: {
      path,
      source
    }
  };
}

export function parseTourYaml(source: string, path = "tour.yaml"): TourParseResult {
  return {
    asset: {
      path,
      source
    }
  };
}

export function validateTourShape(tour: DiagramTour): DiagramTour {
  return tour;
}

