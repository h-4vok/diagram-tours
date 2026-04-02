# Testing And Refactoring

Testing and refactoring are design activities in this repository.

They are not separate concerns.

## Testing principles

Tests should reinforce the structure we want.

That means:

- behavior-focused tests over implementation trivia
- seams that make refactoring safer
- fixtures and setup that stay realistic without becoming sprawling

Oversized test files are often a signal that the implementation beneath them is carrying too much at once.

## Refactoring principles

Refactoring is continuous and opportunistic.

When a task touches messy code, we should improve the shape if the change can stay safe and bounded.

The best refactors usually:

- tighten a responsibility boundary
- reduce coupling
- make tests easier to target
- remove ambiguity about where logic belongs

## Avoid false progress

Not every extraction is a meaningful refactor.

Moving code into helper files without clarifying ownership or reducing coupling is cosmetic progress.

The goal is not to produce more files.

The goal is to produce clearer design.
