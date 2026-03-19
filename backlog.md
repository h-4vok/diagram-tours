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

- Diagram-first fallback tours for raw Mermaid inputs
  - Current state: directories and direct file targets can now load `.mmd` and `.mermaid` diagrams without authored YAML, with generated overview-plus-node walkthroughs and duplicate suppression when a tour file already owns the same diagram
  - Testing expectation: parser, CLI, web-player, and smoke coverage validate generated fallback discovery, direct diagram startup, mixed authored/generated collections, and clear failure when no supported inputs exist
  - Evidence: `packages/parser/src/index.ts`, `packages/cli/src/lib/target.ts`, `packages/cli/src/lib/cli.ts`, `packages/web-player/smoke/startup-modes.spec.ts`
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
  - Current state: real folder-based tree, compact folders, text search with lightweight fuzzy matching, folder/diagram iconography, active-branch expansion, and local favorites pinned above the tree
  - Note: skipped-tour details live in an `Issues` badge in the top bar to keep navigation and diagnostics separate
  - Evidence: `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/browse-tree.ts`, `packages/web-player/test/browse-tree.test.ts`
- Node click navigation to jump to associated steps
  - Current state: clickable Mermaid nodes jump directly when they map to one step, or open a chooser popover when they map to multiple steps
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/lib/tour-step-links.ts`, `packages/web-player/test/tour-player.svelte.test.ts`
- Visual step timeline
  - Current state: the step overlay includes compact numbered pills for direct step jumps with current/completed/upcoming states
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/test/tour-player.svelte.test.ts`
- Editor preview startup flows
  - Current state: supports `bun run dev <target>` for either a directory or a tour file, plus `bun run dev:interactive` for console-driven source-target selection
  - Note: the runtime source of truth remains `DIAGRAM_TOUR_SOURCE_TARGET`, but startup scripts now provide a friendlier developer workflow
  - Evidence: `package.json`, `scripts/dev-web-player.ts`, `scripts/dev-web-player-interactive.ts`, `scripts/dev-web-player-lib.ts`, `packages/web-player/src/lib/source-target.ts`
- Global `diagram-tours` npm/Bun CLI
  - Current state: the repository now includes a publishable `packages/cli` package named `diagram-tours`, a no-arg wizard, direct directory/file startup, localhost-first port selection, browser-open controls, and a packaged Node web-player runtime
  - Testing expectation: CLI unit coverage, packaged-runtime smoke coverage, and build validation all exercise the publishable path rather than only the repo-local Bun dev flow
  - Evidence: `packages/cli/package.json`, `packages/cli/src/lib/cli.ts`, `packages/web-player/package.json`, `packages/web-player/playwright.config.ts`
- Unified coverage dashboard for monorepo unit tests
  - Current state: package-level test ownership and `100%` guardrails stay in place, while `bun run coverage` now writes a single root entrypoint at `coverage/index.html` with drill-down links for `core`, `parser`, `web-player`, `cli`, and `scripts`
  - Testing expectation: unit coverage validates the dashboard generator and keeps script coverage visible instead of leaving it outside the main report flow
  - Evidence: `package.json`, `scripts/build-coverage-dashboard.ts`, `scripts/vitest.config.ts`, `docs/testing/coverage.md`
- Smoke coverage for load, deep linking, viewport behavior, theme switching, large diagrams, startup modes, node-step navigation, favorites, diagnostics, and timeline
  - Evidence: `packages/web-player/smoke/payment-flow.spec.ts`, `packages/web-player/smoke/startup-modes.spec.ts`, `docs/testing/smoke-tests.md`

### Partial

- Author diagnostics
  - Current state: errors include file, step, and field context, and the player exposes skipped tours through an `Issues` badge with clearer hierarchy, cleaner path presentation, and more scannable summaries
  - Gap: still missing line/column data and a richer dedicated author-diagnostics layer
  - Evidence: `packages/parser/src/index.ts`, `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/diagnostics.ts`
- Layout polish and highlight hierarchy
  - Current state: the workspace has been heavily refined, but `reqs.md` still marks this area as open and it remains a reasonable ongoing polish stream
  - Gap: connectors, labels, and fine-grained visual hierarchy can still improve
  - Evidence: `packages/web-player/src/styles/components/diagram-player.css`, `docs/reqs.md`
- Wizard path retry UX
  - Current state: invalid explicit paths fail clearly during wizard input validation
  - Gap: the wizard should keep the user on the current path-entry step rather than bouncing back to the top-level menu after a missing path
  - Evidence: `packages/cli/src/lib/wizard.ts`

### Todo

- Another theme pass
  - Note: the current palette is serviceable, but the overall color choices still need another intentional design pass
- Default to dark mode until the user has already chosen a preference
  - Note: the current default startup still lands in light mode for first-time users
- Stepper and step-text presentation redesign
  - Note: the current overlay works functionally, but the step pills and text presentation should be revisited together
- Inline tour descriptions inside Mermaid source
  - Note: investigate whether authored tour copy can live in Mermaid itself, reducing the need for a separate YAML file in some flows
  - Pending: define what inline syntax would be supported, how it maps to steps, and how it coexists with authored `*.tour.yaml`
- Adoption and onboarding strategy for people and AI assistants
  - Note: preserve both product onboarding and AI discoverability as a dedicated initiative rather than letting it live only in chat history
  - Pending: turn the ideas in `docs/adoption-onboarding.md` into concrete README, repository-convention, and CLI work
- Support for more complex diagram types, including Mermaid sequence diagrams
  - Note: the documented and supported scope is still centered on Mermaid flowcharts
  - Pending: investigate Mermaid's sequence-diagram model and define the impact on parser, validation, references, and player behavior
- Keyboard shortcuts and navigation that stay consistent across the browse panel and the diagram
  - Note: we want to treat this as a unified initiative later, rather than mixing it into the initial browse explorer work
  - Pending: define a shared shortcuts model, focus behavior, discoverability, and key-conflict handling
- Zoom controls
  - Note: the current player supports minimap panning, but does not yet expose true zoom in the product surface
- True zoom-to-fit
  - Note: a simple overview recentering helper exists internally, but it is currently hidden because it does not provide actual zoom semantics
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
