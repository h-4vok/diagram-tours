# AGENTS

Load first:
- `AGENTS.md`
- `README.md`

## Workflow
- Task shape: bounded capability; user-visible, contract-visible, validation-visible, or delivery-unblocking infra.
- Flow: contract -> test -> code -> refactor -> closeout-validate -> operator validation.
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
- Before done: run `closeout-validate` on the touched files and report the exact checks run.
- Lint: modified JS/TS/Svelte/CSS files only.
- Tests: affected Vitest files only. No full suite.
- Smoke: touched smoke spec only. No full smoke.
- Typecheck: affected package only.
- Fix failures immediately.
- Final message: list targeted checks passed.
- Exhaustive checks: operator-run via `repo-validate`.
- Full commands: `allchecks:ai`, full smoke, full test suite, repo-wide lint/typecheck/build/prepush.
- Operator request: `Run bun run allchecks:ai; send failing summary only.`
- Narrow request: `Run [command]; send failing file/assertion/stack only.`
- Analyze summary, stack, failing assertion, failing file.
- Delivery ready: targeted checks passed; operator confirms exhaustive checks when relevant; coverage stays 100%.
- Do not use `repo-validate` as the normal closeout path for a single change.
- Browser-visible/runtime/startup/docs-visible changes: operator runs smoke.
- Cross-package/release-facing changes: operator runs full validation.

## Docs / Tracking
- Update docs when behavior, contracts, startup flow, validation flow, or contributor workflow changes.
- Check when relevant: `README.md`, `docs/runtime-loading.md`, `docs/authoring-guide.md`, `docs/adoption-onboarding.md`, `docs/testing/smoke-tests.md`, `docs/tour-spec-v1.md`.
- Track backlog and planning work in GitHub Issues, not repo-local backlog files.
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

## Some important skills

- `product-manager`: `/.agents/skills/product-manager/SKILL.md` for requirement discovery/refinement. Interview the user, work through GitHub Issues directly, and finish by labeling the issue `pm-done`.
- `tech-lead`: `/.agents/skills/tech-lead/SKILL.md` for technical planning after product scope is clear.
