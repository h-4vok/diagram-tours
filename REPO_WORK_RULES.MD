# Repository Work Rules

This document describes operational rules for the Diagram Tour repository.

## Runtime

Primary runtime: Bun.

The project is organized as a Bun workspace monorepo.

## Packages

```
packages/
  core/
  parser/
  web-player/
```

## Examples

Example tours are stored in:

```
examples/
```

Fixtures used for testing live in:

```
fixtures/
```

## Tour Contract

Version 1 tour format:

```
version
title
diagram
steps
```

Each step contains:

```
focus
text
```

### Focus

Focus references node IDs from the Mermaid diagram.

Example:

```
focus:
  - api_gateway
```

### Text References

Inside step text, nodes are referenced with:

```
{{node_id}}
```

Example:

```
The {{api_gateway}} forwards requests to {{validation_service}}.
```

These resolve to the Mermaid node label.

## Validation Rules

Parser must fail when:

- node id does not exist
- references are invalid
- tour contains no steps

Errors should be descriptive.

## Scope (v1)

Supported:

- Mermaid flowcharts
- YAML tours
- sequential steps

Not supported:

- audio
- branching
- multi-diagram tours
