# Adoption And Onboarding Notes

This note captures current product ideas for helping both people and AI assistants discover, author, and adopt `diagram-tours`.

It is intentionally lightweight. The goal is to preserve the direction so future backlog work can turn it into concrete product and documentation changes.

## Problem Framing

Early users will often have one of these states:

- Mermaid diagrams but no `*.tour.yaml` files
- Markdown files where AI already embedded Mermaid blocks
- no idea that `diagram-tours` exists or what file shape it expects

AI assistants have a similar discovery problem:

- they do not know the repository supports `diagram-tours`
- they do not know where diagrams should live
- they do not know how to create a valid authored tour without a local example

## Onboarding For People

Near-term ideas:

- keep the README strongly end-user-first
- document the three valid inputs clearly:
  - directory
  - standalone Mermaid file
  - Markdown file with fenced Mermaid blocks
- make fallback tours feel useful immediately so a user gets value before authoring YAML
- provide one minimal copy-pasteable `*.tour.yaml` example near the top of the docs

Potential product improvements:

- `diagram-tours init` to scaffold a local example and project guidance
- `diagram-tours export-template <diagram>` to generate a starter YAML from a raw diagram
- friendlier empty-state guidance when a directory has diagrams but no authored tours yet

## Onboarding For AI Assistants

The strongest pattern is to make repository support legible through small, repeated conventions.

Recommended repository conventions:

- keep tours next to diagrams
- use predictable sibling names:
  - `payment-flow.mmd`
  - `payment-flow.tour.yaml`
- add a small repository marker file such as `.diagram-tours/instructions.md`
- mention `diagram-tours` support in the main README

Useful AI-facing guidance to standardize:

- where diagrams live
- where tours should be written
- how to preview them locally
- how many steps a good starter tour should have
- how node IDs should be referenced in authored text

## Candidate AI Helper Artifacts

Potential repository artifacts:

- `.diagram-tours/instructions.md`
- `.diagram-tours/manifest.json`
- a short "For AI assistants" section in `README.md`
- a tiny authored example that models the preferred style

Potential CLI helpers:

- `diagram-tours init`
- `diagram-tours export-template <diagram>`
- `diagram-tours print-prompt <diagram>`

## Candidate AI Prompt Shape

One practical baseline prompt:

```text
This repository uses diagram-tours.
When you find a Mermaid `.mmd`, `.mermaid`, or Markdown file with fenced `mermaid` blocks,
create a sibling `*.tour.yaml` that explains the diagram in 4-8 steps.
Use existing Mermaid node IDs in `focus` and `{{node_id}}` references.
Preview with `diagram-tours <path>`.
```

## Suggested Delivery Order

1. Add an adoption/onboarding section to the README.
2. Introduce a small repository convention for AI-readable instructions.
3. Add a scaffold helper such as `diagram-tours init`.
4. Add a template exporter for authored tour generation.
