# Contributor Workflow

Human overview only. `AGENTS.md` is source of truth.

## Default Path

1. `product-manager` when scope is still defining what or why.
2. `tech-lead` when scope is clear but implementation still needs decisions.
3. Implement with `contract -> test -> code -> refactor`.
4. If code-related artifacts changed, run a separate reviewer thread or subagent.
5. Run `closeout-validate` with targeted checks only.
6. Use `repo-validate` or full commands only when exhaustive checks are needed.

## Code vs Non-Code

- Pure requirement discovery or technical planning does not require the separate reviewer loop.
- Code, tests, contract-visible docs, behavior-visible docs, startup flow, validation flow, and smoke-visible changes do require it.
- Separate review reduces author bias before closeout.

## Review Loop

- Reviewer reads issue or acceptance criteria, diff or touched files, `AGENTS.md`, and relevant docs directly.
- Implementing thread fixes or justifies material findings, then reruns reviewer.

## Validation Split

- `closeout-validate`: normal targeted closeout path
- `repo-validate`: exhaustive operator path

## Load More Only When Needed

- `README.md` for product-facing docs and setup
- `docs/runtime-loading.md` for startup or runtime loading changes
- `docs/authoring-guide.md` and `docs/tour-spec-v1.md` for authored tour or parser contract changes
- `docs/testing/smoke-tests.md` for smoke-visible work
- `docs/principles/08-engineering-review-rubric.md` for structural or refactor-heavy review
