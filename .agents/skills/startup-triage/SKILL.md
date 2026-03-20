---
name: startup-triage
description: Debug startup and runtime-loading issues in diagram-tours. Use when investigating CLI path handling, wizard vs direct startup differences, host or port behavior, source-target resolution, single-file preview, Markdown Mermaid loading, or startup smoke failures.
---

# Startup Triage

Trace the startup path from CLI input to loaded runtime entry.

## Follow this order

1. Identify the requested startup mode:
   - no-arg wizard
   - direct directory target
   - direct file target
   - Markdown-backed target
2. Inspect the relevant sources:
   - `packages/cli/src/lib/args.ts`
   - `packages/cli/src/lib/target.ts`
   - `packages/cli/src/lib/wizard.ts`
   - `packages/cli/src/lib/server.ts`
   - `packages/web-player/src/routes/+layout.server.ts`
   - `packages/web-player/src/lib/source-target.ts`
   - `docs/runtime-loading.md`
3. Compare the intended flow with:
   - `packages/web-player/smoke/startup-modes.spec.ts`
   - `packages/web-player/smoke/payment-flow.spec.ts`
4. Reproduce with the smallest command that shows the issue.
5. Check whether the problem is:
   - target validation
   - env handoff
   - parser loading
   - route selection
   - printed URL or browser-open behavior

## Good commands

- `bun run build`
- `bun run smoke`
- `node packages/cli/dist/bin/diagram-tours.js ./examples --host 127.0.0.1 --port 4173 --no-open`
- `bun run dev ./examples`
- `bun run dev:interactive`

## Output

- State the failing startup mode.
- Name the first broken boundary in the chain.
- Mention the smallest reproducer.
- List the smoke tests or docs that should change if behavior is intentional.
