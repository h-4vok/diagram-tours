# ADR 0001: Runtime Loading and Focus Semantics

## Status

Accepted

## Context

Diagram Tour needs to support two complementary workflows:

- browsing a collection of example or product tours
- previewing a single tour quickly while authoring

The player also needs to support different visual treatments of focus without baking UI rules into the content contract.

## Decision

The system treats `focus` as semantic intent rather than a hard-coded viewport or styling instruction.

The system also supports two runtime loading modes through a single source-target abstraction:

- directory loading for discoverable tour collections
- single-file loading for focused author preview

## Consequences

Benefits:

- tour files stay product-oriented instead of UI-config heavy
- different players can render focus differently without changing the contract
- authoring and docs-shell workflows share the same parser and resolved model
- the same application can serve both a curated tour library and a single local draft

Tradeoffs:

- the specification cannot promise a precise visual effect for focus
- slug generation and collection behavior become part of runtime conventions
- the web player must translate semantic focus into concrete viewport and highlight behavior

## Notes

This ADR documents current repository behavior. If future versions introduce player-specific focus controls or alternative loading backends, this decision should be revisited.
