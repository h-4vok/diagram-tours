# Backlog

This file serves as the project's operational backlog. We update it as the real product state changes.

Initial source: a contrast between [`docs/reqs.md`](docs/reqs.md), the current codebase, and the repository's living documentation.

## Conventions

- `Done`: implemented and present in the repository
- `In Progress`: started and integrated in the repository, but not yet closed
- `Partial`: partially implemented or not yet fully aligned with the intended requirement
- `Todo`: not implemented yet

## Snapshot

Cutoff date: 2026-03-17

### Done

- Mermaid + YAML parser, including node resolution and `{{node_id}}` references
  - Evidence: `packages/parser/src/index.ts`
- Tour validation, focus-node validation, and text-reference validation
  - Evidence: `packages/parser/src/index.ts`
- Shared `core` model for tours, collections, steps, and slugs
  - Evidence: `packages/core/src/index.ts`
- Step-by-step navigation (`Previous` / `Next`)
  - Evidence: `packages/web-player/src/lib/player-state.ts`
- Deep linking with 1-based `?step=` and clamping of invalid values
  - Evidence: `packages/web-player/src/routes/[...tourSlug]/+page.server.ts`
- Node highlighting through `data-node-id` and `data-focus-state`
  - Evidence: `packages/web-player/src/lib/mermaid-diagram.ts`
- Multi-focus and empty-focus semantics
  - Evidence: `packages/web-player/src/lib/mermaid-diagram.ts`
- Pan-based viewport control for single-focus, grouped-focus, and neutral states
  - Evidence: `packages/web-player/src/lib/diagram-viewport.ts`
- Canvas-first layout with top bar, step overlay, and floating browse panel
  - Evidence: `packages/web-player/src/routes/+layout.svelte`
- Desktop-first navigation minimap with click-to-pan, viewport dragging, focus markers, responsive auto-hide, and persisted collapsed state
  - Note: the step overlay now stacks above the minimap in the bottom-right overlay column
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/lib/diagram-minimap.ts`, `packages/web-player/test/diagram-minimap.test.ts`
- Theme toggle and theme persistence
  - Evidence: `packages/web-player/src/routes/+layout.svelte`
- Recursive discovery of `*.tour.yaml`
  - Evidence: `packages/parser/src/index.ts`
- Preview of either a single tour file or a directory source target
  - Evidence: `packages/web-player/src/lib/source-target.ts`
- Slug-based routing for multiple tours
  - Evidence: `packages/parser/src/index.ts`, `packages/web-player/src/routes/[...tourSlug]/+page.server.ts`
- Guided recovery for unknown tours
  - Evidence: `packages/web-player/src/routes/+error.svelte`
- Browse panel with explorer-style tour navigation
  - Current state: real folder-based tree, compact folders, text search with lightweight fuzzy matching, folder/diagram iconography, and active-branch expansion
  - Note: skipped-tour details moved to an `Issues` badge in the top bar to keep navigation and diagnostics separate
  - Evidence: `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/browse-tree.ts`, `packages/web-player/test/browse-tree.test.ts`
- Editor preview startup flows
  - Current state: supports `bun run dev <target>` for either a directory or a tour file, plus `bun run dev:interactive` for console-driven source-target selection
  - Note: the runtime source of truth remains `DIAGRAM_TOUR_SOURCE_TARGET`, but startup scripts now provide a friendlier developer workflow
  - Evidence: `package.json`, `scripts/dev-web-player.ts`, `scripts/dev-web-player-interactive.ts`, `scripts/dev-web-player-lib.ts`, `packages/web-player/src/lib/source-target.ts`
- Smoke coverage for load, deep linking, viewport behavior, theme switching, large diagrams, and startup modes
  - Evidence: `packages/web-player/smoke/payment-flow.spec.ts`, `packages/web-player/smoke/startup-modes.spec.ts`, `docs/testing/smoke-tests.md`

### Partial

- Author diagnostics
  - Current state: errors include file, step, and field context, and the player exposes skipped tours through an `Issues` badge with a floating popover
  - Gap: still missing line/column data, better message hierarchy, and a richer author-diagnostics layer
  - Evidence: `packages/parser/src/index.ts`, `packages/web-player/src/routes/+layout.svelte`
- Layout polish and highlight hierarchy
  - Current state: the workspace has been heavily refined, but `reqs.md` still marks this area as open and it remains a reasonable ongoing polish stream
  - Gap: connectors, labels, and fine-grained visual hierarchy can still improve
  - Evidence: `packages/web-player/src/styles/components/diagram-player.css`, `docs/reqs.md`

### In Progress

- No active in-progress items are currently tracked in this file

### Todo

- Visual step timeline
  - Note: no current implementation was found in the repository
- Support for more complex diagram types, including Mermaid sequence diagrams
  - Note: the documented and supported scope is still centered on Mermaid flowcharts
  - Pending: investigate Mermaid's sequence-diagram model and define the impact on parser, validation, references, and player behavior
- Support for operating `diagram-tours` through globally installed npm or Bun commands
  - Note: even if the current use is local on this machine, we want to plan for an installable and reusable CLI experience
  - Pending: define distribution, entrypoints, command ergonomics, Bun/npm compatibility, and authoring/preview expectations before implementation
- Favorites inside the browse panel
  - Note: not a priority for the first explorer iteration, but it could materially improve navigation in large collections
- Keyboard shortcuts and navigation that stay consistent across the browse panel and the diagram
  - Note: we want to treat this as a unified initiative later, rather than mixing it into the initial browse explorer work
  - Pending: define a shared shortcuts model, focus behavior, discoverability, and key-conflict handling
- Node click navigation to jump to the first step associated with a node
  - Note: no current implementation was found in the repository
- Optional zoom-to-fit
  - Note: no current implementation was found in the repository
- Animated viewport transitions
  - Note: no current implementation was found in the repository
- Step-overlay redesign after minimap integration
  - Note: the current step overlay now stacks above the minimap and is good enough for v1, but it should be revisited as part of a more intentional navigation/stepper layout
- Smarter group centering
  - Note: grouped centering exists today, but not a more advanced strategy than the current one
- Explicit viewport constraints
  - Note: no current implementation was found in the repository

## Notes

- `docs/reqs.md` is partially out of date relative to the real project state.
- In particular, it understates capabilities that already exist today: file/directory preview, guided recovery for invalid routes, theme persistence, empty-focus support, and smoke coverage for viewport behavior and large diagrams.
- When something from `Todo` is implemented, it should be moved to `Done` or `Partial` in this file in the same commit.
