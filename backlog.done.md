# Backlog Done

This file stores completed backlog items that were moved out of `backlog.md` to keep the active operational backlog smaller.

## Snapshot

Cutoff date: 2026-03-17

### Done

- BT-023 Introduce `concurrently` for safe parallel package-level validation scripts
  - Outcome: root validation now runs labeled `lint`, `typecheck`, and `test` checks in parallel before gating `smoke`, improving operator speed without changing build or smoke semantics
  - Evidence: `package.json`, `README.md`, `docs/testing/smoke-tests.md`

- BT-020 Strengthen CLI version-mode argument precedence coverage
  - Outcome: `--version` is now explicitly proven to win over an explicit startup target and browser-opening flags, preventing false-green precedence regressions
  - Evidence: `packages/cli/test/args.test.ts`

- BT-021 Expand CLI missing-value sad-path coverage for option parsing
  - Outcome: missing values for both `--host` and `--port` are now explicitly covered at end-of-input and when the next token is another flag, with actionable error text
  - Evidence: `packages/cli/test/args.test.ts`

- BT-005 Wizard path retry UX
  - Outcome: missing paths on both explicit wizard path-entry prompts retry in place instead of bouncing back to the top-level menu
  - Evidence: `packages/cli/src/lib/wizard.ts`, `packages/cli/test/wizard.test.ts`

- BT-003 Author diagnostics
  - Current state: errors include file, step, and field context, and the player exposes skipped tours through an `Issues` badge with clearer hierarchy, cleaner path presentation, and more scannable summaries
  - Gap: still missing line/column data and a richer dedicated author-diagnostics layer
  - Evidence: `packages/parser/src/index.ts`, `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/diagnostics.ts`
- Moved to [`backlog.done.md`](backlog.done.md) to keep the active backlog smaller.
- BT-024 Smoke suite split by file and unified smoke command
  - Current state: each smoke file now contains one test, the browser suite runs through a single `bun run smoke`, and the docs tell agents to run only the relevant file for the current task
  - Evidence: `packages/web-player/smoke/*.spec.ts`, `packages/web-player/package.json`, `package.json`, `docs/testing/smoke-tests.md`
- BT-012 Standalone `tour.yaml` validation command with author-friendly diagnostics
  - Current state: `diagram-tours validate` now checks `.` by default, accepts files and folders, recurses through subfolders, and shares structured diagnostics with the web player
  - Evidence: `packages/parser/src/index.ts`, `packages/cli/src/lib/cli.ts`, `packages/cli/test/cli.test.ts`, `packages/web-player/src/lib/diagnostics.ts`, `docs/authoring-guide.md`
- BT-004 Layout polish and highlight hierarchy
  - Current state: the player now uses the redesigned fullscreen shell, layered controls, and non-geometric focus styling so highlighted nodes stay in place while stepping through the tour
  - Evidence: `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/styles/components/diagram-player.css`, `packages/web-player/smoke/payment-flow.*.spec.ts`

- Default dark mode for first-time users
  - Current state: the web player now boots into dark mode until a stored preference exists, while still honoring explicit light/dark selections across hydration and subsequent navigation
  - Testing expectation: theme helper coverage, layout coverage, and smoke coverage validate the first-load default plus persistence behavior
  - Evidence: `packages/web-player/src/lib/theme.ts`, `packages/web-player/src/app.html`, `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/smoke/payment-flow.spec.ts`
- Zoom controls
  - Current state: the player now exposes overlay zoom controls with bounded zoom-in, zoom-out, and reset actions, preserving the current viewport position while resizing the rendered Mermaid SVG
  - Testing expectation: zoom helper coverage, player component coverage, and smoke coverage validate zoom math, control state, and visible diagram resizing
  - Evidence: `packages/web-player/src/lib/diagram-zoom.ts`, `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/test/diagram-zoom.test.ts`, `packages/web-player/smoke/payment-flow.spec.ts`
- Animated viewport transitions
  - Current state: zoom changes now animate both the SVG resize and the viewport recentering pass, extending the existing smooth step-focus motion into explicit user-driven viewport transitions
  - Testing expectation: player and smoke coverage validate zoom-triggered viewport updates without breaking navigation state
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/styles/components/diagram-player.css`, `packages/web-player/test/tour-player.svelte.test.ts`, `packages/web-player/smoke/payment-flow.spec.ts`
- BT-001 True zoom-to-fit
  - Current state: the player now exposes a Fit action that computes a real zoom-to-fit scale, applies it to the rendered SVG, and recenters the diagram so the current content fits the viewport
  - Testing expectation: zoom helper coverage, player component coverage, and smoke coverage validate fit math, control behavior, and visible diagram framing
  - Evidence: `packages/web-player/src/lib/diagram-zoom.ts`, `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/styles/components/cards.css`, `packages/web-player/test/diagram-zoom.test.ts`, `packages/web-player/test/tour-player.svelte.test.ts`, `packages/web-player/smoke/payment-flow.spec.ts`

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
- Rebalance smoke coverage into a single suite with file-level targeting
  - Current state: `bun run smoke` runs the full browser suite, while individual smoke files stay small enough for targeted agent execution when a task only touches one behavior
  - Testing expectation: script coverage and Playwright discovery validate that each browser scenario lives in one file and that the full suite still runs cleanly for human and CI checks
  - Evidence: `package.json`, `packages/web-player/package.json`, `packages/web-player/smoke/*.spec.ts`, `docs/testing/smoke-tests.md`
- Support for more complex diagram types, including Mermaid sequence diagrams
  - Current state: version 1 now supports Mermaid flowcharts plus Mermaid sequence diagrams with addressable participants and tagged messages, generated fallback steps, `focus`/`{{ref}}` resolution, minimap markers, viewport centering, and click-to-step navigation
  - Scope note: notes, activation bars, loops, alt blocks, and other non-addressable sequence constructs still remain out of scope
  - Evidence: `packages/core/src/index.ts`, `packages/parser/src/index.ts`, `packages/web-player/src/lib/mermaid-diagram.ts`, `packages/web-player/smoke/payment-flow.spec.ts`
