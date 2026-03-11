# Engineering Playbook

This document defines engineering principles for the Diagram Tour project.

## Development Philosophy

The project follows a **design-first and test-first approach**.

Implementation order:

1. Define contracts
2. Write tests
3. Implement behavior
4. Refactor safely

## TDD Workflow

Every change should follow this process:

1. Write a test that describes the expected behavior.
2. Run tests and confirm failure.
3. Implement minimal code to make tests pass.
4. Refactor while keeping tests green.

## Code Design

Prefer:

- small functions
- pure transformations
- explicit data structures

Avoid:

- large functions
- hidden side effects
- tightly coupled modules

## Architecture Separation

The repository separates concerns into layers.

core
- domain model
- tour engine
- reference resolution

parser
- YAML parsing
- Mermaid parsing

web-player
- UI rendering

## Documentation

If behavior changes:

- update diagrams
- update examples
- update README if necessary

## Decisions

Important architecture decisions should be recorded in:

```
docs/adr/
```
