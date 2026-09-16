import { resolve } from "node:path";

import nodeAdapter from "@sveltejs/adapter-node";
import staticAdapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: process.env.DIAGRAM_TOUR_STATIC_OUT
      ? staticAdapter({ pages: process.env.DIAGRAM_TOUR_STATIC_OUT, assets: process.env.DIAGRAM_TOUR_STATIC_OUT, precompress: false, strict: false })
      : nodeAdapter(),
    paths: process.env.DIAGRAM_TOUR_STATIC_OUT ? { relative: true } : {},
    output: { bundleStrategy: process.env.DIAGRAM_TOUR_STATIC_OUT ? "inline" : "split" },
    prerender: { entries: process.env.DIAGRAM_TOUR_STATIC_OUT ? ["*"] : [] },
    alias: {
      "@diagram-tour/core": resolve("../core/src/index.ts"),
      "@diagram-tour/parser": resolve("../parser/src/index.ts")
    }
  }
};

export default config;
