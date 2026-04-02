# Clean Code Refactoring Reference

This document captures the current thinking behind the repository's clean-code and refactoring initiative.

It is a working reference for future design, review, and backlog decisions.

It is not the manifesto.

## Why this exists

We identified that the repository already has a real maintainability problem in some areas, not just a theoretical preference for smaller files.

Several source and test files have grown well beyond 500 lines, and some of the largest files also mix multiple responsibilities in ways that make change, review, and refactoring harder.

Examples observed during the initial review:

- `packages/parser/src/index.ts`
- `packages/parser/test/index.test.ts`
- `packages/web-player/src/lib/tour-player.svelte`
- `packages/web-player/src/lib/mermaid-diagram.ts`
- `packages/web-player/src/routes/+layout.svelte`

The issue is not only lines of code.

The deeper concern is cohesion:

- files that mix discovery, parsing, validation, mapping, reporting, and fallback generation
- UI files that combine orchestration, input handling, state persistence, rendering concerns, and navigation mechanics
- test files that become so broad that they mirror oversized production modules

## Current shared conclusions

### 1. There is a real problem to address

The repository already shows concentrated complexity in a small number of source and test files.

This creates friction for:

- onboarding
- local reasoning
- safe refactoring
- parallel changes
- confidence in review
- long-term architectural clarity

### 2. LOC matters, but it is not the real goal

We do want LOC limits eventually, but as guardrails and alarms, not as the primary design principle.

The real goal is to improve:

- cohesion
- responsibility boundaries
- architectural direction
- maintainability
- context efficiency

### 3. We should not enforce hard LOC limits yet

We agreed that it is better to first perform a repository-wide refactoring pass guided by principles rather than by arbitrary max-lines thresholds.

After that first pass, we can measure the repository again and define thresholds based on the actual desired shape of each file type.

This should produce limits that reflect the architecture we want, rather than forcing the architecture to fit numbers chosen too early.

### 4. This work should be gradual

We should not attempt a one-shot overhaul across the whole repository.

Instead, the initiative should be split into stages:

- define the framework
- translate it into review criteria
- create reusable reviewer/refactoring support
- refactor in phases
- enforce guardrails once the repository shape is better

### 5. The final enforcement should follow the framework, not replace it

Lint rules are useful only if they protect a design philosophy that the team already understands and agrees on.

We do not want an implementation where developers cut files only to satisfy a max-lines number while preserving the same coupling and confusion.

## Architectural perspective

The repository should continue aiming for small, explicit, composable modules.

The desired direction is inspired by clean code, clean architecture, and SOLID, but adapted to idiomatic TypeScript and Svelte rather than copying C# patterns mechanically.

That means:

- keep the principles
- adapt the expression of those principles to the language and framework

## OOP / TypeScript / Svelte notes

A concern was raised about bringing habits from OOP and C# into JavaScript and TypeScript.

Current conclusion:

- the principles are valuable
- the literal style should be adapted

What still translates well:

- single responsibility
- explicit seams
- dependency direction
- small units
- intention-revealing names
- separation between orchestration and pure logic

What should be applied carefully:

- classes by default
- excessive indirection
- heavy ceremony for simple flows
- object layers that only wrap a function without creating a meaningful boundary

In this repo, the likely sweet spot is:

- small modules
- pure functions where possible
- explicit adapters around IO and framework edges
- thin Svelte shells that orchestrate extracted logic
- state and behavior grouped by responsibility, not by convenience

## Practical guidance we agreed on

### Prefer

- refactoring by responsibility boundaries
- extracting meaningful domain or UI submodules
- separating orchestration from transformation logic
- making tests follow the modular structure of the code
- allowing some orchestrator files to remain somewhat larger if they mostly compose smaller parts

### Avoid

- splitting files only to satisfy a line count
- extracting vague helper files with no clear responsibility
- moving complexity around without reducing coupling
- introducing class-heavy ceremony where functions or small modules are clearer
- turning LOC enforcement into architecture theater

## Additional concerns to account for later

When the initiative moves beyond reference and planning, we should also define:

- what counts as one responsibility in each package
- which file categories deserve different limits
- how to treat orchestrator files
- whether tests, smoke specs, Svelte components, and styles should use different thresholds
- which exceptions are acceptable and how they are documented
- what complexity, nesting, and export-count heuristics should complement LOC
- how reviews should evaluate cohesion, not just file length

## Potential reusable reviewer / subagent

We also discussed creating a reusable reviewer/refactoring assistant dedicated to this initiative.

The intent would not be to act as a simple LOC police tool.

Its role would be to help with:

- responsibility analysis
- boundary review
- cohesion review
- identification of oversized mixed-concern files
- distinguishing real refactors from cosmetic file splits
- future PR review against the repository's architecture rubric

Important constraint:

This reviewer or subagent should be created only after the manifesto and review rubric exist, so it enforces repository-specific standards rather than generic clean-code opinions.

## Agreed sequence

We agreed on the following five-step sequence for the initiative:

1. Define a short manifesto or framework for the repository.
2. Translate that framework into a review rubric.
3. Create a reusable architecture-focused reviewer or skill based on that rubric.
4. Execute a phased refactoring program across the repository.
5. Add hard LOC and related guardrails after the refactoring baseline is in place.

## Relationship to backlog work

The backlog should track this as a coordinated initiative, not as isolated linter tasks.

Older backlog items focused on LOC enforcement were considered too narrow on their own and should be replaced by the staged plan above.
