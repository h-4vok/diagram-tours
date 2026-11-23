# Mixed Responsibilities

`Mixed responsibilities` is the primary engineering smell in this repository.

The problem is not file size by itself.

The problem is a file becoming the default home for several different decisions.

## What it looks like

- one module reads files, parses content, validates structure, maps outputs, and formats diagnostics
- one Svelte file owns rendering, interaction rules, persistence, layout policy, and navigation mechanics
- one test file grows into a mirror of an oversized implementation file

## Why it hurts

- change becomes harder to reason about
- review scope becomes wider than the task
- safe extraction gets postponed because everything is entangled
- future contributors stop seeing natural seams

## Better direction

Split by responsibility, not by arbitrary helper count.

Useful extractions usually separate:

- orchestration from pure transformations
- domain decisions from IO
- view concerns from interaction logic
- setup from validation

## Review question

If this file changes, can we explain the reason in one sentence without listing several unrelated jobs?

If not, the file is probably carrying mixed responsibilities.
