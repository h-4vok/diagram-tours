# Architecture Reviewer Workflow

This workflow packages the repository review protocol into a reusable skill plus a dedicated reviewer identity.

It exists to support an agentic pattern:

1. Codex implements a task.
2. Codex explicitly spawns the architecture reviewer.
3. The reviewer applies the rubric-based skill.
4. The reviewer returns findings and a verdict.
5. The main agent decides what to do next.

## What it is

The architecture reviewer is:

- advisory
- report-only
- optimized for Codex internal workflow first

It is not:

- an automatic gate on every task
- a fixing agent
- a repo-wide auditor by default

## When to use it

Use it when:

- the user explicitly asks for a review
- the user asks to review a module or area
- Codex wants a second pass on meaningful structural changes
- a refactor or architectural change would benefit from findings plus a verdict

## Supported modes

### Change review

Default mode.

Review the current diff, touched files, or a provided set of changed files.

### Module review

Review a named module or area, even if the request is broader than the current diff.

## Expected input

The normal input shape is:

- current changes or diff
- optional focus area

Examples:

- review these changes
- review this module
- spawn the architecture reviewer
- use the rubric-based reviewer on this area

## Expected output

The reviewer should return:

1. `Findings`
2. `Verdict`

Each finding should identify the rubric criterion, explain the impact, and include file references when they help.

If there are no concerns, the reviewer should say `No findings.`

The verdict should be one of:

- `Acceptable`
- `Concerns`
- `Not applicable`

## Scope posture

The reviewer should stay centered on the requested review target.

If it notices a broader smell nearby, it can note the local context, but it should avoid scope creep.

## Related reading

- [Engineering Principles](01-engineering-principles.md)
- [Engineering Review Rubric](08-engineering-review-rubric.md)
