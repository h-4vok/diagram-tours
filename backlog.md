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

- `BD-01` Default dark mode for first-time users
  - Current state: the web player now boots into dark mode until a stored preference exists, while still honoring explicit light/dark selections across hydration and subsequent navigation
  - Testing expectation: theme helper coverage, layout coverage, and smoke coverage validate the first-load default plus persistence behavior
  - Evidence: `packages/web-player/src/lib/theme.ts`, `packages/web-player/src/app.html`, `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/smoke/payment-flow.spec.ts`
- `BD-02` Zoom controls
  - Current state: the player now exposes overlay zoom controls with bounded zoom-in, zoom-out, and reset actions, preserving the current viewport position while resizing the rendered Mermaid SVG
  - Testing expectation: zoom helper coverage, player component coverage, and smoke coverage validate zoom math, control state, and visible diagram resizing
  - Evidence: `packages/web-player/src/lib/diagram-zoom.ts`, `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/test/diagram-zoom.test.ts`, `packages/web-player/smoke/payment-flow.spec.ts`
- `BD-03` Animated viewport transitions
  - Current state: zoom changes now animate both the SVG resize and the viewport recentering pass, extending the existing smooth step-focus motion into explicit user-driven viewport transitions
  - Testing expectation: player and smoke coverage validate zoom-triggered viewport updates without breaking navigation state
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/styles/components/diagram-player.css`, `packages/web-player/test/tour-player.svelte.test.ts`, `packages/web-player/smoke/payment-flow.spec.ts`
- BT-001 True zoom-to-fit
  - Current state: the player now exposes a Fit action that computes a real zoom-to-fit scale, applies it to the rendered SVG, and recenters the diagram so the current content fits the viewport
  - Testing expectation: zoom helper coverage, player component coverage, and smoke coverage validate fit math, control behavior, and visible diagram framing
  - Evidence: `packages/web-player/src/lib/diagram-zoom.ts`, `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/styles/components/cards.css`, `packages/web-player/test/diagram-zoom.test.ts`, `packages/web-player/test/tour-player.svelte.test.ts`, `packages/web-player/smoke/payment-flow.spec.ts`

- `BD-04` Diagram-first fallback tours for raw Mermaid inputs
  - Current state: directories and direct file targets can now load `.mmd` and `.mermaid` diagrams without authored YAML, with generated overview-plus-node walkthroughs and duplicate suppression when a tour file already owns the same diagram
  - Testing expectation: parser, CLI, web-player, and smoke coverage validate generated fallback discovery, direct diagram startup, mixed authored/generated collections, and clear failure when no supported inputs exist
  - Evidence: `packages/parser/src/index.ts`, `packages/cli/src/lib/target.ts`, `packages/cli/src/lib/cli.ts`, `packages/web-player/smoke/startup-modes.spec.ts`
- `BD-05` Mermaid + YAML parser, including node resolution and `{{node_id}}` references
  - Evidence: `packages/parser/src/index.ts`
- `BD-06` Tour validation, focus-node validation, and text-reference validation
  - Evidence: `packages/parser/src/index.ts`
- `BD-07` Shared `core` model for tours, collections, steps, and slugs
  - Evidence: `packages/core/src/index.ts`
- `BD-08` Step-by-step navigation (`Previous` / `Next`)
  - Evidence: `packages/web-player/src/lib/player-state.ts`
- `BD-09` Deep linking with 1-based `?step=` and clamping of invalid values
  - Evidence: `packages/web-player/src/routes/[...tourSlug]/+page.server.ts`
- `BD-10` Node highlighting through `data-node-id` and `data-focus-state`
  - Evidence: `packages/web-player/src/lib/mermaid-diagram.ts`
- `BD-11` Multi-focus and empty-focus semantics
  - Evidence: `packages/web-player/src/lib/mermaid-diagram.ts`
- `BD-12` Pan-based viewport control for single-focus, grouped-focus, and neutral states
  - Evidence: `packages/web-player/src/lib/diagram-viewport.ts`
- `BD-13` Canvas-first layout with top bar, step overlay, and floating browse panel
  - Evidence: `packages/web-player/src/routes/+layout.svelte`
- `BD-14` Desktop-first navigation minimap with click-to-pan, viewport dragging, focus markers, responsive auto-hide, and persisted collapsed state
  - Note: the step overlay now stacks above the minimap in the bottom-right overlay column
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/lib/diagram-minimap.ts`, `packages/web-player/test/diagram-minimap.test.ts`
- `BD-15` Theme toggle and theme persistence
  - Evidence: `packages/web-player/src/routes/+layout.svelte`
- `BD-16` Recursive discovery of `*.tour.yaml`
  - Evidence: `packages/parser/src/index.ts`
- `BD-17` Preview of either a single tour file or a directory source target
  - Evidence: `packages/web-player/src/lib/source-target.ts`
- `BD-18` Slug-based routing for multiple tours
  - Evidence: `packages/parser/src/index.ts`, `packages/web-player/src/routes/[...tourSlug]/+page.server.ts`
- `BD-19` Guided recovery for unknown tours
  - Evidence: `packages/web-player/src/routes/+error.svelte`
- `BD-20` Browse panel with explorer-style tour navigation
  - Current state: real folder-based tree, compact folders, text search with lightweight fuzzy matching, folder/diagram iconography, active-branch expansion, and local favorites pinned above the tree
  - Note: skipped-tour details live in an `Issues` badge in the top bar to keep navigation and diagnostics separate
  - Evidence: `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/browse-tree.ts`, `packages/web-player/test/browse-tree.test.ts`
- `BD-21` Node click navigation to jump to associated steps
  - Current state: clickable Mermaid nodes jump directly when they map to one step, or open a chooser popover when they map to multiple steps
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/src/lib/tour-step-links.ts`, `packages/web-player/test/tour-player.svelte.test.ts`
- `BD-22` Visual step timeline
  - Current state: the step overlay includes compact numbered pills for direct step jumps with current/completed/upcoming states
  - Evidence: `packages/web-player/src/lib/tour-player.svelte`, `packages/web-player/test/tour-player.svelte.test.ts`
- `BD-23` Editor preview startup flows
  - Current state: supports `bun run dev <target>` for either a directory or a tour file, plus `bun run dev:interactive` for console-driven source-target selection
  - Note: the runtime source of truth remains `DIAGRAM_TOUR_SOURCE_TARGET`, but startup scripts now provide a friendlier developer workflow
  - Evidence: `package.json`, `scripts/dev-web-player.ts`, `scripts/dev-web-player-interactive.ts`, `scripts/dev-web-player-lib.ts`, `packages/web-player/src/lib/source-target.ts`
- `BD-24` Global `diagram-tours` npm/Bun CLI
  - Current state: the repository now includes a publishable `packages/cli` package named `diagram-tours`, a no-arg wizard, direct directory/file startup, localhost-first port selection, browser-open controls, and a packaged Node web-player runtime
  - Testing expectation: CLI unit coverage, packaged-runtime smoke coverage, and build validation all exercise the publishable path rather than only the repo-local Bun dev flow
  - Evidence: `packages/cli/package.json`, `packages/cli/src/lib/cli.ts`, `packages/web-player/package.json`, `packages/web-player/playwright.config.ts`
- `BD-25` Unified coverage dashboard for monorepo unit tests
  - Current state: package-level test ownership and `100%` guardrails stay in place, while `bun run coverage` now writes a single root entrypoint at `coverage/index.html` with drill-down links for `core`, `parser`, `web-player`, `cli`, and `scripts`
  - Testing expectation: unit coverage validates the dashboard generator and keeps script coverage visible instead of leaving it outside the main report flow
  - Evidence: `package.json`, `scripts/build-coverage-dashboard.ts`, `scripts/vitest.config.ts`, `docs/testing/coverage.md`
- `BD-26` Smoke coverage for load, deep linking, viewport behavior, theme switching, large diagrams, startup modes, node-step navigation, favorites, diagnostics, and timeline
  - Evidence: `packages/web-player/smoke/payment-flow.spec.ts`, `packages/web-player/smoke/startup-modes.spec.ts`, `docs/testing/smoke-tests.md`
- `BD-27` Rebalance smoke coverage into core smoke vs extended pre-push coverage
  - Current state: `bun run smoke` now runs a smaller tagged core browser suite for packaged-runtime startup and critical navigation confidence, while broader browser scenarios run through an extended suite included in `bun run prepush`
  - Testing expectation: script coverage and Playwright selection validate that every existing browser scenario remains covered in either the core or extended tier, with `prepush` still exercising the full browser surface before handoff
  - Evidence: `package.json`, `packages/web-player/package.json`, `packages/web-player/smoke/payment-flow.spec.ts`, `packages/web-player/smoke/startup-modes.spec.ts`, `docs/testing/smoke-tests.md`
- `BD-28` Support for more complex diagram types, including Mermaid sequence diagrams
  - Current state: version 1 now supports Mermaid flowcharts plus Mermaid sequence diagrams with addressable participants and tagged messages, generated fallback steps, `focus`/`{{ref}}` resolution, minimap markers, viewport centering, and click-to-step navigation
  - Scope note: notes, activation bars, loops, alt blocks, and other non-addressable sequence constructs still remain out of scope
  - Evidence: `packages/core/src/index.ts`, `packages/parser/src/index.ts`, `packages/web-player/src/lib/mermaid-diagram.ts`, `packages/web-player/smoke/payment-flow.spec.ts`
- `BD-29` `diagram-tours init` scaffolding for new authored tours
  - Current state: the published CLI can now scaffold a sibling starter `*.tour.yaml` from a standalone `.mmd` or `.mermaid` file, inferring the title, diagram path, and starter steps from the generated fallback tour model
  - Testing expectation: CLI coverage validates sibling path generation, starter content, and overwrite protection
  - Evidence: `packages/cli/src/lib/init.ts`, `packages/cli/test/init.test.ts`, `README.md`, `docs/authoring-guide.md`
- `BD-30` Installable authoring reference for AI agents and repository tooling
  - Current state: `diagram-tours setup` now installs `.diagram-tours/instructions.md` as the repository-local authoring reference and can optionally install a Codex subagent definition that points back to that file
  - Testing expectation: CLI coverage validates instructions-only install, default agent install, custom path install, and overwrite protection
  - Evidence: `packages/cli/src/lib/setup.ts`, `packages/cli/test/setup.test.ts`, `README.md`, `docs/adoption-onboarding.md`
- `BD-31` Standalone authored-tour validation command with author-friendly diagnostics
  - Current state: `diagram-tours validate [target]` now validates either one `*.tour.yaml` file or all authored tours under a directory recursively, returning actionable parser diagnostics while leaving richer line/column work in `BP-01`
  - Testing expectation: parser and CLI coverage validate single-file success, recursive directory validation, mixed valid/invalid directories, and empty-directory authored-tour reporting
  - Evidence: `packages/parser/src/index.ts`, `packages/parser/test/index.test.ts`, `packages/cli/src/lib/validate.ts`, `packages/cli/test/validate.test.ts`

### Partial

- `BP-01` Author diagnostics
  - Current state: errors include file, step, and field context, and the player exposes skipped tours through an `Issues` badge with clearer hierarchy, cleaner path presentation, and more scannable summaries
  - Gap: still missing line/column data and a richer dedicated author-diagnostics layer
  - Evidence: `packages/parser/src/index.ts`, `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/diagnostics.ts`
- `BP-02` Layout polish and highlight hierarchy
  - Current state: the workspace has been heavily refined, but `reqs.md` still marks this area as open and it remains a reasonable ongoing polish stream
  - Gap: connectors, labels, and fine-grained visual hierarchy can still improve
  - Evidence: `packages/web-player/src/styles/components/diagram-player.css`, `docs/reqs.md`
- `BP-03` Wizard path retry UX
  - Current state: invalid explicit paths fail clearly during wizard input validation
  - Gap: the wizard should keep the user on the current path-entry step rather than bouncing back to the top-level menu after a missing path
  - Evidence: `packages/cli/src/lib/wizard.ts`

### Todo
- `BT-01` Improve sequence-diagram highlighting quality
  - Note: sequence diagrams are functional today, but their current focus/highlight treatment still feels weaker than the flowchart experience
- `BT-02` Another theme pass
  - Note: the current palette is serviceable, but the overall color choices still need another intentional design pass
- `BT-03` Improve dark-mode treatment for sequence diagrams
  - Note: dark mode remains noticeably weaker on sequence diagrams than on the rest of the player and still needs a dedicated visual pass
- `BT-04` Stepper and step-text presentation redesign
  - Note: the current overlay works functionally, but the step pills and text presentation should be revisited together
- `BT-08` Adoption and onboarding strategy for people and AI assistants
  - Note: preserve both product onboarding and AI discoverability as a dedicated initiative rather than letting it live only in chat history
  - Pending: turn the ideas in `docs/adoption-onboarding.md` into concrete README, repository-convention, and CLI work
- `BT-09` Keyboard shortcuts and navigation that stay consistent across the browse panel and the diagram
  - Note: we want to treat this as a unified initiative later, rather than mixing it into the initial browse explorer work
  - Pending: define a shared shortcuts model, focus behavior, discoverability, and key-conflict handling
- `BT-10` True zoom-to-fit
  - Note: a simple overview recentering helper exists internally, but it is currently hidden because it does not provide actual zoom semantics
- `BT-11` Step-overlay redesign after minimap integration
  - Note: the current step overlay now stacks above the minimap and is good enough for v1, but it should be revisited as part of a more intentional navigation/stepper layout
- `BT-12` Smarter group centering
  - Note: grouped centering exists today, but not a more advanced strategy than the current one
- `BT-13` Explicit viewport constraints
  - Note: no current implementation was found in the repository

## Notes

- `docs/reqs.md` is partially out of date relative to the real project state.
- In particular, it understates capabilities that already exist today: file/directory preview, guided recovery for invalid routes, theme persistence, empty-focus support, and smoke coverage for viewport behavior and large diagrams.
- When something from `Todo` is implemented, it should be moved to `Done` or `Partial` in this file in the same commit.
