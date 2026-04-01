# Diagram Tours Requirements

## Scope
- Current system only.
- Source of truth: code + current docs.

## Runtime Shape
- Input: Mermaid file, Markdown file with Mermaid fences, directory, or `*.tour.yaml`.
- Parser resolves input to normalized tours.
- Web player renders resolved tours in browser.
- CLI selects target, starts server, opens browser when requested.

## Package Architecture
- `packages/core`: shared domain types, resolved tour model, collection model.
- `packages/parser`: Mermaid/YAML/Markdown loading, validation, discovery, slugging, fallback-tour generation.
- `packages/web-player`: SvelteKit runtime, diagram rendering, overlays, browse, theme, diagnostics, viewport, minimap, zoom.
- `packages/cli`: startup orchestration, direct-path flow, wizard flow, browser policy, runtime packaging.

## Authoring Model
- Author inputs:
  - Mermaid diagram, or Markdown with Mermaid fences.
  - Optional `*.tour.yaml` for authored guidance.
- Tour v1 fields:
  - `version`
  - `title`
  - `diagram`
  - `steps`
- Step fields:
  - `focus`
  - `text`
- Flowchart focus: explicit node ids.
- Sequence focus: explicit participant ids + tagged message ids.
- Text references: `{{node_id}}` -> resolved label.
- Markdown authored tours may target a specific Mermaid block via fragment.

## Implemented Behavior
- Direct open: directory, Mermaid file, Markdown file, or tour file.
- Wizard open: current dir, another dir, or single file.
- Fallback tours for raw Mermaid/Markdown inputs.
- Flowchart support.
- Sequence support with addressable participants/messages.
- Tour validation for missing/invalid references.
- Generated steps for fallback walkthroughs.
- Step navigation: previous/next, URL step sync, deep links.
- Focus rendering: focused vs dimmed elements.
- Multi-focus groups.
- Viewport centering/panning for focused content.
- Canvas-first player layout.
- Teleprompter step overlay.
- Browse UI for selecting tours.
- Theme toggle with persistence.
- Minimap, viewport drag, zoom, fit-to-view.
- Clickable node-to-step navigation where mappings exist.
- Diagnostics/issues surface for invalid/discarded tours.
- Desktop/full-runtime smoke coverage for startup, browse, viewport, focus, theme, sequence, generated tours.

## Current UI Model
- Top bar: product identity, browse entry, diagnostics, theme, external links.
- Workspace: diagram canvas owns main space.
- Overlays: teleprompter, browse/diagnostics panels, camera controls.
- Camera controls: unified minimap + zoom panel.
