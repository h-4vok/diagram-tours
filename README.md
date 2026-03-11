# Diagram Tour

Diagram Tour is an open source project for creating guided tours on top of Mermaid diagrams. The long-term goal is to pair a diagram with tour content so readers can step through a system, process, or workflow with focused explanations.

This repository is organized as a Bun-based monorepo. The current stage is initial scaffolding only: workspace setup, package boundaries, shared TypeScript configuration, a minimal SvelteKit app shell, and example/fixture content for the payment flow.

## Packages

- `packages/core` contains shared domain types and the future tour engine.
- `packages/parser` is the future home for Mermaid and YAML parsing plus validation.
- `packages/web-player` is a minimal SvelteKit app that will later render and run tours in the browser.

## Repository Layout

- `examples/payment-flow` contains a copied example diagram and tour pair for manual exploration.
- `fixtures` keeps test-friendly source fixtures.
- `docs` holds lightweight project documentation, including the initial architecture note.

## Current Status

The repository is intentionally simple at this stage. It is ready for Bun workspace installs and follow-up implementation work, but it does not yet include the full Diagram Tour product.

## Getting Started

```bash
bun install
bun run dev
```

Other useful commands:

```bash
bun run build
bun run typecheck
bun run test
bun run lint
```

