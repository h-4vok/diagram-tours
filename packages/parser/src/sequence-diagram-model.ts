import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel, SequenceDiagramModel } from "./parser-contracts.js";
import { createTourMessage, invariant, type TourContext } from "./tour-context.js";

const SEQUENCE_PARTICIPANT_PATTERN =
  /^\s*(?:create\s+)?(participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+as\s+(.+?))?\s*$/u;
const SEQUENCE_MESSAGE_PATTERN =
  /^(\s*[A-Za-z][A-Za-z0-9_]*(?:\(\))?\s*[-.=/\\|x<>)]{1,}\s*[+-]?\s*[A-Za-z][A-Za-z0-9_]*(?:\(\))?\s*:\s*)\[([A-Za-z][A-Za-z0-9_]*)\]\s+(.+?)(\s*;+\s*)?$/u;

export function createSequenceDiagramModel(source: string, context: TourContext): DiagramModel {
  const sequenceModel = extractSequenceDiagramModel(source, context);

  return {
    elements: [...sequenceModel.elements],
    renderSource: sequenceModel.renderSource,
    type: "sequence"
  };
}

function extractSequenceDiagramModel(source: string, context: TourContext): SequenceDiagramModel {
  const elements = new Map<string, DiagramElement>();
  const orderedElements: DiagramElement[] = [];
  const participants: DiagramElement[] = [];
  const messages: DiagramElement[] = [];
  const renderLines = source.split("\n").map((line) =>
    readSequenceRenderLine({
      context,
      elements,
      line,
      messages,
      orderedElements,
      participants
    })
  );

  return {
    elements: orderedElements,
    messages,
    participants,
    renderSource: renderLines.join("\n")
  };
}

function readSequenceRenderLine(input: {
  context: TourContext;
  elements: Map<string, DiagramElement>;
  line: string;
  messages: DiagramElement[];
  orderedElements: DiagramElement[];
  participants: DiagramElement[];
}): string {
  const participant = readSequenceParticipant(input.line);

  if (participant !== null) {
    return registerSequenceParticipantLine(input, participant);
  }

  const message = readSequenceMessage(input.line);

  if (message === null) {
    return input.line;
  }

  return registerSequenceMessageLine(input, message);
}

function registerSequenceParticipantLine(
  input: {
    context: TourContext;
    elements: Map<string, DiagramElement>;
    line: string;
    orderedElements: DiagramElement[];
    participants: DiagramElement[];
  },
  participant: DiagramElement
): string {
  registerSequenceElement({
    context: input.context,
    element: participant,
    elements: input.elements
  });
  input.participants.push(participant);
  input.orderedElements.push(participant);

  return input.line;
}

function registerSequenceMessageLine(
  input: {
    context: TourContext;
    elements: Map<string, DiagramElement>;
    line: string;
    messages: DiagramElement[];
    orderedElements: DiagramElement[];
  },
  message: DiagramElement
): string {
  registerSequenceElement({
    context: input.context,
    element: message,
    elements: input.elements
  });
  input.messages.push(message);
  input.orderedElements.push(message);

  return input.line;
}

function readSequenceParticipant(line: string): DiagramElement | null {
  const match = line.match(SEQUENCE_PARTICIPANT_PATTERN);

  if (match === null) {
    return null;
  }

  return {
    id: match[2],
    kind: "participant",
    label: readSequenceParticipantLabel(match)
  };
}

function readSequenceParticipantLabel(match: RegExpMatchArray): string {
  const alias = match.at(3);

  return alias === undefined ? match[2]! : alias.trim();
}

function readSequenceMessage(line: string): DiagramElement | null {
  const match = line.match(SEQUENCE_MESSAGE_PATTERN);

  if (match === null) {
    return null;
  }

  return {
    id: match[2],
    kind: "message",
    label: match[3].trim()
  };
}

function registerSequenceElement(input: {
  context: TourContext;
  element: DiagramElement;
  elements: Map<string, DiagramElement>;
}): void {
  const existing = input.elements.get(input.element.id);

  invariant(
    existing === undefined,
    createTourMessage(
      input.context,
      `diagram contains duplicate Mermaid sequence id "${input.element.id}"`
    )
  );
  input.elements.set(input.element.id, input.element);
}
