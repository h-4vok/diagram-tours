import type { DiagramElement } from "@diagram-tour/core";

import type { DiagramModel } from "./parser-contracts.js";
import { type TourContext } from "./tour-context.js";

const CLASS_DIAGRAM_CLASS_PATTERN = /^\s*class\s+([A-Za-z][A-Za-z0-9_]*)\b/u;
const CLASS_DIAGRAM_MEMBER_PATTERN =
  /^\s*([+#~-])?\s*(?:(?:[\w$][\w$.<>\[\]]*\s+)+)?([\w$][\w$]*)\s*(\([^)]*\))?\s*(?::\s*(.+))?\s*$/u;

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
    const classMatch = line.match(CLASS_DIAGRAM_CLASS_PATTERN);

    if (classMatch !== null) {
      currentClassId = classMatch[1]!;
      registerClassDiagramElement(elements, {
        id: currentClassId,
        label: currentClassId
      });
      inClassBody = line.includes("{") && !line.includes("}");
      continue;
    }

    if (!inClassBody || currentClassId === null) {
      continue;
    }

    if (line.includes("}")) {
      inClassBody = false;
      currentClassId = null;
      continue;
    }

    const member = readClassDiagramMember(currentClassId, line);

    if (member !== null) {
      registerClassDiagramElement(elements, member);
    }
  }

  return Array.from(elements.values());
}

function readClassDiagramMember(classId: string, line: string): ClassDiagramElementDraft | null {
  const match = line.match(CLASS_DIAGRAM_MEMBER_PATTERN);

  if (match === null) {
    return null;
  }

  const memberName = readClassDiagramMemberName(match);

  if (memberName.length === 0) {
    return null;
  }

  return {
    id: `${classId}.${memberName}`,
    label: line.trim()
  };
}

function readClassDiagramMemberName(match: RegExpMatchArray): string {
  return (match[2] ?? "").trim();
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
