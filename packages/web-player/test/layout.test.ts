import { afterEach, describe, expect, it, vi } from "vitest";

import { load } from "../src/routes/+layout";

const payload = {
  version: 1 as const,
  collection: { entries: [], skipped: [] }
};

type LayoutResult = { collection: typeof payload.collection };

afterEach(() => {
  delete (globalThis as typeof globalThis & { __DIAGRAM_TOUR_DATA__?: unknown }).__DIAGRAM_TOUR_DATA__;
  vi.unstubAllEnvs();
});

describe("universal static layout", () => {
  it("loads the embedded static payload without fetching", async () => {
    (globalThis as typeof globalThis & { __DIAGRAM_TOUR_DATA__?: unknown }).__DIAGRAM_TOUR_DATA__ = payload;
    const fetch = vi.fn();

    const result = await load({ fetch, data: undefined } as never) as LayoutResult;

    expect(result.collection).toEqual(payload.collection);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads the static payload file when no embedded payload exists", async () => {
    vi.stubEnv("PUBLIC_DIAGRAM_TOUR_STATIC", "true");
    const fetch = vi.fn().mockResolvedValue({ json: async () => payload });

    const result = await load({ fetch, data: undefined } as never) as LayoutResult;

    expect(result.collection).toEqual(payload.collection);
    expect(fetch).toHaveBeenCalledWith("tours-data.json");
  });

  it("keeps live layout data when static mode is disabled", async () => {
    const data = { collection: payload.collection, sourceTarget: { kind: "directory", label: "live", path: "." } };

    await expect(load({ fetch: vi.fn(), data } as never)).resolves.toBe(data);
  });
});
