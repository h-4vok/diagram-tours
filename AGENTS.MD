# AGENTS

Load first:
- `AGENTS.md`

Load on demand:
- `README.md` for product-facing docs, setup, install, or public CLI/docs changes
- `docs/contributor-workflow.md` for the human overview of PM -> Tech Lead -> implementation -> review -> closeout
- `docs/runtime-loading.md` for startup, target resolution, or runtime-loading work
- `docs/authoring-guide.md` and `docs/tour-spec-v1.md` for authoring, parser, or contract-visible tour work
- `docs/testing/smoke-tests.md` for smoke-visible work
- `docs/principles/08-engineering-review-rubric.md` for structural or refactor-heavy review

## Workflow
- Task shape: bounded capability; user-visible, contract-visible, validation-visible, or delivery-unblocking infra.
- Flow: contract -> test -> code -> refactor -> closeout-validate -> operator validation.
- Code-related work only: if a task changes code, tests, contract-visible docs, behavior-visible docs, startup flow, validation flow, or smoke-visible behavior, the implementing thread must raise a separate reviewer thread/subagent before final closeout.
- Non-code work only: requirement definition and technical planning do not require reviewer by themselves unless that thread also changes code-related artifacts.
- Reviewer loop: reviewer must inspect source-of-truth inputs directly, including issue or acceptance criteria, current diff or touched files, `AGENTS.md`, and relevant docs. Do not hand-copy review context into the reviewer thread.
- Findings loop: if reviewer reports material findings, the implementing thread must fix them or justify them, then rerun reviewer before `closeout-validate`.
- Prefer behavior tests, small pure functions, guard clauses, explicit data.
- Avoid helper-only tasks, unrelated bundles, hidden side effects, undocumented contract changes.
- Reuse examples/fixtures before new patterns.

## Communication
- Use the `caveman` skill by default for all Codex responses in this repo.
- Stay in Caveman mode unless the user explicitly asks for normal mode or the message needs clearer phrasing for safety, irreversible actions, or multi-step instructions.

## Boundaries
- `packages/core`: domain only. Models, types, resolved tour/domain contracts, UI-agnostic logic. No filesystem, YAML, CLI, browser, or Svelte.
- `packages/parser`: loading, parsing, validation, discovery, slugging, and resolved outputs. No UI.
- `packages/web-player`: resolved-runtime UI only. SvelteKit player, overlays, focus state, viewport, browse, diagnostics, and theme. No raw parsing responsibilities.
- `packages/cli`: startup orchestration only. Args, wizard, startup target selection, server/browser launch, and runtime packaging. No parser/web-player leakage of startup policy.
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
- Separate reviewer does not replace `closeout-validate`. Review first, then targeted validation, then operator validation.
- Lint: modified JS/TS/Svelte/CSS files only.
- Tests: affected Vitest files only. No full suite.
- Smoke: touched smoke spec only. No full smoke.
- Typecheck: affected package only.
- Fix failures immediately.
- Final message: list targeted checks passed.
- Exhaustive checks: operator-run via `repo-validate`.
- Full commands: `allchecks:ai`, full smoke, full test suite, repo-wide lint/typecheck/build/prepush`.
- Validation requests: run exact requested command; for exhaustive or narrow requests, send failing summary or failing file/assertion/stack only when the user asks for fail-only output.
- Delivery ready: targeted checks passed; operator confirms exhaustive checks when relevant; coverage stays 100%.
- Do not use `repo-validate` as the normal closeout path for a single change.
- Browser-visible/runtime/startup/docs-visible changes: operator runs smoke.
- Cross-package/release-facing changes: operator runs full validation.

## Docs / Tracking
- Update docs when behavior, contracts, startup flow, validation flow, or contributor workflow changes.
- Default docs context is `AGENTS.md`.
- Load other docs only when task touches their area.
- Track backlog and planning work in GitHub Issues, not repo-local backlog files.
- `docs/reqs.md`: reference only after checking code/newer docs.

## UX / PR
- Request UX pass for CLI startup/wizard, web-player navigation/browse/overlay/theme/diagnostics/viewport/minimap, or README/onboarding/authoring docs changes.
- Do not hide checks behind opaque automation; report exact commands the operator should run.
- Do not create one-off custom agents/skills when repo rules or reusable skills fit.
- PR work not done until required CI is green.
- If CI fails: inspect, fix, push, recheck.

## Some important skills
- `product-manager`: requirement discovery and issue refinement. Non-code by default.
- `tech-lead`: technical planning after product scope is clear. Non-code by default.
- `reviewer`: normal code-related change review after implementation.
- `architecture-reviewer`: structural or refactor-heavy review when normal review needs design lens.
- `closeout-validate`: targeted validation before closing a task.
- Specialized review/reference skills are on-demand only. Do not preload them as default context.
