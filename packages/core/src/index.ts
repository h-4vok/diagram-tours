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

export interface DiagramAsset {
  path: string;
  source: string;
}

export interface TourAsset {
  path: string;
  source: string;
}

