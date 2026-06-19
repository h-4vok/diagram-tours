# Examples

The public example library is intentionally minimal and canonical.

Visible public set:

- `flowchart/checkout-payment-flow.*` for a small authored flowchart
- `flowchart/flowchart-addressability.*` for a flowchart example with common shapes, bare endpoints, and a tooltip annotation
- `flowchart/payments-platform-overview.*` for a large authored interactive demo
- `sequence/sequence-order-sequence.*` for a small authored sequence diagram
- `sankey/sankey-ops-review.*` for an authored Sankey that follows a candidate interview pipeline through offers

Every public example keeps a matching `.mmd` and `.tour.yaml` pair.

Focused preview:

```bash
DIAGRAM_TOUR_SOURCE_TARGET=./examples/flowchart/payments-platform-overview.tour.yaml bun run dev
```

PowerShell:

```powershell
$env:DIAGRAM_TOUR_SOURCE_TARGET = "./examples/flowchart/payments-platform-overview.tour.yaml"
bun run dev
```
