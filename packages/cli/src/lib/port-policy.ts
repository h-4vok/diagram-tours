import { createServer, type AddressInfo } from "node:net";

import type { ServerBinding } from "./types.js";

const DEFAULT_AUTOMATIC_PORT = 7733;

export async function resolveServerBinding(options: {
  host: string;
  preferredPort?: number;
  requestedPort: number | null;
}): Promise<ServerBinding> {
  const { host, preferredPort = DEFAULT_AUTOMATIC_PORT, requestedPort } = options;

  if (requestedPort !== null) {
    return readExplicitBinding(host, requestedPort);
  }

  return readAutomaticBinding(host, preferredPort);
}

async function readExplicitBinding(host: string, port: number): Promise<ServerBinding> {
  if (!(await isPortAvailable(host, port))) {
    throw new Error(`Port ${port} is unavailable on host ${host}.`);
  }

  return { host, port };
}

async function readAutomaticBinding(host: string, preferredPort: number): Promise<ServerBinding> {
  if (await isPortAvailable(host, preferredPort)) {
    return { host, port: preferredPort };
  }

  return {
    host,
    port: await readEphemeralPort(host)
  };
}

async function readEphemeralPort(host: string): Promise<number> {
  const server = createServer();

  return new Promise<number>((resolvePort, rejectPort) => {
    server.once("error", rejectPort);
    server.listen(0, host, () => {
      const port = (server.address() as AddressInfo).port;

      server.close(() => {
        resolvePort(port);
      });
    });
  });
}

async function isPortAvailable(host: string, port: number): Promise<boolean> {
  const server = createServer();

  return new Promise<boolean>((resolveAvailability) => {
    server.once("error", () => {
      resolveAvailability(false);
    });
    server.listen(port, host, () => {
      server.close(() => {
        resolveAvailability(true);
      });
    });
  });
}
