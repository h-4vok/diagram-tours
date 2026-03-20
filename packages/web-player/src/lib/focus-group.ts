export interface FocusGroup {
  elementIds: string[];
  mode: "empty" | "single" | "group";
  nodeIds: string[];
  size: number;
}

export function createFocusGroup(elementIds: string[]): FocusGroup {
  const uniqueElementIds = [...new Set(elementIds)].sort();

  if (uniqueElementIds.length === 0) {
    return {
      elementIds: [],
      mode: "empty",
      nodeIds: [],
      size: 0
    };
  }

  if (uniqueElementIds.length === 1) {
    return {
      elementIds: uniqueElementIds,
      mode: "single",
      nodeIds: uniqueElementIds,
      size: 1
    };
  }

  return {
    elementIds: uniqueElementIds,
    mode: "group",
    nodeIds: uniqueElementIds,
    size: uniqueElementIds.length
  };
}
