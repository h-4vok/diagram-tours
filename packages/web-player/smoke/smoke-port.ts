import { createHash } from "node:crypto";
import { createServer, type AddressInfo } from "node:net";

const SMOKE_PORT_BASE = 4173;
const SMOKE_PORT_RANGE = 1000;
const SMOKE_HOST = "127.0.0.1";

export interface SmokePortSeed {
  worktreePath?: string;
  probeLimit?: number;
}

export function readPreferredSmokePort(options: SmokePortSeed = {}): number {
  const seed = createHash("sha256").update(readWorktreePath(options)).digest().readUInt32BE(0);

  return SMOKE_PORT_BASE + (seed % SMOKE_PORT_RANGE);
}

export async function resolveSmokeServerPort(options: SmokePortSeed = {}): Promise<number> {
  return await findAvailableSmokePort(readPreferredSmokePort(options), readProbeLimit(options));
}

function readWorktreePath(options: SmokePortSeed): string {
  return options.worktreePath ?? process.cwd();
}

function readProbeLimit(options: SmokePortSeed): number {
  return options.probeLimit ?? 32;
}

async function findAvailableSmokePort(preferredPort: number, probeLimit: number): Promise<number> {
  for (let attempt = 0; attempt < probeLimit; attempt += 1) {
    const port = SMOKE_PORT_BASE + ((preferredPort - SMOKE_PORT_BASE + attempt) % SMOKE_PORT_RANGE);

    if (await isPortAvailable(port)) {
      return port;
    }
  }

  return await readEphemeralPort();
}

async function readEphemeralPort(): Promise<number> {
  const server = createServer();

  return await new Promise<number>((resolvePort, rejectPort) => {
    server.once("error", rejectPort);
    server.listen(0, SMOKE_HOST, () => {
      const port = (server.address() as AddressInfo).port;

      server.close(() => {
        resolvePort(port);
      });
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  const server = createServer();

  return await new Promise<boolean>((resolveAvailability) => {
    server.once("error", () => {
      resolveAvailability(false);
    });
    server.listen(port, SMOKE_HOST, () => {
      server.close(() => {
        resolveAvailability(true);
      });
    });
  });
}
