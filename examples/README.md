# Examples

Shipped tours and diagrams live directly under `examples/`.

Naming:

- domain-prefixed flat stems
- matching `.mmd` and `.tour.yaml` pairs share the same stem
- direct preview paths stay short: `./examples/checkout-payment-flow.tour.yaml`

Stress fixture:

- `ops-huge-system.*` remains the oversized regression example for viewport, focus, deep-link, and long-text behavior

Focused preview:

```bash
DIAGRAM_TOUR_SOURCE_TARGET=./examples/ops-huge-system.tour.yaml bun run dev
```

PowerShell:

```powershell
$env:DIAGRAM_TOUR_SOURCE_TARGET = "./examples/ops-huge-system.tour.yaml"
bun run dev
```
