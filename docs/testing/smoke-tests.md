# Smoke Tests

This is the short map for the browser smoke suite.

The code lives in `packages/web-player/smoke/`.

## Commands

- `bun run smoke`: build the packaged runtime and run the full browser suite
- `bun run prepush`: run lint, typecheck, unit coverage, and `bun run smoke`

## Rules

- one smoke suite
- one test per file
- file names use `<category>.<title>.spec.ts`
- keep the category stable and specific
- keep the title short and exact
- run only the relevant smoke file for the current task
- use the full suite when you need broad confidence

## Naming Examples

- `payment-flow.deep-linked-step-reuses-svg.spec.ts`
- `startup-modes.explicit-diagram-fallback.spec.ts`
- `payment-flow.zoom-controls.spec.ts`

## Agent Rule

- prefer the shortest clear command
- do not run the whole suite when one file is enough
