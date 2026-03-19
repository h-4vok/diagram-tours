---
name: tour-authoring
description: Create or review authored tours, fixtures, and examples for diagram-tours. Use when adding or editing `*.tour.yaml`, Markdown Mermaid examples, authoring docs, or test fixtures that should follow the repository's tour conventions.
---

# Tour Authoring

Author tours that match the repo's real contract, not a generic YAML style.

## Follow these rules

1. Keep tours next to their diagrams when possible.
2. Use stable Mermaid IDs.
3. Write `4-8` steps unless the fixture needs a narrower shape.
4. Keep each step focused on one component, one handoff, one phase, or one reset.
5. Use `focus: []` intentionally for overview or reset states.
6. Use `{{node_id}}` references instead of hardcoding labels when text should track diagram labels.

## Check before editing

- `docs/authoring-guide.md`
- `docs/tour-spec-v1.md`
- sibling examples in `examples/`
- related fixtures in `fixtures/`

## Validate common pitfalls

- missing root fields
- empty `steps`
- invalid or unknown focus IDs
- invalid text references
- Markdown fragments that do not point at the intended Mermaid block

## Useful preview commands

- `diagram-tours ./examples/payment-flow/payment-flow.tour.yaml`
- `diagram-tours ./examples/payment-flow/payment-flow.mmd`
- `bun run dev ./examples/payment-flow/payment-flow.tour.yaml`

## Output

- State what the tour teaches.
- Mention any fixture-specific compromise.
- List the preview or validation commands that should be run.
