import { createServer, type AddressInfo } from "node:net";

import type { ServerBinding } from "./types.js";

export async function resolveServerBinding(options: {
  host: string;
  requestedPort: number | null;
}): Promise<ServerBinding> {
  if (options.requestedPort !== null) {
    return readExplicitBinding(options.host, options.requestedPort);
  }

  return readAutomaticBinding(options.host);
}

async function readExplicitBinding(host: string, port: number): Promise<ServerBinding> {
  if (!(await isPortAvailable(host, port))) {
    throw new Error(`Port ${port} is unavailable on host ${host}.`);
  }

  return { host, port };
}

async function readAutomaticBinding(host: string): Promise<ServerBinding> {
  if (await isPortAvailable(host, 7733)) {
    return { host, port: 7733 };
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
