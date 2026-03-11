# Delivery Checklist

Before marking work as complete, verify the following.

## Before Saying "Done"

- tests exist for the new behavior
- tests describe behavior clearly
- implementation matches tests
- no unrelated changes were introduced

## Before Commit

Run:

- formatter
- linter
- tests
- typecheck

Ensure all checks pass.

## Before Push / Pull Request

Verify:

- branch is clean
- tests are green
- lint passes
- no debug code remains
- documentation updated if behavior changed

## Merge Gate

Code must not be merged if:

- tests fail
- lint fails
- complexity rules fail
- typecheck fails
