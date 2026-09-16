import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn();
const mkdirMock = vi.fn();
const mkdtempMock = vi.fn();
const rmMock = vi.fn();
const writeFileMock = vi.fn();
const readFileMock = vi.fn();
const copyFileMock = vi.fn();
const renameMock = vi.fn();
const cpMock = vi.fn();
const spawnMock = vi.fn();
const loadCollectionMock = vi.fn();
const validateTargetMock = vi.fn();

vi.mock("node:fs", () => ({ existsSync: existsSyncMock }));
vi.mock("node:fs/promises", () => ({ cp: cpMock, mkdir: mkdirMock, mkdtemp: mkdtempMock, rm: rmMock, writeFile: writeFileMock, readFile: readFileMock, copyFile: copyFileMock, rename: renameMock }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));
vi.mock("@diagram-tour/parser", () => ({ loadResolvedTourCollection: loadCollectionMock }));
vi.mock("../src/lib/target.js", () => ({ validateTargetPath: validateTargetMock }));

describe("runBuildCommand", () => {
  beforeEach(() => {
    existsSyncMock.mockImplementation((path: string) => !path.endsWith("site"));
    mkdirMock.mockResolvedValue(undefined);
    mkdtempMock.mockResolvedValue("C:/temp/diagram-tours-static");
    rmMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue('<script src="/_app/app.js"></script>');
    copyFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue(undefined);
    cpMock.mockResolvedValue(undefined);
    validateTargetMock.mockReturnValue("C:/repo/examples");
    loadCollectionMock.mockResolvedValue({ entries: [{ slug: "flow" }], skipped: [] });
    spawnMock.mockImplementation(() => {
      const child = { once: vi.fn((event: string, callback: (code?: number) => void) => {
        if (event === "exit") { callback(0); }
      }) };
      return child;
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("builds output, writes payload, and opens index when requested", async () => {
    const opener = { open: vi.fn() };
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "always", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "examples" }, opener)).resolves.toBe(0);
    expect(validateTargetMock).toHaveBeenCalledWith("examples");
    expect(loadCollectionMock).toHaveBeenCalledWith("C:/repo/examples", { allowEmpty: false });
    expect(renameMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(copyFileMock).toHaveBeenCalled();
    expect(opener.open).toHaveBeenCalledWith(expect.stringContaining("index.html"));
  });

  it("refuses existing output without overwrite", async () => {
    existsSyncMock.mockReturnValue(true);
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: false, logLevel: "normal", out: "site", overwrite: false, target: "." }, { open: vi.fn() }))
      .rejects.toThrow("already exists");
    expect(loadCollectionMock).not.toHaveBeenCalled();
  });

  it("reports failed player build", async () => {
    spawnMock.mockImplementation(() => ({
      once: vi.fn((event: string, callback: (code?: number) => void) => {
        if (event === "exit") { callback(2); }
      })
    }));
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "." }, { open: vi.fn() }))
      .rejects.toThrow("Static player build failed");
  });

  it("restores the previous output when publishing fails", async () => {
    existsSyncMock.mockImplementation((path: string) => path.endsWith("site") || path.endsWith("svelte.config.js"));
    renameMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("publish failed"));
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "." }, { open: vi.fn() }))
      .rejects.toThrow("publish failed");
    expect(renameMock).toHaveBeenCalledTimes(3);
  });

  it("replaces an existing output after a successful build", async () => {
    existsSyncMock.mockImplementation((path: string) => path.endsWith("site") || path.endsWith("svelte.config.js"));
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "." }, { open: vi.fn() }))
      .resolves.toBe(0);
    expect(renameMock).toHaveBeenCalledTimes(2);
  });

  it("fails on skipped tours unless continuation is explicit", async () => {
    loadCollectionMock.mockResolvedValue({ entries: [{ slug: "flow" }], skipped: [{ sourcePath: "bad.tour.yaml", diagnostics: [] }] });
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "." }, { open: vi.fn() }))
      .rejects.toThrow("Use --continue");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("supports quiet and verbose skipped-tour reporting", async () => {
    loadCollectionMock.mockResolvedValue({ entries: [{ slug: "flow" }], skipped: [{ sourcePath: "bad.tour.yaml", diagnostics: [{ message: "broken" }] }] });
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: true, logLevel: "quiet", out: "site", overwrite: true, target: "." }, { open: vi.fn() })).resolves.toBe(0);
    expect(stderrWrite).not.toHaveBeenCalled();
    await expect(runBuildCommand({ browser: "never", continueOnError: true, logLevel: "verbose", out: "site", overwrite: true, target: "." }, { open: vi.fn() })).resolves.toBe(0);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("bad.tour.yaml: broken"));
    stderrWrite.mockRestore();
  });

  it("preserves skipped tours as diagnostics", async () => {
    loadCollectionMock.mockResolvedValue({ entries: [], skipped: [{ sourcePath: "bad.tour.yaml" }] });
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: true, logLevel: "normal", out: "site", overwrite: true, target: "." }, { open: vi.fn() }))
      .resolves.toBe(0);
    expect(mkdtempMock).toHaveBeenCalled();
  });

  it("uses packaged static template outside a workspace", async () => {
    existsSyncMock.mockImplementation((path: string) => !path.includes("svelte.config.js") && !path.endsWith("site"));
    const { runBuildCommand } = await import("../src/lib/build.js");

    await expect(runBuildCommand({ browser: "never", continueOnError: false, logLevel: "normal", out: "site", overwrite: true, target: "." }, { open: vi.fn() }))
      .resolves.toBe(0);
    expect(cpMock).toHaveBeenCalled();
  });
});
