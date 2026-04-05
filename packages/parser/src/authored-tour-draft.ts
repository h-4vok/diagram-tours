import { SUPPORTED_TOUR_VERSION, type DiagramTour } from "@diagram-tour/core";
import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type ParsedNode,
  type Scalar
} from "yaml";

import type {
  AuthoredTourDraft,
  ParsedYamlDocument,
  StepDraft,
  StepValueNode,
  TourField,
  TourValidationCollector,
  YamlMapNode,
  YamlSeqNode
} from "./parser-contracts.js";
import {
  appendDiagnostic,
  createSourceLineCounter,
  createStepFieldMessage,
  createStepMessage,
  createTourMessage,
  createTourValidationCollector,
  createTourValidationError,
  invariant,
  isNonEmptyScalarString,
  readDocumentLocation,
  readFieldLocation,
  readNodeValue,
  readSupportedVersionValue,
  type TourContext
} from "./tour-context.js";

type SemanticValidationContext = {
  context: TourContext;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  parsedDocument: ParsedYamlDocument;
};

export function parseTourDocument(input: {
  context: TourContext;
  source: string;
}): AuthoredTourDraft {
  const parsedDocument = parseDocument<ParsedNode>(input.source);

  if (parsedDocument.errors.length > 0) {
    throw parsedDocument.errors[0];
  }

  return validateParsedTourDocument({
    context: input.context,
    lineCounter: createSourceLineCounter(input.source),
    parsedDocument
  });
}

export function toDiagramTour(draft: AuthoredTourDraft): DiagramTour {
  return {
    version: draft.version,
    title: draft.title,
    diagram: draft.diagram,
    steps: draft.steps.map((step) => ({
      focus: step.focus,
      text: step.text
    }))
  };
}

function validateParsedTourDocument(input: SemanticValidationContext): AuthoredTourDraft {
  const collector = createTourValidationCollector();
  const draft = readAuthoredTourDraft(input, collector);

  if (collector.diagnostics.length > 0) {
    throw createTourValidationError(input.context, collector.diagnostics);
  }

  invariant(draft !== null, createTourMessage(input.context, "failed unexpectedly"));

  return draft;
}

function readAuthoredTourDraft(
  input: SemanticValidationContext,
  collector: TourValidationCollector
): AuthoredTourDraft | null {
  const documentMap = readTourRootMap(input, collector);

  if (documentMap === null) {
    return null;
  }

  const fields = readAuthoredTourFieldNodes(documentMap);
  return createAuthoredTourDraftFromFields(input, collector, fields);
}

function createAuthoredTourDraftFromFields(
  input: SemanticValidationContext,
  collector: TourValidationCollector,
  fields: {
    diagramNode: unknown | null;
    stepsNode: unknown | null;
    titleNode: unknown | null;
    versionNode: unknown | null;
  }
): AuthoredTourDraft | null {
  const version = readVersionField(input, collector, fields.versionNode);
  const title = readTitleField(input, collector, fields.titleNode);
  const diagram = readDiagramField(input, collector, fields.diagramNode);
  const steps = readStepsField(input, collector, fields.stepsNode);

  if (hasMissingDraftFields({ diagram, steps, title, version })) {
    return null;
  }

  return {
    diagram: diagram!,
    diagramNode: fields.diagramNode as StepValueNode,
    steps: steps!,
    title: title!,
    version: version!
  };
}

function hasMissingDraftFields(
  fields: {
    diagram: string | null;
    steps: StepDraft[] | null;
    title: string | null;
    version: number | null;
  }
): boolean {
  return Object.values(fields).some((value) => value === null);
}

function readAuthoredTourFieldNodes(documentMap: YamlMapNode): {
  diagramNode: unknown | null;
  stepsNode: unknown | null;
  titleNode: unknown | null;
  versionNode: unknown | null;
} {
  return {
    diagramNode: readMapField(documentMap, "diagram"),
    stepsNode: readMapField(documentMap, "steps"),
    titleNode: readMapField(documentMap, "title"),
    versionNode: readMapField(documentMap, "version")
  };
}

function readTitleField(
  input: SemanticValidationContext,
  collector: TourValidationCollector,
  node: unknown | null
): string | null {
  return readRequiredStringField({
    collector,
    context: input.context,
    lineCounter: input.lineCounter,
    message: createTourMessage(input.context, "title is required"),
    node,
    parsedDocument: input.parsedDocument
  });
}

function readDiagramField(
  input: SemanticValidationContext,
  collector: TourValidationCollector,
  node: unknown | null
): string | null {
  return readRequiredStringField({
    collector,
    context: input.context,
    lineCounter: input.lineCounter,
    message: createTourMessage(input.context, "diagram path is required"),
    node,
    parsedDocument: input.parsedDocument
  });
}

function readStepsField(
  input: SemanticValidationContext,
  collector: TourValidationCollector,
  node: unknown | null
): StepDraft[] | null {
  const stepsNode = readNonEmptyStepsNode(input, collector, node);

  if (stepsNode === null) {
    return null;
  }

  return readStepDrafts(input, collector, stepsNode);
}

function readTourRootMap(
  input: SemanticValidationContext,
  collector: TourValidationCollector
): YamlMapNode | null {
  const contents = input.parsedDocument.contents;

  if (isYamlMapNode(contents)) {
    return contents;
  }

  appendDiagnostic(collector, {
    location: readDocumentLocation(input.parsedDocument, input.lineCounter),
    message: createTourMessage(input.context, "document must be an object")
  });

  return null;
}

function readMapField(map: YamlMapNode, key: TourField): ParsedNode | null {
  for (const item of map.items) {
    if (isMatchingMapKey(item.key, key)) {
      return readMapItemValue(item.value);
    }
  }

  return null;
}

function readMapItemValue(value: unknown): ParsedNode | null {
  return value as ParsedNode | null;
}

function isYamlMapNode(value: unknown): value is YamlMapNode {
  return value !== null && isMap(value);
}

function isMatchingMapKey(keyNode: unknown, key: TourField): boolean {
  return isScalar(keyNode) && keyNode.value === key;
}

function readVersionField(
  input: SemanticValidationContext,
  collector: TourValidationCollector,
  node: unknown
): number | null {
  const value = readSupportedVersionValue(node);

  if (value === SUPPORTED_TOUR_VERSION) {
    return value;
  }

  appendDiagnostic(collector, {
    location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
    message: createTourMessage(input.context, `unsupported tour version "${String(readNodeValue(node))}"`)
  });

  return null;
}

function readRequiredStringField(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  message: string;
  node: unknown;
  parsedDocument: ParsedYamlDocument;
}): string | null {
  if (isNonEmptyScalarString(input.node) && typeof input.node.value === "string") {
    return input.node.value;
  }

  appendDiagnostic(input.collector, {
    location: readFieldLocation(input.node, input.parsedDocument, input.lineCounter),
    message: input.message
  });

  return null;
}

function readNonEmptyStepsNode(input: {
  context: TourContext;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  parsedDocument: ParsedYamlDocument;
},
collector: TourValidationCollector,
node: unknown
): YamlSeqNode | null {
  if (isSeq(node) && node.items.length > 0) {
    return node;
  }

  appendDiagnostic(collector, {
    location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
    message: createTourMessage(input.context, "steps must be a non-empty array")
  });

  return null;
}

function readStepDrafts(
  input: SemanticValidationContext,
  collector: TourValidationCollector,
  stepsNode: YamlSeqNode
): StepDraft[] {
  return stepsNode.items
    .map((stepNode, index) =>
      readStepDraft({
        collector,
        context: input.context,
        lineCounter: input.lineCounter,
        node: stepNode,
        parsedDocument: input.parsedDocument,
        stepIndex: index + 1
      })
    )
    .filter((step): step is StepDraft => step !== null);
}

function readStepDraft(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  node: unknown;
  parsedDocument: ParsedYamlDocument;
  stepIndex: number;
}): StepDraft | null {
  const stepNode = readStepMapNode(input);

  if (stepNode === null) {
    return null;
  }

  return readStepDraftContent(input, stepNode);
}

function readStepDraftContent(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: ReturnType<typeof createSourceLineCounter>;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  stepNode: YamlMapNode
): StepDraft | null {
  const focus = readFocusField(input, readMapField(stepNode, "focus"));
  const text = readTextField(input, readMapField(stepNode, "text"));

  if (focus === null || text === null) {
    return null;
  }

  return {
    focus: focus.values,
    focusNodes: focus.nodes,
    text: text.value,
    textNode: text.node
  };
}

function readStepMapNode(input: {
  collector: TourValidationCollector;
  context: TourContext;
  lineCounter: ReturnType<typeof createSourceLineCounter>;
  node: unknown;
  parsedDocument: ParsedYamlDocument;
  stepIndex: number;
}): YamlMapNode | null {
  if (isMap(input.node)) {
    return input.node;
  }

  appendDiagnostic(input.collector, {
    location: readFieldLocation(input.node, input.parsedDocument, input.lineCounter),
    message: createStepMessage(input, "must be an object")
  });

  return null;
}

function readFocusField(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: ReturnType<typeof createSourceLineCounter>;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  node: unknown
): { nodes: StepValueNode[]; values: string[] } | null {
  const focusNode = readFocusSequenceNode(input, node);

  if (focusNode === null) {
    return null;
  }

  const values: {
    nodes: StepValueNode[];
    values: string[];
  } = {
    nodes: [],
    values: []
  };

  for (const item of focusNode.items) {
    appendFocusValue(input, item, values);
  }

  return values;
}

function appendFocusValue(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: ReturnType<typeof createSourceLineCounter>;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  item: unknown,
  values: {
    nodes: StepValueNode[];
    values: string[];
  }
): void {
  if (!isNonEmptyScalarString(item)) {
    appendDiagnostic(input.collector, {
      location: readFieldLocation(item, input.parsedDocument, input.lineCounter),
      message: createStepFieldMessage(
        input,
        "focus",
        "must contain only non-empty diagram element ids"
      )
    });
    return;
  }

  values.values.push(item.value as string);
  values.nodes.push(item as Scalar.Parsed);
}

function readFocusSequenceNode(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: ReturnType<typeof createSourceLineCounter>;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  node: unknown
): YamlSeqNode | null {
  if (isSeq(node)) {
    return node;
  }

  appendDiagnostic(input.collector, {
    location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
    message: createStepFieldMessage(input, "focus", "must be an array")
  });

  return null;
}

function readTextField(
  input: {
    collector: TourValidationCollector;
    context: TourContext;
    lineCounter: ReturnType<typeof createSourceLineCounter>;
    parsedDocument: ParsedYamlDocument;
    stepIndex: number;
  },
  node: unknown
): { node: StepValueNode; value: string } | null {
  if (!isNonEmptyScalarString(node)) {
    appendDiagnostic(input.collector, {
      location: readFieldLocation(node, input.parsedDocument, input.lineCounter),
      message: createStepFieldMessage(input, "text", "is required")
    });

    return null;
  }

  return {
    node,
    value: node.value as string
  };
}
