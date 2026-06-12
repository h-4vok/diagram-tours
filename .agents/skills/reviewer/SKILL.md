---
name: reviewer
description: Review current code-related change set against repo rules and work-item intent, then return findings, open questions, validation gaps, and a verdict.
---

# Reviewer

Use this skill for normal review of a code-related work item. Advisory only. No fixes. Does not replace `closeout-validate`.

## When to use

- Use when current work item changed code-related artifacts.
- Code-related artifacts include code, tests, contract-visible docs, behavior-visible docs, startup flow, validation flow, or smoke-visible behavior.
- Do not use for pure requirement-definition or technical-planning work with no code-related file changes.

## Sources of truth

- issue, acceptance criteria, or explicit work-item definition
- current diff, touched files, or named change set
- `AGENTS.md`
- relevant docs for changed behavior or contracts

Read those directly. Do not rely on human-copied summaries when repo truth is available.

## Scope rules

- Default scope: changed files for current work item.
- Stay centered on current task unless caller asks for wider scope.
- Do not turn it into repo-wide audit.

## Review priorities

- bugs
- regressions
- contract drift
- missing or weak tests
- doc drift for changed behavior or contracts
- validation gaps
- architecture or boundary violations when relevant

For structural or refactor-heavy changes, you may also apply `architecture-reviewer` lens, but this stays normal code review first.

## What not to do

- do not implement fixes
- do not prescribe large redesigns unless needed to explain risk
- do not perform repo-wide audit unless explicitly requested
- do not duplicate full repo policy when one reference is enough

## Output contract

Use this exact top-level structure:

## Findings

- one flat bullet per finding
- include file references when applicable
- if there are no findings, write exactly `No findings.`

## Open Questions

- one flat bullet per unresolved question
- if there are no open questions, write exactly `None.`

## Validation Gaps

- one flat bullet per missing or weak validation point
- if there are no validation gaps, write exactly `None.`

## Verdict

Write exactly one of:

- `Pass`
- `Pass with risks`
- `Needs fixes`

## Output style

- plain Markdown
- findings first
- verdict last
- English only
