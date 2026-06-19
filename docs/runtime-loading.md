# Runtime Loading

This document explains the runtime contract for the published `diagram-tours` CLI and the repo-local contributor scripts.

## Runtime Source Of Truth

The packaged web player reads diagrams and tours from `DIAGRAM_TOUR_SOURCE_TARGET`.

That target may be:

- a directory containing Mermaid diagrams, `*.tour.yaml` files, or both
- a single `*.tour.yaml` file for authored preview
- a single `.mmd`, `.mermaid`, or `.md` file for generated fallback preview

The global CLI resolves and validates the operator's requested path first, then passes the final absolute path to the runtime through `DIAGRAM_TOUR_SOURCE_TARGET`.

## Global CLI Startup

The product entrypoint is:

```text
diagram-tours [target?] [--host <value>] [--port <value>] [--open|--no-open]
```

Behavior:

- no positional target starts the wizard
- the wizard offers current-directory, other-directory, and single-file startup
- direct targets skip the wizard
- direct targets do not open the browser unless `--open` is passed
- the wizard asks whether to open the browser
- port selection prefers `7733`, then falls back to another free localhost port unless the operator explicitly requested a port

The CLI is responsible for browser policy, host/port selection, and launching the packaged Node server. The SvelteKit runtime remains responsible for loading tours and serving the UI.

## Authoring Commands

The published CLI also includes authoring commands that do not start the runtime:

- `diagram-tours setup`
- `diagram-tours init <target>`
- `diagram-tours validate [target]`

Behavior:

- `setup` creates `.diagram-tours/instructions.md` and can optionally install a Codex subagent definition
- `init` accepts one target and derives scaffold mode from that target shape
- `validate` checks one authored `*.tour.yaml` file or all authored tours under a directory recursively

Supported `init` target shapes today:

- existing `.mmd` or `.mermaid` file: create sibling `*.tour.yaml` scaffold from generated fallback entry
- existing `.md` file with one Mermaid fenced block: create sibling `*.tour.yaml` that references that Markdown diagram
- existing `.md#fragment` target: create sibling `*-fragment.tour.yaml` for matching Mermaid block
- existing `.md` file with multiple Mermaid fenced blocks and no fragment: prompt the operator to choose one block, then create one sibling `*.tour.yaml`
- direct `*.tour.yaml` target path, even when file does not exist yet: create that authored tour file plus sibling starter `.mmd` diagram with same stem

`setup` runs interactively by default but also supports direct flags such as `--agent`, `--agent-path <path>`, `--no-agent`, and `--overwrite`. `init` supports `--overwrite` for replacing existing scaffold files and only allows `#fragment` on Markdown targets.

Examples:

```bash
diagram-tours init ./examples/flowchart/checkout-payment-flow.mmd
diagram-tours init ./docs/interview-offers-pipeline.md
diagram-tours init ./fixtures/markdown/checklist.md#details
diagram-tours init ./examples/flowchart/new-flow.tour.yaml
```

When operators preview a direct target, they must either pass `--open` or open the printed localhost URL manually. Direct targets do not launch the browser by default.

These commands are CLI-side authoring helpers. They do not change the runtime source of truth, which remains `DIAGRAM_TOUR_SOURCE_TARGET` for startup and browser preview.

## Contributor Startup

Repository contributors still have Bun-first helper scripts:

- `bun run dev`
- `bun run dev:open`
- `bun run dev <target>`
- `bun run dev:interactive`

Those scripts exist for local repo work and testing. They are not the publishable product runtime path.

## Directory Mode

When the source target is a directory, the parser:

1. walks the directory tree recursively
2. discovers authored `*.tour.yaml` files and standalone `.mmd` / `.mermaid` / `.md` diagrams
3. loads and validates authored tours
4. extracts Mermaid fenced blocks from Markdown files when needed and generates fallback tours for untoured diagrams
5. returns a collection of valid entries plus a list of skipped invalid authored tours

If no valid tours or diagrams are discovered, loading fails before the runtime starts.

Directory mode is the default collection experience used by the web player.

## Single-File Preview

When the source target is a file, the parser:

1. loads exactly that tour or diagram source
2. resolves its Mermaid diagram
3. returns a collection containing the authored tour, the generated diagram fallback, or one generated entry per Mermaid block for Markdown targets

Single-file behavior by shape:

- `*.tour.yaml`: load exactly that authored tour entry
- `.mmd` or `.mermaid`: load one generated fallback entry for that diagram
- `.md`: load one generated fallback entry per Mermaid fenced block in that Markdown file

For Markdown files with multiple Mermaid fenced blocks, single-file preview still returns one generated entry per block.

This mode is useful while authoring a specific tour or previewing one diagram because it removes unrelated content from the UI.

## Slug Generation

Each discovered entry receives a slug derived from its relative source path.

Examples:

- `examples/flowchart/checkout-payment-flow.tour.yaml` -> `flowchart/checkout-payment-flow`
- `examples/flowchart/checkout-payment-flow.mmd` -> `flowchart/checkout-payment-flow`
- `fixtures/markdown/checklist.md#details` -> `fixtures/markdown/checklist/details`
- `examples/flowchart/payments-platform-overview.tour.yaml` -> `flowchart/payments-platform-overview`
- `examples/nested/demo.tour.yaml` -> `nested/demo`

If the filename stem matches the containing directory name, the directory path becomes the slug.

## Runtime Flow

The end-to-end runtime path is:

1. `diagram-tours` resolves target, host, port, and browser-open behavior
2. the CLI launches the packaged `@diagram-tour/web-player` Node server
3. `+layout.server.ts` reads `DIAGRAM_TOUR_SOURCE_TARGET`
4. `@diagram-tour/parser` loads a resolved collection of authored and/or generated tours
5. layout data exposes both the collection and source-target metadata
6. `[...tourSlug]/+page.server.ts` selects one entry by slug
7. the page reads `?step=` to choose the initial step
8. `tour-player.svelte` renders the tour and keeps navigation in sync with the URL

## Invalid Tours

In directory mode, invalid authored tours do not stop the whole collection unless every discovered tour and diagram candidate fails.

Instead, invalid tours are reported in `collection.skipped` with:

- `sourcePath`
- `error`

That lets the docs shell remain usable while still surfacing authoring problems, even when the directory only has raw diagrams.

## Route Behavior

The active tour is selected by slug.

The active step is selected by the optional `?step=` query parameter.

Step behavior today:

- missing `step` starts at the first step
- non-integer `step` falls back to the first step
- values below range clamp to the first step
- values above range clamp to the last step

Unknown slugs produce a guided `404` page with a single recovery action back to the available tours.
