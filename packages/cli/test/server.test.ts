import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const resolveWebPlayerEntryMock = vi.fn(() => "/runtime/server.js");

vi.mock("node:child_process", () => {
  return {
    spawn: spawnMock
  };
});

vi.mock("../src/lib/runtime-package.js", () => {
  return {
    resolveWebPlayerEntry: resolveWebPlayerEntryMock
  };
});

afterEach(() => {
  spawnMock.mockReset();
  resolveWebPlayerEntryMock.mockClear();
  vi.unstubAllGlobals();
});

describe("startWebServer", () => {
  it("starts the packaged web-player runtime and waits for readiness", async () => {
    spawnMock.mockReturnValue({} as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 307
      })
    );

    const { startWebServer } = await import("../src/lib/server.js");
    const result = await startWebServer({
      binding: { host: "127.0.0.1", port: 7733 },
      target: "C:/repo/examples"
    });

    expect(result.url).toBe("http://127.0.0.1:7733");
    expect(spawnMock).toHaveBeenCalledWith(process.execPath, ["/runtime/server.js"], {
      env: expect.objectContaining({
        DIAGRAM_TOUR_SOURCE_TARGET: "C:/repo/examples",
        HOST: "127.0.0.1",
        PORT: "7733"
      }),
      stdio: "inherit"
    });
  });

  it("retries after fetch failures", async () => {
    spawnMock.mockReturnValue({} as never);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({ status: 200 })
    );

    const { startWebServer } = await import("../src/lib/server.js");
    const result = await startWebServer({
      binding: { host: "127.0.0.1", port: 7734 },
      target: "C:/repo/examples"
    });

    expect(result.url).toBe("http://127.0.0.1:7734");
  });

  it("fails when the runtime never becomes ready", async () => {
    spawnMock.mockReturnValue({} as never);
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline"))
    );
    vi.setSystemTime(new Date("2026-03-18T00:00:00Z"));

    const { startWebServer } = await import("../src/lib/server.js");
    const startPromise = startWebServer({
      binding: { host: "127.0.0.1", port: 7735 },
      target: "C:/repo/examples"
    });
    const assertion = expect(startPromise).rejects.toThrow(
      "Timed out waiting for http://127.0.0.1:7735."
    );

    await vi.advanceTimersByTimeAsync(120_500);

    await assertion;
    vi.useRealTimers();
  });
});
