# Meaningful Refactors

A meaningful refactor improves the design.

A cosmetic refactor mainly changes where code sits.

## Cosmetic split

A file is broken into smaller files, but:

- responsibilities are still mixed
- naming is still vague
- control flow is still hard to follow
- the new files exist only to satisfy size pressure

This may lower a metric without improving the codebase.

## Meaningful split

A file is broken apart along real seams, for example:

- orchestration separated from pure logic
- IO separated from validation
- component shell separated from interaction mechanics
- shared behavior separated from route-specific wiring

This usually improves reviewability, testability, and confidence in future changes.

## Review question

If we ignored line counts entirely, would this refactor still feel worthwhile?

If the answer is no, it is probably cosmetic.
