# AGENTS

Load first:
- `AGENTS.md`
- `README.md`

## Workflow
- Task shape: bounded capability; user-visible, contract-visible, validation-visible, or delivery-unblocking infra.
- Flow: contract -> test -> code -> refactor -> operator validation.
- Prefer behavior tests, small pure functions, guard clauses, explicit data.
- Avoid helper-only tasks, unrelated bundles, hidden side effects, undocumented contract changes.
- Reuse examples/fixtures before new patterns.

## Boundaries
- `packages/core`: domain only. No filesystem, YAML, CLI, browser, Svelte.
- `packages/parser`: loading, parsing, validation, discovery, slugging. No UI.
- `packages/web-player`: resolved-runtime UI only. No raw parsing responsibilities.
- `packages/cli`: startup orchestration only. No parser/web-player leakage of startup policy.
- Do not move parsing into `web-player`.
- Do not add filesystem, YAML, or UI concerns to `core`.

## Guardrails
- Coverage: 100% statements, branches, functions, lines.
- Complexity <= 3.
- Nesting <= 3.
- Function length <= 30 lines unless justified.
- Arity <= 3; else object param.
- No floating promises.
- No unnecessary conditional guards.
- Exhaustive unions/switches.
- Lint, typecheck, tests: pass.
- Contract/docs changes: same change.
- Repo-facing docs: English.

## Validation
- Heavy checks: operator-run. Do not run `lint`, `typecheck`, `test`, `smoke`, `build`, `prepush` autonomously.
- Default request: `Run bun run allchecks:ai and send failing summary only.`
- `allchecks:ai` = `prepush` alias with normal logs.
- Narrow request when needed: `Run [command]; send failing file/assertion/stack only.`
- Do not request full logs when summary/trace is enough.
- Analyze summary, stack trace, failing assertion, failing file.
- TDD stays mandatory: contract -> failing test -> code -> operator validation.
- Delivery ready only after operator confirms relevant checks passed and coverage stayed 100%.
- Browser-visible/runtime/startup/docs-visible changes: operator should run smoke.
- Cross-package/release-facing changes: operator should run full validation.

## Docs / Tracking
- Update docs when behavior, contracts, startup flow, validation flow, or contributor workflow changes.
- Check when relevant: `README.md`, `docs/runtime-loading.md`, `docs/authoring-guide.md`, `docs/adoption-onboarding.md`, `docs/testing/smoke-tests.md`, `docs/tour-spec-v1.md`.
- If `backlog.md` item changed materially, update it in same change.
- `docs/reqs.md`: reference only after checking code/newer docs.

## UX / PR
- Request UX pass for CLI startup/wizard, web-player navigation/browse/overlay/theme/diagnostics/viewport/minimap, or README/onboarding/authoring docs changes.
- Do not hide checks behind opaque automation; report exact commands the operator should run.
- Do not create one-off custom agents/skills when repo rules or reusable skills fit.
- PR work not done until required CI is green.
- If CI fails: inspect, fix, push, recheck.

## Package Scopes
- `core`: models, types, resolved tour/domain contracts, UI-agnostic logic.
- `parser`: Mermaid/YAML/Markdown ingestion, validation, discovery, slugging, resolved outputs.
- `web-player`: SvelteKit player, overlays, focus state, viewport, browse, diagnostics, theme.
- `cli`: args, wizard, startup target selection, server/browser launch, runtime packaging.
