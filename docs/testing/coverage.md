# Coverage Dashboard

`diagram-tours` keeps unit and component tests owned by each package, but now exposes one root coverage dashboard for day-to-day review.

## Canonical Command

Run:

```bash
bun run coverage
```

This runs the existing unit/component suites, preserves each package's `100%` coverage guardrail, and then builds the unified dashboard.

`bun run test` remains the enforcement command used by CI and local validation. It also refreshes the dashboard and prints the canonical path after a successful run.

## Canonical Dashboard

Open:

```text
coverage/index.html
```

That page shows:

- overall repo totals
- separate sections for `core`, `parser`, `web-player`, `cli`, and `scripts`
- links to each package or script detail report

## Detail Reports

The root dashboard links into detail HTML reports stored under:

```text
coverage/packages/
```

Examples:

- `coverage/packages/core/index.html`
- `coverage/packages/web-player/index.html`
- `coverage/packages/scripts/index.html`

Use the root page first, then drill into the package report when you need file-level detail.
