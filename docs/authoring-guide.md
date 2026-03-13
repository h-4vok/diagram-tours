# Authoring Guide

This guide describes the current best practices for writing Diagram Tour examples and product tours.

## Start with Stable Mermaid IDs

Every node that may appear in `focus` or `{{references}}` needs an explicit Mermaid ID.

Use readable, stable IDs:

```mermaid
api_gateway[API Gateway]
validation_service[Validation Service]
```

Prefer:

- lowercase snake_case
- IDs that survive label rewrites
- IDs that describe the role, not the current copy

Avoid:

- generated-looking IDs
- IDs that depend on presentation wording
- renaming IDs just because the label changed

## Keep Tour Text Label-Friendly

Step text can interpolate Mermaid labels with `{{node_id}}`.

Example:

```yaml
text: >
  The {{api_gateway}} forwards valid requests to {{validation_service}}.
```

That keeps the authored copy tied to the diagram label without repeating display names manually.

## Use Focus Intentionally

`focus` is semantic, not a low-level camera instruction.

Use a single focus target when one node should carry the explanation:

```yaml
focus:
  - api_gateway
```

Use multiple focus targets when the relationship between nodes matters more than either node alone:

```yaml
focus:
  - payment_service
  - payment_provider
```

Use `focus: []` when the step should reset attention, summarize, or let the reader absorb the full diagram:

```yaml
focus: []
```

## Write Linear, Readable Steps

Version 1 tours are linear. A good step usually does one of these things:

- introduce one component
- explain one handoff
- summarize one phase
- reset context before the next section

If a step tries to explain too much, split it.

## Organize Tour Files

The current convention is one directory per example:

```text
examples/payment-flow/
  payment-flow.mmd
  payment-flow.tour.yaml
```

That layout produces a clean slug and keeps related files together.

## Validate Common Failure Cases

The parser rejects:

- missing required root fields
- empty `steps`
- non-array `focus`
- empty or invalid node IDs in `focus`
- unknown node references in `focus`
- unknown node references in `text`

Error messages include the source path and step number when possible, so keep steps small enough for that context to stay useful.

## Authoring Workflow

A practical local loop is:

1. point `DIAGRAM_TOUR_SOURCE_TARGET` at a single tour file
2. run `bun run dev`
3. iterate on Mermaid and YAML together
4. run `bun run test`
5. run `bun run smoke` if viewport or interaction behavior changed

PowerShell example:

```powershell
$env:DIAGRAM_TOUR_SOURCE_TARGET = "./examples/payment-flow/payment-flow.tour.yaml"
bun run dev
```

## Example Fixtures

Use the repository examples as references:

- `payment-flow` for a simple baseline tour
- `viewport-stability` for empty-focus behavior
- `viewport-centering` for grouped and edge-position focus behavior
- `huge-system` for large diagrams and dense label conditions
