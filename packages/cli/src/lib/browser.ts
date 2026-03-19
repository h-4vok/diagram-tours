import { spawn } from "node:child_process";

export interface BrowserOpener {
  open: (url: string) => Promise<void>;
}

export const defaultBrowserOpener: BrowserOpener = {
  open(url) {
    const [command, args] = readBrowserCommand(url);

    return new Promise<void>((resolveOpen, rejectOpen) => {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore"
      });

      child.once("error", rejectOpen);
      child.once("spawn", () => {
        child.unref();
        resolveOpen();
      });
    });
  }
};

function readBrowserCommand(url: string): [string, string[]] {
  if (process.platform === "win32") {
    return ["cmd", ["/c", "start", "", url]];
  }

  if (process.platform === "darwin") {
    return ["open", [url]];
  }

  return ["xdg-open", [url]];
}
