---
name: repo-validate
description: Run the correct validation set for diagram-tours changes and summarize the outcome clearly. Use when closing work, preparing a push or PR, or checking whether changes across CLI, parser, web-player, docs, or packaging are ready.
---

# Repo Validate

Validate only what the change needs, then report exactly what ran.

## Use this workflow

1. Inspect changed files first.
2. Always run:
   - `bun run lint`
   - `bun run typecheck`
   - `bun run test`
3. Also run `bun run smoke` when the change affects:
   - `packages/web-player`
   - `packages/cli`
   - routes, viewport, browse, theme, diagnostics, wizard, startup flow
   - docs that describe visible runtime behavior
4. Also run `bun run build` when the change affects:
   - published packages
   - startup/runtime packaging
   - release-facing paths
5. Prefer `bun run prepush` for cross-package or release-facing changes.

## Report format

- List every command run.
- Mark pass/fail for each command.
- Mention whether smoke and build were intentionally skipped and why.
- Call out coverage status when `bun run test` passes.
- If something fails, summarize the first actionable failure instead of pasting noisy logs.

## Repository-specific reminders

- CI runs lint, typecheck, test, Playwright install, smoke, and build.
- Coverage must stay at `100%`.
- A PR is not done until CI is green.
