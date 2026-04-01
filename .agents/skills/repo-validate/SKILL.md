---
name: repo-validate
description: Run broader repo validation and summarize the outcome clearly for operator-run checks, pushes, PRs, or release readiness.
---

# Repo Validate

Use this skill when you need broad validation of the repository, not the normal closeout path for a single change.

## Use this workflow

1. Inspect the relevant files or change set first.
2. Run the broad checks that match the scope:
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
6. Prefer `bun run allchecks:ai` when the operator wants the full validation pass with normal logs.

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
