# Engineering Review Rubric

This rubric operationalizes [Engineering Principles](01-engineering-principles.md) into a review tool for pull requests and refactor analysis.

It is written for agents first, but it should stay readable for human reviewers too.

It does not replace [`AGENTS.md`](../../AGENTS.md).

`AGENTS.md` remains the source of concrete guardrails and operational rules.

This rubric judges design quality.

## How To Use It

Use this rubric to review a change, not to restate every repository rule.

Start with the universal criteria.

Then apply the artifact section that best matches the changed file or dominant responsibility.

The main output is:

- findings
- verdict

When you find a concern:

- name the concern
- map it to a rubric criterion
- explain why it matters

Do not use numeric scores in v1.

Do not reject directionally correct refactors just because they do not reach the ideal end state in one change.

## Universal Criteria

Each criterion can be judged as:

- `Acceptable`
- `Concern`
- `Not applicable`

### Cohesion

Derived from: `Cohesion First`

Review question:

Does this change keep a clear responsibility boundary, or does it make one file or unit absorb multiple reasons to change?

### Boundaries

Derived from: `Respect Boundaries`

Review question:

Does the change respect layer boundaries, or does it make one part of the system take work that belongs elsewhere?

### Explicitness

Derived from: `Prefer Explicitness`

Review question:

Does the code make important behavior visible, or does it hide control flow, side effects, or ownership behind convenience?

### Naming

Derived from: `Use Naming As Design`

Review question:

Do names clarify responsibility and abstraction level, or do they make the design broader and harder to reason about?

### Abstractions

Derived from: `Earn Abstractions` and `Principles, Not Classes`

Review question:

Does the change use an earned abstraction that clarifies the design, or does it add indirection without a stable responsibility behind it?

## Artifact Guidance

### Modules

Focus on responsibility clarity, visible seams, boundary discipline, and earned abstractions.

Typical concerns:

- mixed responsibilities inside one module
- boundary crossings for convenience
- generic helpers that hide ownership
- abstractions that move code without clarifying the design

### UI

Focus on thin shells, explicit interaction ownership, and keeping non-UI responsibilities out of the component or route.

Typical concerns:

- UI files accumulating business, parsing, or persistence logic
- event handling and state transitions becoming hard to trace
- components becoming broad orchestration hubs without clear seams

### Tests

Focus on behavior seams, modular structure, and whether the tests reinforce the intended design.

Typical concerns:

- giant test files mirroring giant implementation files
- brittle coverage of internals instead of behavior
- setup that hides what the test is actually proving

### Smoke

Focus on browser-visible behavior, flow clarity, and keeping scenarios narrow enough to debug and maintain.

Typical concerns:

- one smoke file covering too many unrelated flows
- assertions that do not explain the user-visible intent
- smoke scenarios turning into broad integration dumping grounds

### Styles

Focus on ownership, clarity, and whether style files remain scoped to a coherent purpose.

Typical concerns:

- unrelated layout, theme, and component concerns mixed together
- selectors or overrides that obscure ownership
- style files growing without a clear structural boundary

## Review Output

The preferred output shape is:

1. findings
2. verdict

A finding should identify the concern, map it to a criterion, and explain the impact.

Example pattern:

- `Concern: Cohesion`
  - This change moves more unrelated behavior into the same unit, making future changes harder to isolate and review.

Use verdicts as:

- `Acceptable`: the change is aligned enough to proceed
- `Concerns`: the change introduces or preserves design problems worth calling out
- `Not applicable`: the rubric or a specific criterion does not meaningfully apply

## Incremental Refactors

This rubric should reward directionally correct progress.

A change does not need to solve an entire hotspot at once to be considered acceptable.

Call out concerns when a change worsens cohesion, boundaries, or clarity.

Do not treat bounded improvements as failures just because the surrounding area is still imperfect.

## Related Reading

- [Engineering Principles](01-engineering-principles.md)
- [Mixed Responsibilities](02-mixed-responsibilities.md)
- [Layer Leakage](03-layer-leakage.md)
- [Abstractions](04-abstractions.md)
- [Naming And Explicitness](05-naming-and-explicitness.md)
- [Testing And Refactoring](06-testing-and-refactoring.md)
- [Meaningful Refactors](07-meaningful-refactors.md)
