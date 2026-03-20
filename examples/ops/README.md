# Huge System Stress Test

This example is intentionally oversized and dense.

Use it to validate:

- viewport behavior on a very large diagram
- edge-label readability under heavy branching
- multi-focus and empty-focus behavior
- layout resilience during long step text
- deep linking on large Mermaid renders

## How to Open It

From the default examples shell:

```bash
bun run dev
```

Then open the `ops/huge-system` tour in the player.

For a focused author preview:

```bash
DIAGRAM_TOUR_SOURCE_TARGET=./examples/ops/huge-system.tour.yaml bun run dev
```

PowerShell:

```powershell
$env:DIAGRAM_TOUR_SOURCE_TARGET = "./examples/ops/huge-system.tour.yaml"
bun run dev
```

## What It Exercises

This fixture exists to cover scenarios that are easy to miss in smaller diagrams:

- very large SVG bounds
- dense edge and node layout
- grouped focus states
- neutral focus states
- route deep links into late steps

It is both a demo and a regression fixture for smoke coverage.
