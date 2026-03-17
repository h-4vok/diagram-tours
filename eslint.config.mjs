import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import tseslint from "typescript-eslint";

import svelteConfig from "./packages/web-player/svelte.config.js";

const sharedRules = {
  complexity: ["error", 3],
  "max-depth": ["error", 3],
  "max-params": ["error", 3],
  curly: ["error", "all"],
  eqeqeq: ["error", "always"],
  "no-console": ["warn", { allow: ["warn", "error"] }],
  "no-var": "error",
  "object-shorthand": ["error", "always"],
  "prefer-const": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports"
    }
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_"
    }
  ],
};

const typedGuardrailRules = {
  "max-lines-per-function": ["error", 30],
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-unnecessary-condition": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error"
};

export default defineConfig([
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/.svelte-kit/**",
      "**/build/**",
      "**/node_modules/**",
      "bun.lock"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      ...sharedRules
    }
  },
  {
    files: ["packages/web-player/src/**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
        projectService: true,
        svelteConfig,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser
      }
    },
    rules: {
      ...sharedRules
    }
  },
  {
    files: [
      "packages/*/src/**/*.ts",
      "packages/web-player/src/**/*.svelte",
      "scripts/**/*.ts"
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      ...typedGuardrailRules
    }
  }
]);
