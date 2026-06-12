# Engineering Principles

North star for design decisions. `AGENTS.md` remains the operational source of truth.

## Core Principles

### Cohesion First

One job. One reason to change. Large is fine; mixed responsibilities are not.

### Respect Boundaries

Keep domain, parsing, UI, and startup distinct. Boundary crossings must be deliberate and visible.

### Prefer Explicitness

Keep important behavior obvious. Prefer direct flow, explicit data, and clear names over hidden ownership or clever indirection.

### Use Naming As Design

Names should reveal responsibility, scope, and abstraction level. Broad or overloaded names usually mean drift.

### Earn Abstractions

Abstract only when responsibility is stable, repeated, or clearer behind a boundary. Remove duplication in meaning, not just text.

### Be Pragmatic, Preserve Direction

Delivery matters. Architecture still matters. Tradeoffs must be explicit, local, and directionally correct.

### Principles, Not Classes

Keep principles, not class-heavy style. In TypeScript and Svelte, prefer small modules, pure functions, thin adapters, and explicit orchestration.

## Named Anti-Patterns

### Mixed Responsibilities

Primary smell: one file or test absorbs multiple reasons to change.

### Layer Leakage

Secondary smell: one layer quietly takes work that belongs elsewhere.

## Refactoring Principles

Refactor continuously. Prefer small, local, directionally correct changes. Do not split files for metrics alone or move complexity into helpers without clarifying ownership.

## Testing Principles

Tests are part of design quality. Good tests reinforce seams, validate behavior at the right level, and make refactoring safer. Hard-to-test design is a signal.
