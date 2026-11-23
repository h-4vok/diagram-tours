import { resolve } from "node:path";

import { createTourDiagnostics } from "./diagnostics.js";
import { createDiagramModel, resolveLoadedTour } from "./diagram-model.js";
import { parseTourDocument, toDiagramTour } from "./authored-tour-draft.js";
import { readDiagramSource } from "./markdown-blocks.js";
import type { LoadedAuthoredTour, StepValueNode } from "./parser-contracts.js";
import { validateResolvedTourDraft } from "./resolved-draft-diagnostics.js";
import {
  createTourContext,
  createTourValidationError,
  readNodeLocation,
  readTextFile,
  runWithContext,
  createSourceLineCounter,
  type TourContext
} from "./tour-context.js";

export async function loadResolvedTour(tourPath: string) {
  const absoluteTourPath = resolve(tourPath);
  const context = createTourContext(absoluteTourPath);

  return runWithContext(context, async () => {
    return (await loadAuthoredTourDocument({
      absoluteTourPath,
      context
    })).tour;
  });
}

export async function loadAuthoredTourDocument(input: {
  absoluteTourPath: string;
  context: TourContext;
}): Promise<LoadedAuthoredTour> {
  const rawTourDocument = await readRawTourDocument(input);
  const loadedDiagram = await loadAuthoredDiagramSource(input, rawTourDocument);
  const validationDiagnostics = validateResolvedTourDraft({
    context: input.context,
    diagramModel: createDiagramModel(loadedDiagram.source, input.context),
    draft: rawTourDocument.draft,
    source: rawTourDocument.source
  });

  if (validationDiagnostics.length > 0) {
    throw createTourValidationError(input.context, validationDiagnostics);
  }

  return {
    ownedDiagramSourceId: loadedDiagram.ownedDiagramSourceId,
    tour: resolveLoadedTour({
      context: input.context,
      diagramPath: rawTourDocument.draft.diagram,
      diagramSource: loadedDiagram.source,
      rawTour: toDiagramTour(rawTourDocument.draft)
    })
  };
}

async function readRawTourDocument(input: {
  absoluteTourPath: string;
  context: TourContext;
}): Promise<{
  draft: ReturnType<typeof parseTourDocument>;
  source: string;
}> {
  const tourSource = await readTextFile(input.absoluteTourPath);

  return {
    draft: parseTourDocument({
      source: tourSource,
      context: input.context
    }),
    source: tourSource
  };
}

async function loadAuthoredDiagramSource(
  input: { absoluteTourPath: string; context: TourContext },
  rawTourDocument: {
    draft: ReturnType<typeof parseTourDocument>;
    source: string;
  }
): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  return readDiagramSourceWithLocation({
    absoluteTourPath: input.absoluteTourPath,
    context: input.context,
    diagramNode: rawTourDocument.draft.diagramNode,
    diagramPath: rawTourDocument.draft.diagram,
    source: rawTourDocument.source
  });
}

async function readDiagramSourceWithLocation(input: {
  absoluteTourPath: string;
  context: TourContext;
  diagramNode: StepValueNode;
  diagramPath: string;
  source: string;
}): Promise<{
  ownedDiagramSourceId: string;
  source: string;
}> {
  try {
    return await readDiagramSource({
      absoluteTourPath: input.absoluteTourPath,
      context: input.context,
      diagramPath: input.diagramPath
    });
  } catch (error) {
    const diagnostics = createTourDiagnostics(error).map((diagnostic) => ({
      ...diagnostic,
      location:
        diagnostic.location ??
        readNodeLocation(input.diagramNode, createSourceLineCounter(input.source))
    }));

    throw createTourValidationError(input.context, diagnostics);
  }
}
