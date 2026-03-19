import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => {
  return {
    spawn: spawnMock
  };
});

afterEach(() => {
  spawnMock.mockReset();
});

describe("defaultBrowserOpener", () => {
  it("spawns a detached browser command", async () => {
    await expectSpawnForPlatform(process.platform, process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open");
  });

  it("uses the Windows command shape", async () => {
    await expectSpawnForPlatform("win32", "cmd");
  });

  it("uses the macOS command shape", async () => {
    await expectSpawnForPlatform("darwin", "open");
  });

  it("uses the Linux command shape", async () => {
    await expectSpawnForPlatform("linux", "xdg-open");
  });
});

async function expectSpawnForPlatform(platform: NodeJS.Platform, command: string) {
  const originalPlatform = process.platform;
  const child = createChild();

  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform
  });
  spawnMock.mockReturnValue(child);

  vi.resetModules();

    const { defaultBrowserOpener } = await import("../src/lib/browser.js");

  await defaultBrowserOpener.open("http://127.0.0.1:7733");

  expect(spawnMock).toHaveBeenCalledOnce();
  expect(spawnMock.mock.calls[0]?.[0]).toBe(command);
  expect(spawnMock.mock.calls[0]?.[2]).toEqual({
    detached: true,
    stdio: "ignore"
  });
  expect(child.unref).toHaveBeenCalledOnce();

  Object.defineProperty(process, "platform", {
    configurable: true,
    value: originalPlatform
  });
}

function createChild() {
  const child = {
    once: vi.fn((event: string, listener: () => void) => {
      if (event === "spawn") {
        listener();
      }

      return child;
    }),
    unref: vi.fn()
  };

  return child;
}
