import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";
import { type TourContext } from "./tour-context.js";

const CLASS_DIAGRAM_CLASS_PATTERN = /^\s*class\s+([A-Za-z][A-Za-z0-9_]*)\b/u;
const CLASS_DIAGRAM_MEMBER_PATTERN =
  /^\s*([+#~-])?\s*(?:(?:[\w$][\w$.<>]*\s+)+)?([\w$][\w$]*)\s*(\([^)]*\))?\s*(?::\s*(.+))?\s*$/u;

type ClassDiagramElementDraft = {
  id: string;
  label: string;
};

export function createClassDiagramModel(source: string, _context: TourContext): DiagramModel {
  return {
    elements: extractClassDiagramElements(source),
    renderSource: source,
    type: "classDiagram"
  };
}

function extractClassDiagramElements(source: string): DiagramElement[] {
  const elements = new Map<string, DiagramElement>();
  let currentClassId: string | null = null;
  let inClassBody = false;

  for (const line of source.split("\n")) {
    ({ currentClassId, inClassBody } = readClassDiagramLine({
      currentClassId,
      elements,
      inClassBody,
      line
    }));
  }

  return Array.from(elements.values());
}

function readClassDiagramLine(input: {
  currentClassId: string | null;
  elements: Map<string, DiagramElement>;
  inClassBody: boolean;
  line: string;
}): {
  currentClassId: string | null;
  inClassBody: boolean;
} {
  const classMatch = input.line.match(CLASS_DIAGRAM_CLASS_PATTERN);

  if (classMatch !== null) {
    return registerClassLine(input, classMatch[1]!);
  }

  if (canReadClassBodyLine(input)) {
    return registerClassBodyLine(input);
  }

  return input;
}

function canReadClassBodyLine(input: {
  currentClassId: string | null;
  inClassBody: boolean;
}): boolean {
  return input.inClassBody && input.currentClassId !== null;
}

function registerClassLine(
  input: {
    currentClassId: string | null;
    elements: Map<string, DiagramElement>;
    inClassBody: boolean;
    line: string;
  },
  classId: string
): {
  currentClassId: string | null;
  inClassBody: boolean;
} {
  registerClassDiagramElement(input.elements, { id: classId, label: classId });

  return {
    currentClassId: classId,
    inClassBody: input.line.includes("{") && !input.line.includes("}")
  };
}

function registerClassBodyLine(
  input: {
    currentClassId: string | null;
    elements: Map<string, DiagramElement>;
    inClassBody: boolean;
    line: string;
  }
): {
  currentClassId: string | null;
  inClassBody: boolean;
} {
  if (input.line.includes("}")) {
    return {
      currentClassId: null,
      inClassBody: false
    };
  }

  const member = readClassDiagramMember(input.currentClassId as string, input.line);

  if (member !== null) {
    registerClassDiagramElement(input.elements, member);
  }

  return input;
}

function readClassDiagramMember(classId: string, line: string): ClassDiagramElementDraft | null {
  const match = line.match(CLASS_DIAGRAM_MEMBER_PATTERN);

  if (match === null) {
    return null;
  }

  return {
    id: `${classId}.${readClassDiagramMemberName(match)}`,
    label: line.trim()
  };
}

function readClassDiagramMemberName(match: RegExpMatchArray): string {
  return match[2].trim();
}

function registerClassDiagramElement(
  elements: Map<string, DiagramElement>,
  draft: ClassDiagramElementDraft
): void {
  if (elements.has(draft.id)) {
    return;
  }

  elements.set(draft.id, {
    id: draft.id,
    kind: "node",
    label: draft.label
  });
}
