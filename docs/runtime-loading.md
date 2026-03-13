# Runtime Loading

This document explains how Diagram Tour loads tours at runtime today.

## Source Target

The web player loads tours from `DIAGRAM_TOUR_SOURCE_TARGET`.

If that environment variable is not set, the default target is the repository `examples/` directory.

The source target can point to:

- a directory containing one or more `*.tour.yaml` files
- a single `*.tour.yaml` file for direct author preview

## Directory Mode

When the source target is a directory, the parser:

1. walks the directory tree recursively
2. discovers every `*.tour.yaml` file
3. loads and validates each tour
4. returns a collection of valid entries plus a list of skipped invalid entries

If no valid tours are discovered, loading fails.

Directory mode is the default docs-shell experience used by the web player.

## Single-File Preview

When the source target is a file, the parser:

1. loads exactly that tour
2. resolves its Mermaid diagram
3. returns a collection containing a single entry

This mode is useful while authoring a specific tour because it removes unrelated examples from the UI.

## Slug Generation

Each discovered tour entry receives a slug derived from its relative source path.

Examples:

- `examples/payment-flow/payment-flow.tour.yaml` -> `payment-flow`
- `examples/incident-response/incident-response.tour.yaml` -> `incident-response`
- `examples/nested/demo.tour.yaml` -> `nested/demo`

If the filename stem matches the containing directory name, the directory path becomes the slug.

## Runtime Flow

The runtime path for the web player is:

1. `+layout.server.ts` reads the source target
2. `@diagram-tour/parser` loads a resolved collection
3. layout data exposes both the collection and source-target metadata
4. `[...tourSlug]/+page.server.ts` selects one entry by slug
5. the page reads `?step=` to choose the initial step
6. `tour-player.svelte` renders the tour and keeps navigation in sync with the URL

## Invalid Tours

In directory mode, invalid tours do not stop the whole collection unless every discovered tour is invalid.

Instead, invalid tours are reported in `collection.skipped` with:

- `sourcePath`
- `error`

That lets the docs shell remain usable while still surfacing authoring problems.

## Route Behavior

The active tour is selected by slug.

The active step is selected by the optional `?step=` query parameter.

Step behavior today:

- missing `step` starts at the first step
- non-integer `step` falls back to the first step
- values below range clamp to the first step
- values above range clamp to the last step

Unknown slugs produce a guided `404` page with a single recovery action back to the available tours.
