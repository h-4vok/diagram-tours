import type { ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";
import { describe, expect, it } from "vitest";

import {
  buildBrowsePaletteSections,
  flattenBrowsePaletteSections,
  moveBrowsePaletteSlug,
  readInitialBrowsePaletteSlug
} from "../src/lib/browse-palette";

const entries = [
  createEntry({
    slug: "checkout-payment-flow",
    sourcePath: "examples/checkout-payment-flow.tour.yaml",
    stepCount: 4,
    title: "Payment Flow",
    type: "flowchart"
  }),
  createEntry({
    slug: "payments-platform-overview",
    sourcePath: "examples/payments-platform-overview.tour.yaml",
    stepCount: 6,
    title: "Payments Platform Overview",
    type: "flowchart"
  }),
  createEntry({
    slug: "sequence-order-sequence",
    sourcePath: "examples/sequence-order-sequence.tour.yaml",
    stepCount: 3,
    title: "Order Sequence",
    type: "sequence"
  })
] satisfies ResolvedDiagramTourCollectionEntry[];

describe("browse-palette", () => {
  it("builds favorites, recent, and all sections without duplicates", () => {
    const sections = buildBrowsePaletteSections({
      entries,
      favoriteSlugs: ["payments-platform-overview"],
      query: "",
      recentSlugs: ["payments-platform-overview", "checkout-payment-flow"]
    });

    expect(sections).toEqual([
      {
        id: "favorites",
        items: [
          {
            diagramType: "flowchart",
            slug: "payments-platform-overview",
            sourcePath: "examples/payments-platform-overview.tour.yaml",
            stepCount: 6,
            title: "Payments Platform Overview"
          }
        ],
        title: "Favorites"
      },
      {
        id: "recent",
        items: [
          {
            diagramType: "flowchart",
            slug: "checkout-payment-flow",
            sourcePath: "examples/checkout-payment-flow.tour.yaml",
            stepCount: 4,
            title: "Payment Flow"
          }
        ],
        title: "Recent"
      },
      {
        id: "all",
        items: [
          {
            diagramType: "sequence",
            slug: "sequence-order-sequence",
            sourcePath: "examples/sequence-order-sequence.tour.yaml",
            stepCount: 3,
            title: "Order Sequence"
          }
        ],
        title: "All Diagrams"
      }
    ]);
  });

  it("filters by substring and short fuzzy queries, but keeps long queries strict", () => {
    expect(
      buildBrowsePaletteSections({
        entries,
        favoriteSlugs: [],
        query: "platform",
        recentSlugs: []
      })
    ).toEqual([
      {
        id: "all",
        items: [
          {
            diagramType: "flowchart",
            slug: "payments-platform-overview",
            sourcePath: "examples/payments-platform-overview.tour.yaml",
            stepCount: 6,
            title: "Payments Platform Overview"
          }
        ],
        title: "All Diagrams"
      }
    ]);

    expect(
      buildBrowsePaletteSections({
        entries,
        favoriteSlugs: [],
        query: "pltf",
        recentSlugs: []
      })[0]?.items.map((item) => item.slug)
    ).toEqual(["payments-platform-overview"]);

    expect(
      buildBrowsePaletteSections({
        entries,
        favoriteSlugs: [],
        query: "release",
        recentSlugs: []
      })
    ).toEqual([]);
  });

  it("flattens sections and computes the initial active slug", () => {
    const items = flattenBrowsePaletteSections(
      buildBrowsePaletteSections({
        entries,
        favoriteSlugs: ["payments-platform-overview"],
        query: "",
        recentSlugs: ["checkout-payment-flow"]
      })
    );

    expect(items.map((item) => item.slug)).toEqual([
      "payments-platform-overview",
      "checkout-payment-flow",
      "sequence-order-sequence"
    ]);
    expect(
      readInitialBrowsePaletteSlug({
        activeSlug: "checkout-payment-flow",
        currentSlug: "sequence-order-sequence",
        items
      })
    ).toBe("checkout-payment-flow");
    expect(
      readInitialBrowsePaletteSlug({
        activeSlug: "missing",
        currentSlug: "sequence-order-sequence",
        items
      })
    ).toBe("sequence-order-sequence");
    expect(
      readInitialBrowsePaletteSlug({
        activeSlug: null,
        currentSlug: null,
        items
      })
    ).toBe("payments-platform-overview");
    expect(
      readInitialBrowsePaletteSlug({
        activeSlug: null,
        currentSlug: null,
        items: []
      })
    ).toBeNull();
  });

  it("moves the active slug through the flattened results and clamps at the ends", () => {
    const items = flattenBrowsePaletteSections(
      buildBrowsePaletteSections({
        entries,
        favoriteSlugs: [],
        query: "",
        recentSlugs: []
      })
    );

    expect(moveBrowsePaletteSlug({ activeSlug: null, direction: 1, items })).toBe(
      "checkout-payment-flow"
    );
    expect(
      moveBrowsePaletteSlug({
        activeSlug: "sequence-order-sequence",
        direction: 1,
        items
      })
    ).toBe("checkout-payment-flow");
    expect(
      moveBrowsePaletteSlug({
        activeSlug: "sequence-order-sequence",
        direction: -1,
        items
      })
    ).toBe("sequence-order-sequence");
    expect(
      moveBrowsePaletteSlug({
        activeSlug: "payments-platform-overview",
        direction: 1,
        items
      })
    ).toBe("payments-platform-overview");
    expect(moveBrowsePaletteSlug({ activeSlug: null, direction: -1, items: [] })).toBeNull();
  });
});

function createEntry(input: {
  slug: string;
  sourcePath: string;
  stepCount: number;
  title: string;
  type: "flowchart" | "sequence";
}): ResolvedDiagramTourCollectionEntry {
  return {
    slug: input.slug,
    sourcePath: input.sourcePath,
    title: input.title,
    tour: {
      diagram: {
        elements: [],
        path: `./${input.slug}.mmd`,
        source: "",
        type: input.type
      },
      sourceKind: "authored",
      steps: Array.from({ length: input.stepCount }, (_, index) => ({
        focus: [],
        index: index + 1,
        text: `Step ${index + 1}`
      })),
      title: input.title,
      version: 1
    }
  };
}

