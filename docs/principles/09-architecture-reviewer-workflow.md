# Architecture Reviewer Workflow

This is reference for `architecture-reviewer`, not the general contributor workflow.

For the repo-wide human flow, use [`../contributor-workflow.md`](../contributor-workflow.md).

## When this doc matters

Use it when a change needs a structural or refactor-heavy review beyond the normal `reviewer` pass.

## Expected pattern

1. Main agent implements or prepares the change.
2. Main agent invokes `architecture-reviewer`.
3. Reviewer reads:
   - `AGENTS.md`
   - `01-engineering-principles.md`
   - `08-engineering-review-rubric.md`
   - current diff or named module scope
4. Reviewer returns `Findings` and `Verdict`.
5. Main agent decides whether follow-up changes are needed.

## Output contract

- `Findings`
- `Verdict`

Verdict must be one of:

- `Acceptable`
- `Concerns`
- `Not applicable`

## Related reading

- [Engineering Principles](01-engineering-principles.md)
- [Engineering Review Rubric](08-engineering-review-rubric.md)
- [Contributor Workflow](../contributor-workflow.md)
