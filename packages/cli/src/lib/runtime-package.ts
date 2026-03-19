import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function resolveWebPlayerEntry(): string {
  return require.resolve("@diagram-tour/web-player");
}
