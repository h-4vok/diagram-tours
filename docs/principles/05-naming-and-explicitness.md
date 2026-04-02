# Naming And Explicitness

Naming is part of design work.

When names are precise, architecture becomes easier to follow.

When names get vague, broad, or overloaded, responsibilities blur with them.

## Prefer

- names that reveal the real job
- explicit data shapes
- direct control flow
- visible seams between orchestration and transformations

## Avoid

- helper names that could mean anything
- generic utility language for domain behavior
- hidden side effects behind innocent-looking functions
- broad names that let a file keep growing without pressure to split

## Why this matters

Explicit code is easier to review, easier to debug, and easier to refactor safely.

The reader should not need to infer which branch mutates state, performs IO, or crosses a boundary.

## Review question

Would a new contributor understand this file's role from its names and structure alone, or would they need to trace execution first?
