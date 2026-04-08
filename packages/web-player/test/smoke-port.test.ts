import { createServer } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { readPreferredSmokePort, resolveSmokeServerPort } from "../smoke/smoke-port.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolveClose) => {
          server.close(() => {
            resolveClose();
          });
        })
    )
  );
  servers.length = 0;
});

describe("readPreferredSmokePort", () => {
  it("returns a stable port for the same worktree", () => {
    const options = { worktreePath: "C:/worktrees/one" };

    expect(readPreferredSmokePort(options)).toBe(readPreferredSmokePort(options));
  });

  it("varies across different worktrees", () => {
    const worktreePath = "C:/worktrees/one";

    expect(readPreferredSmokePort({ worktreePath })).not.toBe(
      readPreferredSmokePort({ worktreePath: "C:/worktrees/two" })
    );
  });
});

describe("resolveSmokeServerPort", () => {
  it("falls back to another free port when the preferred one is busy", async () => {
    const preferredPort = readPreferredSmokePort({ worktreePath: "C:/worktrees/two" });

    await occupyPort(preferredPort);

    await expect(
      resolveSmokeServerPort({ worktreePath: "C:/worktrees/two", probeLimit: 1 })
    ).resolves.not.toBe(preferredPort);
  });
});

async function occupyPort(port: number) {
  const server = createServer();

  await new Promise<void>((resolveListen) => {
    server.listen(port, "127.0.0.1", () => {
      resolveListen();
    });
  });

  servers.push(server);
}
