import { describe, expect, it } from "vitest";

import {
  MAX_RECENT_SLUGS,
  readStoredRecentSlugs,
  RECENT_STORAGE_KEY,
  rememberRecentSlug,
  writeStoredRecentSlugs
} from "../src/lib/browse-recents";
import { vi } from "vitest";

describe("browse-recents", () => {
  it("reads stored recent slugs and ignores malformed values", () => {
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(["payment-flow", "refund-flow", "payment-flow", 42, null])
    );

    expect(readStoredRecentSlugs(window.localStorage)).toEqual(["payment-flow", "refund-flow"]);

    window.localStorage.setItem(RECENT_STORAGE_KEY, "{broken");
    expect(readStoredRecentSlugs(window.localStorage)).toEqual([]);
  });

  it("returns an empty list when no recent state has been stored", () => {
    expect(readStoredRecentSlugs(window.localStorage)).toEqual([]);
  });

  it("reads recent slugs from a storage adapter when the payload is a valid array", () => {
    expect(readStoredRecentSlugs(createStorage('["payment-flow"]'))).toEqual(["payment-flow"]);
  });

  it("returns an empty list when the stored recent payload is not an array", () => {
    expect(readStoredRecentSlugs(createStorage('{"slug":"payment-flow"}'))).toEqual([]);
  });

  it("moves the newest slug to the front and caps the list", () => {
    expect(rememberRecentSlug(["refund-flow", "payment-flow"], "payment-flow")).toEqual([
      "payment-flow",
      "refund-flow"
    ]);

    expect(
      rememberRecentSlug(Array.from({ length: MAX_RECENT_SLUGS }, (_, index) => `tour-${index}`), "latest-tour")
    ).toEqual([
      "latest-tour",
      "tour-0",
      "tour-1",
      "tour-2",
      "tour-3",
      "tour-4",
      "tour-5",
      "tour-6"
    ]);
  });

  it("writes normalized recent slugs back to storage", () => {
    writeStoredRecentSlugs(window.localStorage, ["payment-flow", "refund-flow", "payment-flow"]);

    expect(window.localStorage.getItem(RECENT_STORAGE_KEY)).toBe('["payment-flow","refund-flow"]');
  });
});

function createStorage(initialValue: string | null): Storage {
  return {
    clear: vi.fn(),
    getItem: vi.fn(() => initialValue),
    key: vi.fn(),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn()
  };
}
