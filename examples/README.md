# Examples

The public example library is intentionally minimal and canonical.

Visible public set:

- `checkout-payment-flow.*` for a small authored flowchart
- `sequence-order-sequence.*` for a small authored sequence diagram
- `payments-platform-overview.*` for a large authored interactive demo

Every public example keeps a matching `.mmd` and `.tour.yaml` pair.

Focused preview:

```bash
DIAGRAM_TOUR_SOURCE_TARGET=./examples/payments-platform-overview.tour.yaml bun run dev
```

PowerShell:

```powershell
$env:DIAGRAM_TOUR_SOURCE_TARGET = "./examples/payments-platform-overview.tour.yaml"
bun run dev
```
