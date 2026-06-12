# Smoke Tests

The code lives in `packages/web-player/smoke/`.

Smoke files should stay narrow and diagnostic. Escalate to the full suite only when one file is not enough to explain runtime risk.

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
