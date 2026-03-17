import type { ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";

export interface BrowseTourNode {
  id: string;
  isActive: boolean;
  kind: "tour";
  slug: string;
  sourcePath: string;
  title: string;
}

export interface BrowseFolderNode {
  children: BrowseTreeNode[];
  displayName: string;
  fullPath: string;
  id: string;
  isActiveBranch: boolean;
  kind: "folder";
}

export type BrowseTreeNode = BrowseFolderNode | BrowseTourNode;

export interface BrowseTreeRow {
  depth: number;
  node: BrowseTreeNode;
}

interface BuildFolderNode {
  children: Map<string, BuildFolderNode | BrowseTourNode>;
  fullPath: string;
  isActiveBranch: boolean;
  name: string;
}

export function buildBrowseTree(
  entries: ResolvedDiagramTourCollectionEntry[],
  activeSlug: string | null
): BrowseTreeNode[] {
  const root = createBuildFolderNode("", "");

  for (const entry of entries) {
    insertBrowseEntry(root, entry, activeSlug);
  }

  return sortBrowseNodes(compactBrowseNodes(Array.from(root.children.values())));
}

export function filterBrowseTree(nodes: BrowseTreeNode[], query: string): BrowseTreeNode[] {
  const normalizedQuery = normalizeSearchValue(query);

  if (normalizedQuery.length === 0) {
    return nodes;
  }

  return nodes.flatMap((node) => filterBrowseNode(node, normalizedQuery));
}

export function flattenBrowseTree(
  nodes: BrowseTreeNode[],
  expandedFolderIds: string[],
  forceExpand: boolean
): BrowseTreeRow[] {
  return flattenBrowseRows({
    depth: 0,
    expandedFolderIds: new Set(expandedFolderIds),
    forceExpand,
    nodes
  });
}

export function collectActiveBrowseFolderIds(nodes: BrowseTreeNode[]): string[] {
  return nodes.flatMap((node) => collectActiveFolderIdsFromNode(node));
}

function createBuildFolderNode(name: string, fullPath: string): BuildFolderNode {
  return {
    children: new Map(),
    fullPath,
    isActiveBranch: false,
    name
  };
}

function insertBrowseEntry(
  root: BuildFolderNode,
  entry: ResolvedDiagramTourCollectionEntry,
  activeSlug: string | null
): void {
  const isActive = entry.slug === activeSlug;
  const pathSegments = entry.sourcePath.split("/");
  const folderSegments = pathSegments.slice(0, -1);
  let current = root;

  for (const segment of folderSegments) {
    markBuildFolderNodeActive(current, isActive);
    current = readOrCreateBuildFolderNode(current, segment);
  }

  markBuildFolderNodeActive(current, isActive);
  current.children.set(entry.slug, {
    id: `tour:${entry.slug}`,
    isActive,
    kind: "tour",
    slug: entry.slug,
    sourcePath: entry.sourcePath,
    title: entry.title
  });
}

function readOrCreateBuildFolderNode(
  current: BuildFolderNode,
  segment: string
): BuildFolderNode {
  const fullPath = current.fullPath.length === 0 ? segment : `${current.fullPath}/${segment}`;
  const existingFolder = readBuildFolderChild(current, segment);

  if (existingFolder !== null) {
    return existingFolder;
  }

  const next = createBuildFolderNode(segment, fullPath);
  current.children.set(segment, next);

  return next;
}

function compactBrowseNodes(nodes: Array<BuildFolderNode | BrowseTourNode>): BrowseTreeNode[] {
  return nodes.map((node) => compactBrowseNode(node));
}

function compactBrowseNode(node: BuildFolderNode | BrowseTourNode): BrowseTreeNode {
  if (!isBuildFolderNode(node)) {
    return node;
  }

  const compacted = compactBuildFolderNode(node);

  return {
    children: sortBrowseNodes(compacted.children.map((child) => compactBrowseNode(child))),
    displayName: compacted.displayName,
    fullPath: compacted.fullPath,
    id: `folder:${compacted.fullPath}`,
    isActiveBranch: compacted.isActiveBranch,
    kind: "folder"
  };
}

function compactBuildFolderNode(node: BuildFolderNode): {
  children: Array<BuildFolderNode | BrowseTourNode>;
  displayName: string;
  fullPath: string;
  isActiveBranch: boolean;
} {
  let current = node;
  const names = [node.name];

  while (current.children.size === 1) {
    const onlyChild = Array.from(current.children.values())[0];

    if (!isBuildFolderNode(onlyChild)) {
      break;
    }

    names.push(onlyChild.name);
    current = onlyChild;
  }

  return {
    children: Array.from(current.children.values()),
    displayName: names.join("/"),
    fullPath: current.fullPath,
    isActiveBranch: current.isActiveBranch
  };
}

function sortBrowseNodes(nodes: BrowseTreeNode[]): BrowseTreeNode[] {
  return [...nodes].sort((left, right) => compareBrowseNodes(left, right));
}

function compareBrowseNodes(left: BrowseTreeNode, right: BrowseTreeNode): number {
  const kindComparison = compareBrowseKinds(left, right);

  if (kindComparison !== 0) {
    return kindComparison;
  }

  return readBrowseSortLabel(left).localeCompare(readBrowseSortLabel(right), undefined, {
    sensitivity: "base"
  });
}

function filterBrowseNode(node: BrowseTreeNode, query: string): BrowseTreeNode[] {
  if (node.kind === "tour") {
    return matchesBrowseQuery(node, query) ? [node] : [];
  }

  return filterBrowseFolderNode(node, query);
}

function matchesBrowseQuery(node: BrowseTourNode, query: string): boolean {
  const haystack = normalizeSearchValue(`${node.title} ${node.slug} ${node.sourcePath}`);

  return haystack.includes(query) || matchesFuzzyBrowseQuery(node, query);
}

function matchesFuzzyBrowseQuery(node: BrowseTourNode, query: string): boolean {
  if (!shouldUseFuzzyBrowseQuery(query)) {
    return false;
  }

  return readBrowseSearchTokens(node).some((token) => hasFuzzyOrderedMatch(token, query));
}

function shouldUseFuzzyBrowseQuery(query: string): boolean {
  return query.length <= 4 && !query.includes(" ");
}

function readBrowseSearchTokens(node: BrowseTourNode): string[] {
  return normalizeSearchValue(`${node.title} ${node.slug} ${node.sourcePath}`)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0);
}

function hasFuzzyOrderedMatch(haystack: string, query: string): boolean {
  let haystackIndex = 0;

  return Array.from(query).every((character) => {
    const nextIndex = haystack.indexOf(character, haystackIndex);

    if (nextIndex === -1) {
      return false;
    }

    haystackIndex = nextIndex + 1;

    return true;
  });
}

function flattenBrowseRows(input: {
  depth: number;
  expandedFolderIds: Set<string>;
  forceExpand: boolean;
  nodes: BrowseTreeNode[];
}): BrowseTreeRow[] {
  return input.nodes.flatMap((node) => flattenBrowseNode({ ...input, node }));
}

function flattenBrowseNode(input: {
  depth: number;
  expandedFolderIds: Set<string>;
  forceExpand: boolean;
  node: BrowseTreeNode;
}): BrowseTreeRow[] {
  if (input.node.kind === "tour") {
    return [
      {
        depth: input.depth,
        node: input.node
      }
    ];
  }

  const folderNode = input.node;

  return flattenBrowseFolderRow({
    ...input,
    node: folderNode
  });
}

function collectActiveFolderIdsFromNode(node: BrowseTreeNode): string[] {
  if (node.kind === "tour") {
    return [];
  }

  return [
    ...(node.isActiveBranch ? [node.id] : []),
    ...node.children.flatMap((child) => collectActiveFolderIdsFromNode(child))
  ];
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function markBuildFolderNodeActive(node: BuildFolderNode, isActive: boolean): void {
  node.isActiveBranch ||= isActive;
}

function readBuildFolderChild(current: BuildFolderNode, segment: string): BuildFolderNode | null {
  const existing = current.children.get(segment);

  return existing !== undefined && isBuildFolderNode(existing) ? existing : null;
}

function compareBrowseKinds(left: BrowseTreeNode, right: BrowseTreeNode): number {
  if (left.kind === right.kind) {
    return 0;
  }

  return left.kind === "folder" ? -1 : 1;
}

function readBrowseSortLabel(node: BrowseTreeNode): string {
  return node.kind === "folder" ? node.displayName : node.title;
}

function filterBrowseFolderNode(node: BrowseFolderNode, query: string): BrowseTreeNode[] {
  const children = node.children.flatMap((child) => filterBrowseNode(child, query));

  if (children.length === 0) {
    return [];
  }

  return [
    {
      ...node,
      children
    }
  ];
}

function flattenBrowseFolderRow(input: {
  depth: number;
  expandedFolderIds: Set<string>;
  forceExpand: boolean;
  node: BrowseFolderNode;
}): BrowseTreeRow[] {
  const row = {
    depth: input.depth,
    node: input.node
  };

  if (!shouldExpandBrowseFolder(input)) {
    return [row];
  }

  return [
    row,
    ...flattenBrowseRows({
      depth: input.depth + 1,
      expandedFolderIds: input.expandedFolderIds,
      forceExpand: input.forceExpand,
      nodes: input.node.children
    })
  ];
}

function shouldExpandBrowseFolder(input: {
  expandedFolderIds: Set<string>;
  forceExpand: boolean;
  node: BrowseFolderNode;
}): boolean {
  return input.forceExpand || input.expandedFolderIds.has(input.node.id);
}

function isBuildFolderNode(
  node: BuildFolderNode | BrowseTourNode
): node is BuildFolderNode {
  return "children" in node;
}
