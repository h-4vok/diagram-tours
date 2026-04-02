# Engineering Principles

This document is the repository's north star for clean code and refactoring decisions.

It exists to help contributors and agents make better design choices before lint, tests, or review catch preventable problems.

It does not replace [`AGENTS.md`](../../AGENTS.md).

`AGENTS.md` contains operational rules and concrete guardrails.

This document explains the design direction those guardrails are trying to protect.

## Purpose

We want a codebase that stays easy to change, easy to review, and easy to trust.

That does not happen by accident.

It requires a bias toward cohesive modules, visible boundaries, explicit behavior, and small safe refactors.

Metrics such as LOC, complexity, or function length are downstream alarms.

They matter, but they are not the goal.

The goal is software that remains understandable as the repository grows.

## Core Principles

### Cohesion First

Each file, module, and test should have a clear job and a clear reason to change.

Related code belongs together.

Different responsibilities do not.

When a file starts coordinating parsing, validation, mapping, presentation, persistence, and error handling at once, the design has already drifted.

### Respect Boundaries

The repository is intentionally layered.

Domain, parsing, UI, and startup orchestration should remain distinct concerns.

Crossing a boundary should feel deliberate and visible.

If code becomes easier to write by ignoring a boundary, that is usually a sign that the boundary is doing useful work.

### Prefer Explicitness

Code should make important behavior obvious.

Choose direct control flow, explicit data shapes, and intention-revealing names over cleverness, hidden side effects, or convenience abstractions that blur meaning.

A reader should not need to reverse-engineer where the real work happens.

### Use Naming As Design

Good names are not cosmetic.

They are part of the architecture.

Names should reveal responsibility, scope, and level of abstraction.

When naming becomes vague, broad, or overloaded, design quality usually follows.

### Earn Abstractions

Do not abstract early to feel organized.

Abstract when a responsibility is stable, repeated, or clearer behind a boundary.

A good abstraction removes duplication in meaning, not just duplication in text.

### Be Pragmatic, Preserve Direction

We value delivery, but not at the cost of losing the architecture entirely.

Pragmatic tradeoffs are acceptable when they are explicit, local, and directionally correct.

Exceptions should be rare and easy to justify in review.

### Principles, Not Classes

This repository borrows from clean code, clean architecture, and SOLID.

It does not require class-heavy OOP as the default expression of those ideas.

In TypeScript and Svelte, small modules, pure functions, thin adapters, and explicit orchestration are often better tools than layers of classes.

Keep the principles.

Choose the most idiomatic implementation shape for the platform.

## Named Anti-Patterns

### Mixed Responsibilities

This is the primary smell in the repository.

It appears when one file or test absorbs multiple reasons to change and becomes the default home for loosely related logic.

A large file is not automatically wrong.

A file that mixes too many concerns is.

### Layer Leakage

This is a secondary smell and usually follows the first.

It appears when one layer quietly takes work that belongs to another, or when a boundary becomes so porous that responsibilities stop being clear.

Code can still work while the design degrades.

That is exactly why this smell matters.

## Refactoring Principles

Refactoring is continuous and opportunistic.

When touching code, improve the design if you can do so safely.

Prefer small, local, directionally correct changes over grand rewrites.

Do not split files only to satisfy a metric.

Do not move complexity into helper files without reducing coupling or clarifying responsibility.

A refactor is successful when the system becomes easier to understand and safer to change.

## Testing Principles

Tests are part of design quality.

They are not a cleanup step after implementation.

Good tests reinforce modular structure, validate behavior at the right seam, and make refactoring safer.

Oversized test files are a smell when they simply mirror oversized implementation files.

If a design is hard to test cleanly, that is usually a useful signal about the design itself.
