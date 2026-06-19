# Adoption Onboarding

Use this guide when you want a team or repository to start getting value from `diagram-tours` quickly, before you invest in a larger authoring workflow.

## What You Can Start With

`diagram-tours` does not require authored tours on day one.

You can adopt it from any of these existing inputs:

- a directory that contains supported diagram or tour files
- a single authored `*.tour.yaml` file
- a single Mermaid diagram such as `.mmd` or `.mermaid`
- a single Markdown file with one or more fenced `mermaid` blocks

If you only have raw diagrams, the player still opens them and generates a fallback walkthrough automatically.

## Fastest Path To First Value

If your repository already has Mermaid diagrams or Markdown files with Mermaid fences, start by previewing them directly.

Wizard flow:

```bash
diagram-tours
```

Direct preview of one authored tour:

```bash
diagram-tours ./examples/flowchart/checkout-payment-flow.tour.yaml
```

Direct preview of one Mermaid diagram:

```bash
diagram-tours ./examples/flowchart/checkout-payment-flow.mmd
```

Direct preview of one Markdown file with Mermaid:

```bash
diagram-tours --open ./docs/interview-offers-pipeline.md
```

Directory preview:

```bash
diagram-tours ./examples
```

Use direct single-file preview when you want a focused authoring session. Use directory mode when you want discovery across a repository or documentation area.

For direct targets, pass `--open` or open the printed localhost URL manually. Direct mode validates the target and prints the URL, but it does not launch the browser by default.

## What The Runtime Loads

The current published CLI and runtime support these startup targets:

- directory targets containing authored tours, raw Mermaid diagrams, or both
- a single `*.tour.yaml` file for authored preview
- a single `.mmd`, `.mermaid`, or `.md` file for generated fallback preview

Important behavior:

- no positional target starts the wizard
- direct targets skip the wizard
- direct targets do not open the browser unless you pass `--open`
- the wizard can open the current directory, another directory, or one diagram or `*.tour.yaml` file
- if a Markdown file contains multiple Mermaid blocks, single-file preview returns one generated entry per block

## Recommended Team Adoption Path

1. Start by previewing the diagrams you already have.
2. Keep raw Mermaid files useful on their own so fallback tours are still readable.
3. Add authored `*.tour.yaml` files only for diagrams that need curated explanation.
4. Keep tour files next to their diagram source with matching stems.
5. Add repository-local guidance so people and AI tools follow the same conventions.

Good sibling naming:

```text
payment-flow.mmd
payment-flow.tour.yaml
```

This keeps preview, authoring, and repo browsing predictable.

## When To Add Authored Tours

Stay with raw diagrams when the fallback walkthrough is enough.

Add a `*.tour.yaml` file when you need:

- better tour titles
- curated step ordering
- custom step text
- focused explanations for specific nodes or messages
- label interpolation such as `{{api_gateway}}`

Markdown-backed tours are valid too. If one Markdown file has multiple Mermaid blocks, an authored tour should target the intended block with a fragment such as:

```yaml
diagram: ./checklist.md#details
```

## Authoring Helpers

Use the shipped CLI helpers when you want a repeatable repository setup:

```bash
diagram-tours setup
diagram-tours init ./examples/flowchart/checkout-payment-flow.mmd
diagram-tours init ./fixtures/markdown/checklist.md#details
diagram-tours init ./examples/flowchart/new-flow.tour.yaml
diagram-tours validate
diagram-tours validate ./examples
diagram-tours validate ./examples/flowchart/checkout-payment-flow.tour.yaml
```

Current behavior:

- `setup` creates `.diagram-tours/instructions.md` and can optionally install a Codex subagent definition
- `init <target>` can scaffold from `.mmd`, `.mermaid`, `.md`, or a new `*.tour.yaml` path
- `validate [target]` validates authored `*.tour.yaml` files only; it does not validate raw diagrams
- `init ./examples/flowchart/new-flow.tour.yaml` is a create-new example: it creates that authored tour file and a sibling starter `.mmd` diagram

## Onboarding AI Assistants

The most useful adoption work for AI is usually repository clarity, not custom automation.

Recommended conventions:

- keep tours next to diagrams
- use matching stems for diagram and tour files
- commit `.diagram-tours/instructions.md`
- mention `diagram-tours` support in the main README
- keep one or two small examples that model the preferred tour style

Practical baseline prompt:

```text
This repository uses diagram-tours.
When you find a Mermaid `.mmd`, `.mermaid`, or Markdown file with fenced `mermaid` blocks,
create a sibling `*.tour.yaml` that explains the diagram in 4-8 steps.
Use existing Mermaid node IDs in `focus` and `{{node_id}}` references.
Preview with `diagram-tours <path>`.
Validate with `diagram-tours validate <path>`.
```

## Suggested Rollout

1. Announce that raw Mermaid and Markdown diagrams can already be previewed.
2. Add `diagram-tours setup` output to repositories that want consistent authoring guidance.
3. Introduce authored tours only for the diagrams that need explanation, review, or demos.
4. Standardize validation with `diagram-tours validate` before handoff.

## Related Docs

- [README](../README.md)
- [Runtime Loading](./runtime-loading.md)
- [Authoring Guide](./authoring-guide.md)
- [Tour Specification v1](./tour-spec-v1.md)
