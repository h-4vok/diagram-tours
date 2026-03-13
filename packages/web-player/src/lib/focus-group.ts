export interface FocusGroup {
  mode: "empty" | "single" | "group";
  nodeIds: string[];
  size: number;
}

export function createFocusGroup(nodeIds: string[]): FocusGroup {
  const uniqueNodeIds = [...new Set(nodeIds)].sort();

  if (uniqueNodeIds.length === 0) {
    return {
      mode: "empty",
      nodeIds: [],
      size: 0
    };
  }

  if (uniqueNodeIds.length === 1) {
    return {
      mode: "single",
      nodeIds: uniqueNodeIds,
      size: 1
    };
  }

  return {
    mode: "group",
    nodeIds: uniqueNodeIds,
    size: uniqueNodeIds.length
  };
}
