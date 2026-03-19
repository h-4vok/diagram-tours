import { createServer } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { resolveServerBinding } from "../src/lib/port-policy.js";

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

describe("resolveServerBinding", () => {
  it("uses port 7733 when it is available", async () => {
    await expect(resolveServerBinding({ host: "127.0.0.1", requestedPort: null })).resolves.toEqual({
      host: "127.0.0.1",
      port: 7733
    });
  });

  it("falls back to another free port when 7733 is unavailable", async () => {
    await occupyPort(7733);

    const result = await resolveServerBinding({ host: "127.0.0.1", requestedPort: null });

    expect(result.host).toBe("127.0.0.1");
    expect(result.port).not.toBe(7733);
    expect(result.port).toBeGreaterThan(0);
  });

  it("respects an explicit port override", async () => {
    await expect(resolveServerBinding({ host: "127.0.0.1", requestedPort: 9000 })).resolves.toEqual({
      host: "127.0.0.1",
      port: 9000
    });
  });

  it("fails clearly when an explicit port is unavailable", async () => {
    await occupyPort(9001);

    await expect(resolveServerBinding({ host: "127.0.0.1", requestedPort: 9001 })).rejects.toThrow(
      "Port 9001 is unavailable on host 127.0.0.1."
    );
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
