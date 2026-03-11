# Delivery Checklist

Before marking work as complete, verify the following.

## Delivery Mode Completion

Work is not complete until a bounded capability is delivered in a reviewable, green state.

Before saying "done", confirm:

- tests exist for the new behavior
- tests or contract checks were written before or alongside implementation as part of the TDD cycle
- the intended failing condition was covered before the final implementation state
- tests describe behavior clearly
- implementation matches tests
- the delivered capability is observable through behavior, contract, or validation
- no unrelated changes were introduced

## Required Checks

Run:

- linter
- tests
- typecheck
- build, when relevant to the touched packages

Ensure all checks pass.

## Guardrails

Code must not be delivered if any guardrail is broken:

- lint fails
- tests fail
- coverage drops below `100%` for statements, branches, functions, or lines
- typecheck fails
- configured complexity rules fail
- configured function arity rules fail
- documented contracts are changed without corresponding documentation updates

## Owner Verification Readiness

Codex must leave enough evidence for the owner to verify the work quickly after delivery.

The final handoff should make clear:

- what capability was delivered
- how the owner can verify it
- which tests were added or updated
- which checks were run
- what documentation changed
- any residual risks, tradeoffs, or follow-up work

## Before Push or Pull Request

Verify:

- branch is clean
- tests are green
- lint passes
- no debug code remains
- documentation is updated if behavior or contracts changed

## Final Delivery Summary

Every delivery summary should include:

- delivered capability
- user-visible or contract-visible outcome
- tests added or updated
- checks run and final status, including coverage
- documentation updated
- remaining risks or intentional follow-ups
