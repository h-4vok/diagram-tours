import type { ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";
import { describe, expect, it } from "vitest";

import {
  buildBrowseTree,
  collectActiveBrowseFolderIds,
  filterBrowseTree,
  flattenBrowseTree
} from "../src/lib/browse-tree";

const entries = [
  {
    slug: "payment-flow",
    sourcePath: "payments/core/payment-flow/payment-flow.tour.yaml",
    title: "Payment Flow",
    tour: {
      diagram: createDiagram("./checkout-payment-flow.mmd"),
      sourceKind: "authored",
      steps: [],
      title: "Payment Flow",
      version: 1
    }
  },
  {
    slug: "refund-flow",
    sourcePath: "payments/support/refund-flow/refund-flow.tour.yaml",
    title: "Refund Flow",
    tour: {
      diagram: createDiagram("./checkout-refund-flow.mmd"),
      sourceKind: "authored",
      steps: [],
      title: "Refund Flow",
      version: 1
    }
  },
  {
    slug: "release-pipeline",
    sourcePath: "ops/release/release-pipeline/release-pipeline.tour.yaml",
    title: "Release Pipeline",
    tour: {
      diagram: createDiagram("./ops-release-pipeline.mmd"),
      sourceKind: "authored",
      steps: [],
      title: "Release Pipeline",
      version: 1
    }
  }
] satisfies ResolvedDiagramTourCollectionEntry[];

describe("browse-tree", () => {
  it("builds a folder and tour hierarchy from flat source paths", () => {
    const tree = buildBrowseTree(entries, null);

    expect(tree).toEqual([
      {
        children: [
          {
            id: "tour:release-pipeline",
            isActive: false,
            kind: "tour",
            slug: "release-pipeline",
            sourcePath: "ops/release/release-pipeline/release-pipeline.tour.yaml",
            title: "Release Pipeline"
          }
        ],
        displayName: "ops/release/release-pipeline",
        fullPath: "ops/release/release-pipeline",
        id: "folder:ops/release/release-pipeline",
        isActiveBranch: false,
        kind: "folder"
      },
      {
        children: [
          {
            children: [
              {
                id: "tour:payment-flow",
                isActive: false,
                kind: "tour",
                slug: "payment-flow",
                sourcePath: "payments/core/payment-flow/payment-flow.tour.yaml",
                title: "Payment Flow"
              }
            ],
            displayName: "core/payment-flow",
            fullPath: "payments/core/payment-flow",
            id: "folder:payments/core/payment-flow",
            isActiveBranch: false,
            kind: "folder"
          },
          {
            children: [
              {
                id: "tour:refund-flow",
                isActive: false,
                kind: "tour",
                slug: "refund-flow",
                sourcePath: "payments/support/refund-flow/refund-flow.tour.yaml",
                title: "Refund Flow"
              }
            ],
            displayName: "support/refund-flow",
            fullPath: "payments/support/refund-flow",
            id: "folder:payments/support/refund-flow",
            isActiveBranch: false,
            kind: "folder"
          }
        ],
        displayName: "payments",
        fullPath: "payments",
        id: "folder:payments",
        isActiveBranch: false,
        kind: "folder"
      }
    ]);
  });

  it("marks the active tour branch and collects the folder ids needed to reveal it", () => {
    const tree = buildBrowseTree(entries, "refund-flow");

    expect(collectActiveBrowseFolderIds(tree)).toEqual([
      "folder:payments",
      "folder:payments/support/refund-flow"
    ]);
    expect(tree[1]).toMatchObject({
      id: "folder:payments",
      isActiveBranch: true
    });
  });

  it("filters by case-insensitive substring across title, slug, and source path", () => {
    const tree = buildBrowseTree(entries, null);

    expect(filterBrowseTree(tree, "refund")).toEqual([
      {
        children: [
          {
            children: [
              {
                id: "tour:refund-flow",
                isActive: false,
                kind: "tour",
                slug: "refund-flow",
                sourcePath: "payments/support/refund-flow/refund-flow.tour.yaml",
                title: "Refund Flow"
              }
            ],
            displayName: "support/refund-flow",
            fullPath: "payments/support/refund-flow",
            id: "folder:payments/support/refund-flow",
            isActiveBranch: false,
            kind: "folder"
          }
        ],
        displayName: "payments",
        fullPath: "payments",
        id: "folder:payments",
        isActiveBranch: false,
        kind: "folder"
      }
    ]);
    expect(filterBrowseTree(tree, "ops/release")).toHaveLength(1);
  });

  it("falls back to ordered-character fuzzy matching for tours", () => {
    const tree = buildBrowseTree(entries, null);

    expect(filterBrowseTree(tree, "rfnd")).toEqual([
      {
        children: [
          {
            children: [
              {
                id: "tour:refund-flow",
                isActive: false,
                kind: "tour",
                slug: "refund-flow",
                sourcePath: "payments/support/refund-flow/refund-flow.tour.yaml",
                title: "Refund Flow"
              }
            ],
            displayName: "support/refund-flow",
            fullPath: "payments/support/refund-flow",
            id: "folder:payments/support/refund-flow",
            isActiveBranch: false,
            kind: "folder"
          }
        ],
        displayName: "payments",
        fullPath: "payments",
        id: "folder:payments",
        isActiveBranch: false,
        kind: "folder"
      }
    ]);
  });

  it("does not use long fuzzy queries to match unrelated tours", () => {
    const tree = buildBrowseTree(entries, null);

    expect(filterBrowseTree(tree, "release")).toEqual([
      {
        children: [
          {
            id: "tour:release-pipeline",
            isActive: false,
            kind: "tour",
            slug: "release-pipeline",
            sourcePath: "ops/release/release-pipeline/release-pipeline.tour.yaml",
            title: "Release Pipeline"
          }
        ],
        displayName: "ops/release/release-pipeline",
        fullPath: "ops/release/release-pipeline",
        id: "folder:ops/release/release-pipeline",
        isActiveBranch: false,
        kind: "folder"
      }
    ]);
  });

  it("flattens only expanded branches unless filtering forces the full matching branch open", () => {
    const tree = buildBrowseTree(entries, "refund-flow");
    const paymentsFolder = tree[1];

    expect(paymentsFolder.kind).toBe("folder");

    if (paymentsFolder.kind !== "folder") {
      throw new Error("Expected folder node");
    }

    expect(flattenBrowseTree(tree, ["folder:payments"], false)).toEqual([
      {
        depth: 0,
        node: tree[0]
      },
      {
        depth: 0,
        node: paymentsFolder
      },
      {
        depth: 1,
        node: paymentsFolder.children[0]
      },
      {
        depth: 1,
        node: paymentsFolder.children[1]
      }
    ]);
    expect(
      flattenBrowseTree(filterBrowseTree(tree, "refund"), [], true).map((row) => ({
        depth: row.depth,
        id: row.node.id
      }))
    ).toEqual([
      {
        depth: 0,
        id: "folder:payments"
      },
      {
        depth: 1,
        id: "folder:payments/support/refund-flow"
      },
      {
        depth: 2,
        id: "tour:refund-flow"
      }
    ]);
  });

  it("sorts folders before root-level tours when the source path has no parent directory", () => {
    const tree = buildBrowseTree(
      [
        ...entries,
        createEntry({
          slug: "overview",
          sourcePath: "overview.tour.yaml",
          title: "Overview",
          tour: {
            diagram: createDiagram("./overview.mmd"),
            sourceKind: "authored",
            steps: [],
            title: "Overview",
            version: 1
          }
        })
      ],
      null
    );

    expect(tree.map((node) => node.id)).toEqual([
      "folder:ops/release/release-pipeline",
      "folder:payments",
      "tour:overview"
    ]);
  });

  it("sorts root-level tours alphabetically when no folders are involved", () => {
    const tree = buildBrowseTree(
      [
        createEntry({
          slug: "zeta",
          sourcePath: "zeta.tour.yaml",
          title: "Zeta Tour",
          tour: {
            diagram: createDiagram("./zeta.mmd"),
            sourceKind: "authored",
            steps: [],
            title: "Zeta Tour",
            version: 1
          }
        }),
        createEntry({
          slug: "alpha",
          sourcePath: "alpha.tour.yaml",
          title: "Alpha Tour",
          tour: {
            diagram: createDiagram("./alpha.mmd"),
            sourceKind: "authored",
            steps: [],
            title: "Alpha Tour",
            version: 1
          }
        })
      ],
      null
    );

    expect(tree.map((node) => node.id)).toEqual(["tour:alpha", "tour:zeta"]);
  });

  it("still keeps folders ahead of tours when a root-level tour is inserted first", () => {
    const tree = buildBrowseTree(
      [
        createEntry({
          slug: "overview",
          sourcePath: "overview.tour.yaml",
          title: "Overview",
          tour: {
            diagram: createDiagram("./overview.mmd"),
            sourceKind: "authored",
            steps: [],
            title: "Overview",
            version: 1
          }
        }),
        ...entries
      ],
      null
    );

    expect(tree[0].kind).toBe("folder");
    expect(tree.at(-1)?.id).toBe("tour:overview");
  });
});

function createEntry(entry: ResolvedDiagramTourCollectionEntry): ResolvedDiagramTourCollectionEntry {
  return entry;
}

function createDiagram(path: string) {
  return {
    elements: [],
    path,
    source: "",
    type: "flowchart" as const
  };
}
