import { resolve } from "node:path";

import adapter from "@sveltejs/adapter-auto";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      "@diagram-tour/core": resolve("../core/src/index.ts"),
      "@diagram-tour/parser": resolve("../parser/src/index.ts")
    }
  }
};

export default config;
