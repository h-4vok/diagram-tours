# Architecture

Diagram Tour is a workspace monorepo split into a small number of focused packages.

## Package Responsibilities

- `packages/cli` publishes the global `diagram-tours` command and owns startup orchestration
- `packages/core` defines the shared domain model used by the rest of the system
- `packages/parser` loads Mermaid and YAML inputs, validates them, resolves node references, discovers tours, and returns runtime-ready collections
- `packages/web-player` provides the packaged SvelteKit Node server that loads a collection, selects a tour by slug, and renders the interactive tour UI

This split keeps parsing, domain modeling, and presentation concerns separate.

## Current Runtime Shape

The published product is a global CLI that launches a local web runtime for diagrams and tours.

At runtime, the system:

1. resolves a source target, host, port, and browser-open policy in `packages/cli`
2. launches the packaged `packages/web-player` Node server
3. reads the source target from environment
4. loads either a directory-backed collection or a single file target
5. exposes collection metadata through layout load functions
6. selects a route entry by slug
7. derives the initial step from the URL query
8. renders the selected tour in the web player

## Data Flow

The end-to-end flow is:

```text
CLI target + host + port + browser policy
  -> packaged Node web-player launch
  -> DIAGRAM_TOUR_SOURCE_TARGET
  -> parser source-target resolution
  -> authored-tour discovery, generated fallback discovery, or single-file load
  -> Mermaid node extraction + YAML validation
  -> resolved collection entries with slugs
  -> SvelteKit layout data
  -> route selection by [...tourSlug]
  -> step selection by ?step=
  -> interactive player rendering
```

## Collection and Preview Modes

The runtime supports two loading modes.

### Collection Mode

If the source target is a directory:

- the parser walks the tree recursively
- each `*.tour.yaml`, `.mmd`, and `.mermaid` file is considered a candidate input
- valid authored tours and generated fallback tours become collection entries
- invalid authored tours are recorded as skipped entries
- fallback entries are suppressed when an authored tour already owns the same diagram

This mode powers the default examples shell.

### Single-File Preview Mode

If the source target is a file:

- the parser loads exactly one tour or one diagram
- the layout returns a one-entry collection
- the web player behaves like a focused author preview

This makes local authoring faster and keeps the routing model consistent.

## Parser Responsibilities

The parser is responsible for more than syntax conversion.

It also owns:

- contextual validation errors
- Mermaid node indexing
- replacement of `{{node_id}}` references with Mermaid labels
- slug generation from relative paths
- collection discovery and skipped-entry reporting

The parser returns resolved tours rather than raw YAML documents so downstream packages can work with a normalized contract.

## Web Player Responsibilities

The web player owns:

- route and layout loading
- docs-shell navigation between tours
- step navigation and deep links
- interpretation of semantic focus into viewport and highlight behavior
- theme selection and persistence
- guided recovery for missing routes

The player consumes resolved models. It does not parse raw Mermaid or YAML files directly.

## Focus Semantics

`focus` is a semantic content signal, not a fixed rendering instruction.

That means:

- the tour contract specifies what the step is about
- the player decides how to visualize that focus
- empty-focus steps are allowed and can represent overview states

This keeps the content model stable even as UI behavior evolves.

## Routing Model

The route slug identifies the selected tour.

The optional `?step=` query parameter identifies the initial step:

- missing or invalid values fall back to step one
- out-of-range values clamp to the valid range

Unknown slugs return a guided `404` page instead of a blank failure.

## Boundaries

The intended boundaries remain:

- `core` stays free of filesystem, YAML, and UI dependencies
- `parser` handles input loading and validation without absorbing UI concerns
- `web-player` renders resolved content without re-implementing parser logic

Later versions may add optional integrations, but the current architecture is intentionally centered on a strong parser boundary and a thin UI layer over resolved data.
