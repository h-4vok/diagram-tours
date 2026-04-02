---
name: closeout-validate
description: Validate touched files before closing a task and report the exact checks that ran.
---

# Closeout Validate

Use this skill when you are finishing a normal change and need to prove the touched files were validated.

## Workflow

1. Inspect the touched files first.
2. Pick only the checks that apply to those files and that behavior:
   - modified JS/TS/Svelte/CSS files: `bun run lint`
   - affected Vitest files: `bun run test`
   - touched smoke specs or runtime-visible UI/CLI paths: `bun run smoke`
   - affected package only: `bun run typecheck`
3. Fix failures immediately and rerun the smallest relevant check.
4. Stop when the touched files are covered and the relevant checks are green.

## Closeout report

- List the touched files you inspected.
- List every command you ran.
- Mark pass/fail for each command.
- Say why smoke or typecheck was needed, or why they were intentionally skipped.
- Do not claim a task is done without this report.

## Guardrails

- This is the normal closeout path, not the operator exhaustive-validation path.
- Do not replace targeted checks with repo-wide commands unless the change truly requires it.
