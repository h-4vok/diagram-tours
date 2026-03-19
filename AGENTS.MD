# AGENTS

This repository is designed for AI-assisted delivery with Codex.

Before performing substantive work, always load:

- ENGINEERING_PLAYBOOK.md
- REPO_WORK_RULES.md
- DELIVERY_CHECKLIST.md
- README.md

These files define the repository engineering standards.

## Operating Model

- Work in bounded, user-visible capabilities.
- Respect package boundaries:
  - `packages/core`: domain model only
  - `packages/parser`: loading, parsing, validation, slugging, and discovery
  - `packages/web-player`: resolved-runtime UI only
  - `packages/cli`: startup orchestration only
- Do not move parsing responsibilities into the web player.
- Do not add filesystem, YAML, or UI concerns to `core`.
- Prefer tests that describe behavior rather than implementation details.
- Reuse existing examples and fixtures before inventing new patterns.

## Required Validation

Run the relevant checks before declaring work complete:

- `bun run lint`
- `bun run typecheck`
- `bun run test`

Also run:

- `bun run smoke` when startup flow, routing, UX, browse, viewport, theme, docs-visible behavior, or other user-visible runtime behavior changed
- `bun run build` when touching published packages, runtime packaging, or startup/runtime integration
- `bun run prepush` for cross-package or release-facing changes

Coverage must remain at `100%` for all enforced metrics.

## Documentation Rules

Update documentation in the same change when behavior, contracts, or contributor workflow changes.

Check these files when relevant:

- `README.md`
- `docs/runtime-loading.md`
- `docs/authoring-guide.md`
- `docs/adoption-onboarding.md`
- `docs/testing/smoke-tests.md`
- `docs/tour-spec-v1.md`

Repository-facing documentation must be written in English.

## Backlog Rule

If a delivered change materially updates an item tracked in `backlog.md`, update that backlog entry in the same change.

## UX Review Rule

If a change affects any of these areas, request a UX pass before final handoff:

- CLI startup or wizard behavior
- web-player navigation, browse, overlay, theme, diagnostics, viewport, or minimap
- README or onboarding/authoring documentation

UX here includes CLI messages, browser flows, and GitHub-read documentation, not only visual styling.

## Limits

- Do not create a new custom agent when the task fits a reusable skill or a repo-level rule.
- Do not create skills for one-off tasks with no repeated workflow.
- Do not hide which checks were run behind opaque automation.
- Do not treat `docs/reqs.md` as a sole source of truth without checking code and newer docs.

## Pull Request Rule

Creating or updating a pull request is not the end of the task.

When an agent opens or updates a PR, the task remains in progress until the relevant CI checks for that PR are green.

Agents must:

- wait for the PR checks to complete
- inspect failing checks if CI is red
- fix the failures, commit, and push follow-up changes as needed
- only report the PR as ready after the required PR checks are green
