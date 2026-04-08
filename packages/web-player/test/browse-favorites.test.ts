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
        favoriteSlugs: ["payments-platform-overview", "payment-flow"],
        query: "platform"
      })
    ).toEqual([
      {
        slug: "payments-platform-overview",
        title: "Payments Platform Overview"
      }
    ]);
  });

  it("returns all matching favorites when the query is empty", () => {
    expect(
      buildFavoriteBrowseEntries({
        entries: nestedTourCollection.entries,
        favoriteSlugs: ["payments-platform-overview", "payment-flow"],
        query: ""
      })
    ).toEqual([
      {
        slug: "payment-flow",
        title: "Payment Flow"
      },
      {
        slug: "payments-platform-overview",
        title: "Payments Platform Overview"
      }
    ]);
  });

  it("reads, writes, and toggles favorite slugs safely", () => {
    const storage = createStorage();

    expect(readStoredFavoriteSlugs(storage)).toEqual([]);

    writeStoredFavoriteSlugs(storage, ["payments-platform-overview", "payment-flow"]);

    expect(storage.setItem).toHaveBeenCalledWith(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(["payment-flow", "payments-platform-overview"])
    );
    expect(toggleFavoriteSlug(["payment-flow"], "payments-platform-overview")).toEqual([
      "payment-flow",
      "payments-platform-overview"
    ]);
    expect(toggleFavoriteSlug(["payment-flow"], "payment-flow")).toEqual([]);
  });

  it("falls back to an empty list when storage is invalid", () => {
    const storage = createStorage("{bad json");

    expect(readStoredFavoriteSlugs(storage)).toEqual([]);
  });

  it("ignores non-array favorite payloads in storage", () => {
    const storage = createStorage('{"slug":"payments-platform-overview"}');

    expect(readStoredFavoriteSlugs(storage)).toEqual([]);
  });

  it("keeps only string favorite slugs from stored arrays", () => {
    const storage = createStorage('["payments-platform-overview", 42, null, "payment-flow"]');

    expect(readStoredFavoriteSlugs(storage)).toEqual(["payments-platform-overview", "payment-flow"]);
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
