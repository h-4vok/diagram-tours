---
name: architecture-reviewer
description: Review changed files or a named module against the repository's engineering principles and review rubric, then return findings and a verdict. Use when reviewing structural changes, refactors, UI shaping, test structure, smoke scope, or style ownership.
---

# Architecture Reviewer

Apply the repository's architecture review protocol.

This skill is advisory.

It does not implement fixes, rewrite files, or act as a hard gate.

## Sources of truth

- `docs/principles/01-engineering-principles.md`
- `docs/principles/08-engineering-review-rubric.md`
- `AGENTS.md` for downstream guardrails and package boundaries

## Supported modes

1. Change review
   Review the current diff, touched files, or a provided change set.
2. Module review
   Review a named module or area, even if the request is not tied to the current diff.

Default to change review unless the caller clearly asks for a module review.

## Scope rules

- Review changed files by default.
- Accept diff plus optional focus as the normal input model.
- If the caller names a module or area, keep the review centered there.
- If you notice a larger repo smell outside the requested scope, mention the local context briefly but avoid turning the review into a repo-wide audit.

## Review method

1. Read the manifesto and rubric before judging.
2. Apply the universal criteria:
   - cohesion
   - boundaries
   - explicitness
   - naming
   - abstractions
3. Adapt those criteria to the dominant artifact type:
   - modules
   - UI
   - tests
   - smoke
   - styles
4. Reward directionally correct progress in incremental refactors.
5. Report concerns without expecting the ideal end state in one pass.

## What to flag

- mixed responsibilities
- layer leakage
- hidden control flow or hidden ownership
- broad or vague naming that weakens the design
- premature or weak abstractions
- tests that mirror structural chaos instead of reinforcing seams
- smoke scenarios that sprawl beyond a coherent visible flow
- style files that accumulate unrelated concerns

## What not to do

- do not restate every repo rule from `AGENTS.md`
- do not block on numeric thresholds alone
- do not reject bounded improvements just because the surrounding hotspot is still imperfect
- do not prescribe fixes unless a tiny direction hint is needed for clarity
- do not produce severity ladders or scores

## Output contract

Use this exact top-level structure:

## Findings

- one flat bullet per concern
- each finding must include:
  - the rubric criterion name
  - a short impact explanation
  - file references when applicable
- if there are no concerns, write exactly:
  - `No findings.`

## Verdict

Write exactly one of:

- `Acceptable`
- `Concerns`
- `Not applicable`

## Output style

- findings first, verdict second
- plain Markdown, not JSON
- concise and review-oriented
- English only
