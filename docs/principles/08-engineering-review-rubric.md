# Engineering Review Rubric

Use this rubric to review design quality, not to restate repo rules. `AGENTS.md` is operational source of truth.

## Universal Criteria

Judge each criterion as `Acceptable`, `Concern`, or `Not applicable`.

### Cohesion

Does this change keep a clear responsibility boundary, or does it make one file or unit absorb multiple reasons to change?

### Boundaries

Does the change respect layer boundaries, or does it make one part of the system take work that belongs elsewhere?

### Explicitness

Does the code make important behavior visible, or does it hide control flow, side effects, or ownership behind convenience?

### Naming

Do names clarify responsibility and abstraction level, or do they make the design broader and harder to reason about?

### Abstractions

Does the change use an earned abstraction that clarifies the design, or does it add indirection without a stable responsibility behind it?

## Artifact Guidance

### Modules

Focus: responsibility clarity, visible seams, boundary discipline, earned abstractions.

- mixed responsibilities inside one module
- boundary crossings for convenience
- generic helpers that hide ownership
- abstractions that move code without clarifying the design

### UI

Focus: thin shells, explicit interaction ownership, non-UI work stays out.

- UI files accumulating business, parsing, or persistence logic
- event handling and state transitions becoming hard to trace
- components becoming broad orchestration hubs without clear seams

### Tests

Focus: behavior seams, modular structure, tests reinforce intended design.

- giant test files mirroring giant implementation files
- brittle coverage of internals instead of behavior
- setup that hides what the test is actually proving

### Smoke

Focus: browser-visible behavior, flow clarity, scenarios narrow enough to debug and maintain.

- one smoke file covering too many unrelated flows
- assertions that do not explain the user-visible intent
- smoke scenarios turning into broad integration dumping grounds

### Styles

Focus: ownership, clarity, coherent purpose.

- unrelated layout, theme, and component concerns mixed together
- selectors or overrides that obscure ownership
- style files growing without a clear structural boundary

## Review Output

Preferred output: `findings`, then `verdict`.

Each finding should name concern, map criterion, and explain impact. Findings should stay actionable.

Verdicts:

- `Acceptable`
- `Concerns`
- `Not applicable`

## Incremental Refactors

Reward directionally correct progress. Do not fail bounded improvements just because surrounding area is still imperfect.

## Related Reading

- [Engineering Principles](01-engineering-principles.md)
