# Smoke Tests

This document explains which browser-visible behaviors belong to the fast `core smoke` tier and which belong to the broader `extended pre-push` tier.

The executable source of truth remains Playwright in `packages/web-player/smoke/`. This file is the human-readable map of that suite.

## Commands

- `bun run smoke`: builds the packaged runtime and runs only the tagged core browser scenarios
- `bun run smoke:extended`: builds the packaged runtime and runs only the tagged extended browser scenarios
- `bun run smoke:full`: builds the packaged runtime and runs the complete browser suite
- `bun run prepush`: runs lint, typecheck, unit coverage, and the full browser suite

## Tiering Principles

- core smoke protects fast packaged-runtime confidence for everyday work
- extended smoke protects broader browser UX, edge cases, and heavier interaction coverage before handoff
- every existing browser scenario stays covered in one tier or the other
- when a startup mode or interaction only duplicates a behavior already proven by core smoke, it belongs in extended unless it adds unique risk

## Core Smoke

Core smoke is the minimum browser-visible contract we want on every relevant task:

- packaged CLI startup into a repo-wide collection
- scoped startup into examples-only and single-file preview modes
- critical shell hydration and browse-driven tour switching
- route-driven step navigation without remount churn
- direct node-to-step interaction
- generated fallback tour startup for raw Mermaid input
- first-load dark-mode default

### Core startup coverage

File: `packages/web-player/smoke/startup-modes.spec.ts`

- `repo-wide startup exposes repo-only tours in browse`
- `explicit examples directory keeps browse scoped to shipped examples`
- `explicit single-file startup limits browse to one tour`
- `explicit diagram startup generates a fallback tour preview`

Why these stay in core:

- they prove the packaged CLI can launch the main supported target shapes
- they verify visible collection scoping instead of only process-level startup
- they keep generated fallback startup covered in the default signal

### Core player coverage

File: `packages/web-player/smoke/payment-flow.spec.ts`

- `docs shell browse navigation changes tours without breaking the player`
- `deep-linked step changes reuse the same Mermaid svg`
- `first load defaults to dark mode until a preference is chosen`
- `clicking a node jumps directly to its matching step`
- `generated fallback tours render a minimal overview and node-by-node walkthrough`

Why these stay in core:

- they prove the main browser shell hydrates and stays coherent across navigation
- they keep one representative route-driven navigation assertion in the fast tier
- they cover one direct diagram interaction path that users rely on immediately
- they retain one representative generated-tour walkthrough beyond startup alone

## Extended Pre-Push Smoke

Extended smoke covers richer browser UX, broader startup equivalence, heavier fixtures, and edge-case runtime behavior. These checks still matter, but they no longer need to run as the default smoke signal on every task.

### Extended startup and source-shape coverage

File: `packages/web-player/smoke/startup-modes.spec.ts`

- `interactive open-all matches repo-wide startup`
- `interactive directory selection matches examples-only startup`
- `interactive file selection matches single-file startup`
- `interactive startup skips the prompt when a target is explicit`
- `explicit markdown startup generates multiple fallback entries from one file`

Why these moved to extended:

- they mainly validate equivalence and additional source shapes beyond the critical startup baseline
- they are valuable before handoff, but not required for every fast feedback loop

### Extended runtime UX coverage

File: `packages/web-player/smoke/payment-flow.spec.ts`

- browse-search strictness
- canvas overflow ownership
- viewport-centering precision
- huge-diagram stress and initial legibility
- connector-label context visibility
- long-step-text layout resilience
- theme persistence after explicit user choice
- selected-step visibility in dark mode
- guided 404 recovery
- empty-focus viewport stability
- minimap visibility, click-pan, drag-pan, and mobile auto-hide
- zoom control behavior
- repeated-node chooser flow
- favorites pinning
- timeline direct-jump pills
- diagnostics popover hierarchy
- authored Markdown-fragment tours
- Markdown startup failure handling
- authored and generated sequence-diagram browser flows
- Markdown-backed sequence generated tours

Why these moved to extended:

- they focus on richer interaction quality, UX polish, heavy fixtures, or specialized input contracts
- several are duplicate-path validations for capabilities already represented in core smoke
- together they provide the broader merge-time confidence that now belongs in `bun run prepush`

## Coverage Map

Every existing Playwright scenario maps to exactly one tier:

- core: representative startup, shell navigation, direct interaction, fallback walkthrough, and first-load theme baseline
- extended: startup equivalence, advanced layout and viewport checks, minimap and favorites UX, diagnostics, Markdown edge cases, and sequence-diagram browser coverage

If a new browser test mainly answers "can the packaged app launch and support a basic guided tour flow?", add it to core. If it mainly answers "does the richer UX or a broader edge case still behave correctly?", add it to extended.
