# AGENTS

This repository is designed to be worked on by AI-assisted agents such as Codex.

Before performing substantive work, agents must load the following files:

- ENGINEERING_PLAYBOOK.md
- REPO_WORK_RULES.md
- DELIVERY_CHECKLIST.md
- README.md

These files define the engineering standards of the repository.

## Core Principles

Agents must follow these rules:

- Development uses **TDD (Test Driven Development)**.
- Tests are written before implementation.
- Lint rules must be respected.
- Cyclomatic complexity must remain ≤ 3.
- Function arity must remain ≤ 3.

If more parameters are needed, use an object parameter.

## Architecture Boundaries

The repository is organized into layers:

core
Domain model and tour engine.

parser
Reads YAML and Mermaid diagrams.

web-player
UI for running tours.

Rules:

- `core` must not depend on filesystem, YAML, or UI frameworks.
- `parser` may depend on YAML and Mermaid parsing.
- `web-player` consumes resolved tour models.

## Tour Contract

The `tour.yaml` format is the primary contract of the system.

Agents must not modify this contract without documentation.

## Implementation Guidelines

Prefer:

- small pure functions
- guard clauses
- composable utilities

Avoid:

- nested conditionals
- large functions
- mixing parsing and domain logic
