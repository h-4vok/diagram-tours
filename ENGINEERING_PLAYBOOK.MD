# Engineering Playbook

This document defines the engineering workflow and implementation discipline for the Diagram Tour project.

## Delivery Mode

This repository operates in **delivery mode** by default.

Delivery mode means Codex is expected to complete a bounded task end to end without artificial pause points between design, tests, implementation, and refactoring.

The default execution model is:

1. clarify the capability being delivered
2. define or confirm the contract and boundaries
3. write or update tests first
4. implement the minimum behavior
5. refactor safely
6. leave the repository green
7. update documentation when behavior or contracts change
8. provide a concise delivery summary for review

The owner defines direction, priorities, and desired capabilities. Codex owns the technical path to a working delivery unless a decision is explicitly escalated.

## TDD Workflow

TDD in this repository is an autonomous red-green-refactor cycle completed within a single delivery.

Every substantive change should follow this sequence:

1. define the expected behavior through a test or contract check
2. run the relevant checks and confirm the failing condition
3. implement the minimum code needed to make the change pass
4. refactor while preserving green tests
5. run the required checks before declaring the work complete

This repository does not use a stop-and-wait workflow between tests and implementation. Codex is expected to carry the cycle through to a green state before handing work back for review.

## Engineering Principles

Prefer:

- contracts first
- guardrails first
- small pure functions
- guard clauses
- composable utilities
- explicit data structures
- clear tests that describe behavior, not internals
- refactoring only while preserving a green test suite

Avoid:

- large functions
- nested conditionals
- hidden side effects
- tightly coupled modules
- mixing parsing, domain logic, and UI logic in the same unit
- undocumented contract changes

## Quality Guardrails

The repository enforces strong guardrails and they are part of normal development, not optional cleanup.

- lint rules must pass
- test coverage must remain at `100%` for statements, branches, functions, and lines
- cyclomatic complexity must remain at or below `3`
- block nesting depth must remain at or below `3`
- function bodies should stay at or below `30` lines unless a narrower exception is explicitly justified
- function arity must remain at or below `3`
- if more inputs are required, prefer an object parameter
- floating promises are not allowed
- unnecessary conditional guards are not allowed
- discriminated unions and similar switches must remain exhaustive
- type checks must pass
- the final relevant test suite must pass

## Documentation Expectations

When behavior, contracts, or developer workflow changes, update the relevant documentation in the same delivery.

Repository-facing documentation should be written in English unless a task explicitly requires another language.

Examples include:

- update product contract docs when the tour format changes
- update examples when they better explain the delivered capability
- update README when contributor-facing expectations change
- update runtime or startup docs when source-target resolution, CLI entrypoints, or developer launch flows change
- update delivery or engineering docs when the operating model changes

## Decision Records

Important architecture decisions should be recorded in `docs/adr/` when that directory is introduced.
