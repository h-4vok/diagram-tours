# Backlog

This file serves as the project's operational backlog. We update it as the real product state changes.

Initial source: a contrast between [`docs/reqs.md`](docs/reqs.md), the current codebase, and the repository's living documentation.

## Conventions

- `In Progress`: started and integrated in the repository, but not yet closed
- `Partial`: partially implemented or not yet fully aligned with the intended requirement
- `Todo`: not implemented yet

Los items q pasan a `Done` deben ser enviados a backlog.done.md

## Snapshot

Cutoff date: 2026-03-17

### Todo
- `BT-01` Improve sequence-diagram highlighting quality
  - Note: sequence diagrams are functional today, but their current focus/highlight treatment still feels weaker than the flowchart experience
- `BT-02` Another theme pass
  - Note: the current palette is serviceable, but the overall color choices still need another intentional design pass
- `BT-03` Improve dark-mode treatment for sequence diagrams
  - Note: dark mode remains noticeably weaker on sequence diagrams than on the rest of the player and still needs a dedicated visual pass
- `BT-04` Stepper and step-text presentation redesign
  - Note: the current overlay works functionally, but the step pills and text presentation should be revisited together
- BT-010 `diagram-tours init` scaffolding for new authored tours
  - Note: add a CLI command that can create a new `*.tour.yaml` from scratch, or inspect an existing Mermaid source and scaffold a starter tour with the right `diagram` target and step structure
- BT-011 Installable authoring reference for AI agents and repository tooling
  - Note: add a command that installs a reusable Markdown reference describing the `tour.yaml` standard so files like `AGENTS.md` or other agent instructions can point to one stable doc for Codex, Claude Code, and similar tools
- BT-013 Adoption and onboarding strategy for people and AI assistants
  - Note: preserve both product onboarding and AI discoverability as a dedicated initiative rather than letting it live only in chat history
  - Pending: turn the ideas in `docs/adoption-onboarding.md` into concrete README, repository-convention, and CLI work
- `BT-09` Keyboard shortcuts and navigation that stay consistent across the browse panel and the diagram
  - Note: we want to treat this as a unified initiative later, rather than mixing it into the initial browse explorer work
  - Pending: define a shared shortcuts model, focus behavior, discoverability, and key-conflict handling
- `BT-10` True zoom-to-fit
  - Note: a simple overview recentering helper exists internally, but it is currently hidden because it does not provide actual zoom semantics
- `BT-11` Step-overlay redesign after minimap integration
  - Note: the current step overlay now stacks above the minimap and is good enough for v1, but it should be revisited as part of a more intentional navigation/stepper layout
- `BT-12` Smarter group centering
  - Note: grouped centering exists today, but not a more advanced strategy than the current one
- `BT-13` Explicit viewport constraints
  - Note: no current implementation was found in the repository
- BT-027 Clean-code refactoring initiative: repository framework and manifesto
  - Note: define the repository's clean-code and refactoring framework first, including cohesion, responsibility boundaries, architectural direction, and how to adapt clean architecture and SOLID principles to idiomatic TypeScript and Svelte
  - Related: this is step 1 of the clean-code refactoring initiative and should use `docs/clean-code-refactoring.md` as reference input
- BT-028 Clean-code refactoring initiative: review rubric and decision criteria
  - Note: translate the framework into an explicit review rubric so future refactors and PR reviews can evaluate cohesion, responsibility boundaries, orchestrator exceptions, and meaningful modularity instead of relying on vague style preferences
  - Related: this is step 2 of the clean-code refactoring initiative, depends on BT-027, and should reference `docs/clean-code-refactoring.md`
- BT-029 Clean-code refactoring initiative: reusable architecture reviewer
  - Note: create a reusable reviewer skill or subagent that applies the repository-specific rubric during refactoring and future PR reviews, focusing on architectural cohesion and mixed responsibilities rather than acting as simple LOC police
  - Related: this is step 3 of the clean-code refactoring initiative, depends on BT-028, and should reference `docs/clean-code-refactoring.md`
- BT-030 Clean-code refactoring initiative: phased repository refactor program
  - Note: execute the refactoring gradually across the repository in phases, guided by the framework and rubric rather than by arbitrary max-lines thresholds, and use the work to discover the natural target shape for each source, test, smoke, Svelte, and style file category
  - Related: this is step 4 of the clean-code refactoring initiative, depends on BT-029, and should reference `docs/clean-code-refactoring.md`
- BT-031 Clean-code refactoring initiative: post-refactor guardrails and LOC alarms
  - Note: after the repository has gone through the initial refactoring baseline, define and enforce hard LOC and related tooling guardrails per file type so they protect the intended architecture instead of distorting it
  - Related: this is step 5 of the clean-code refactoring initiative, depends on BT-030, and should reference `docs/clean-code-refactoring.md`

## Notes

- `docs/reqs.md` is partially out of date relative to the real project state.
- In particular, it understates capabilities that already exist today: file/directory preview, guided recovery for invalid routes, theme persistence, empty-focus support, and smoke coverage for viewport behavior and large diagrams.
- When something from `Todo` is implemented, it should be moved to `Done` or `Partial` in this file in the same commit.
