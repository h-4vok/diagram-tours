import { describe, expect, it, vi } from "vitest";

import {
  buildFavoriteBrowseEntries,
  FAVORITES_STORAGE_KEY,
  readStoredFavoriteSlugs,
  toggleFavoriteSlug,
  writeStoredFavoriteSlugs
} from "../src/lib/browse-favorites";
import { nestedTourCollection } from "./fixtures/tour-collection";

describe("browse-favorites", () => {
  it("builds favorite entries in title order and filters by search query", () => {
    expect(
      buildFavoriteBrowseEntries({
        entries: nestedTourCollection.entries,
        favoriteSlugs: ["refund-flow", "payment-flow"],
        query: "refund"
      })
    ).toEqual([
      {
        slug: "refund-flow",
        title: "Refund Flow"
      }
    ]);
  });

  it("reads, writes, and toggles favorite slugs safely", () => {
    const storage = createStorage();

    expect(readStoredFavoriteSlugs(storage)).toEqual([]);

    writeStoredFavoriteSlugs(storage, ["refund-flow", "payment-flow"]);

    expect(storage.setItem).toHaveBeenCalledWith(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(["payment-flow", "refund-flow"])
    );
    expect(toggleFavoriteSlug(["payment-flow"], "refund-flow")).toEqual([
      "payment-flow",
      "refund-flow"
    ]);
    expect(toggleFavoriteSlug(["payment-flow"], "payment-flow")).toEqual([]);
  });

  it("falls back to an empty list when storage is invalid", () => {
    const storage = createStorage("{bad json");

    expect(readStoredFavoriteSlugs(storage)).toEqual([]);
  });

  it("ignores non-array favorite payloads in storage", () => {
    const storage = createStorage('{"slug":"refund-flow"}');

    expect(readStoredFavoriteSlugs(storage)).toEqual([]);
  });

  it("keeps only string favorite slugs from stored arrays", () => {
    const storage = createStorage('["refund-flow", 42, null, "payment-flow"]');

    expect(readStoredFavoriteSlugs(storage)).toEqual(["refund-flow", "payment-flow"]);
  });
});

function createStorage(initialValue: string | null = null): Storage {
  return {
    clear: vi.fn(),
    getItem: vi.fn(() => initialValue),
    key: vi.fn(),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn()
  };
}
