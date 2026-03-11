# Repository Work Rules

This document describes repository-level operating rules for the Diagram Tour project.

## Runtime

Primary runtime: Bun.

The project is organized as a Bun workspace monorepo.

## Task Shaping

Work must be defined as a **bounded task**.

A bounded task is a unit of observable business or product value that can be delivered, tested, and reviewed as a coherent outcome.

Tasks in this repository should be framed as:

- a user-visible capability
- a contract-visible capability
- a validation-visible behavior
- a clearly scoped infrastructure improvement that unlocks product delivery

Tasks must not be framed as:

- isolated helper functions
- arbitrary implementation slices with no observable outcome
- mixed bundles of unrelated capabilities
- low-level changes detached from product or contract value

The owner is expected to think in terms of system capabilities. Codex is expected to translate those capabilities into concrete design and implementation work.

## Repository Boundaries

The repository is organized into focused packages:

- `packages/core`
- `packages/parser`
- `packages/web-player`

Each task should respect those boundaries.

- `core` owns the domain model and future tour engine behavior.
- `parser` owns Mermaid and YAML reading, parsing, and validation.
- `web-player` owns the UI for running tours.

Boundary rules:

- `core` must not depend on filesystem access, YAML tooling, or UI frameworks
- `parser` may depend on Mermaid and YAML parsing tools, but should not absorb UI concerns
- `web-player` consumes resolved models and presentation state, not raw parsing responsibilities

Tasks should be sliced so that responsibilities remain separated even when a delivery touches more than one package.

## Repository Inputs

Example tours are stored in `examples/`.

Fixtures used for testing live in `fixtures/`.

## Tour Contract

The `tour.yaml` format is a primary system contract.

The detailed source of truth for version 1 is `docs/tour-spec-v1.md`.

Version 1 tour format contains:

- `version`
- `title`
- `diagram`
- `steps`

Each step contains:

- `focus`
- `text`

### Focus

Focus references node IDs from the Mermaid diagram.

Example:

```yaml
focus:
  - api_gateway
```

### Text References

Inside step text, nodes are referenced with:

```text
{{node_id}}
```

Example:

```text
The {{api_gateway}} forwards requests to {{validation_service}}.
```

These references resolve to the Mermaid node label.

## Validation Rules

Parser must fail when:

- a node ID does not exist
- references are invalid
- a tour contains no steps

Errors should be descriptive and actionable.

## Scope (v1)

Supported:

- Mermaid flowcharts
- YAML tours
- sequential steps

Not supported:

- audio
- branching
- multi-diagram tours
