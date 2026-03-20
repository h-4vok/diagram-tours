---
name: smoke-investigation
description: Investigate Playwright smoke failures and runtime-visible regressions in diagram-tours. Use when `bun run smoke` fails or when debugging viewport, browse, minimap, theme, startup modes, deep links, or other browser-visible flows.
---

# Smoke Investigation

Treat smoke failures as product regressions first, selector failures second.

## Investigation loop

1. Run `bun run smoke`.
2. Identify the failing spec and test name.
3. Read the intent in:
   - `docs/testing/smoke-tests.md`
   - the matching Playwright spec
4. Reproduce the smallest failing case.
5. Decide whether the regression is in:
   - startup mode
   - route or deep-link state
   - diagram rendering
   - viewport behavior
   - browse or diagnostics UI
   - theme or persistence
6. Check whether the failure means:
   - a product bug
   - an intentional behavior change that needs spec and docs updates
   - a brittle assertion that should be rewritten around a visible signal

## Helpful files

- `packages/web-player/playwright.config.ts`
- `packages/web-player/smoke/payment-flow.spec.ts`
- `packages/web-player/smoke/startup-modes.spec.ts`
- `docs/testing/smoke-tests.md`

## Output

- failing visible behavior
- smallest reproducer
- likely broken subsystem
- whether docs or smoke intent need updating
