# Smoke Tests

This document explains, in plain language, which capability each important `web-player` smoke test validates.

The executable source of truth remains Playwright in `packages/web-player/smoke/`. This file exists so the owner can review the intent and design of the smoke suite without reading every selector or helper in the test code.

## Principles

- smoke tests validate critical end-to-end visible behavior
- the primary signal should be what an operator can verify in the browser
- we avoid depending on internal details when an equivalent visible signal is available
- when the same capability has multiple startup modes, we compare the visible shape of the loaded collection

## Startup Modes

File: `packages/web-player/smoke/startup-modes.spec.ts`

### Startup modes -- repo-wide startup exposes repo-only tours in browse

- Starts the server in `dev` mode without parameters
- Navigates to the `payment-flow` tour
- Opens the browse panel
- Verifies that `preview target notice` is not shown
- Verifies that search can find `Alpha Tour`
- Verifies that search can find `Beta Tour`
- Verifies that search can find `Release Pipeline`

Why these checks exist:

- they confirm the source target is repo-wide and not just `examples`
- they use tours from different parts of the repo to avoid a weak test
- they validate the collection through the browser itself, not through loader internals

### Startup modes -- explicit examples directory keeps browse scoped to shipped examples

- Starts the server with `bun run dev ./examples`
- Navigates to the `payment-flow` tour
- Opens the browse panel
- Verifies that `preview target notice` is not shown
- Verifies that the `diagnostics` badge does not exist
- Verifies that search does not find `Alpha Tour`
- Verifies that search does not find `Beta Tour`
- Verifies that search does find `Release Pipeline`
- Verifies that search does find `Refund Flow`

Why these checks exist:

- they clearly separate `./examples` from the full repo
- they verify that internal fixtures outside the public example library are not loaded
- they confirm that the expected public collection still remains available

### Startup modes -- explicit single-file startup limits browse to one tour

- Starts the server with `bun run dev ./examples/payment-flow/payment-flow.tour.yaml`
- Opens the browse panel from the root route
- Verifies that `preview target notice` mentions `payment-flow.tour.yaml`
- Verifies that browse shows `Payment Flow`
- Verifies that browse does not show `Refund Flow`

Why these checks exist:

- they validate single-file preview behavior
- they verify the visible signal that tells the operator they are in single-file mode
- they confirm that browse does not mix in unrelated tours

### Startup modes -- interactive open-all matches repo-wide startup

- Starts the server with `bun run dev:interactive`
- Chooses `Open all tours` in the console
- Navigates to the `payment-flow` tour
- Opens the browse panel
- Repeats the same checks as the repo-wide startup case

Why these checks exist:

- they guarantee that the interactive wizard does not change the meaning of `open all`
- they compare the visible result of the interactive flow to the direct flow

### Startup modes -- interactive directory selection matches examples-only startup

- Starts the server with `bun run dev:interactive`
- Chooses `Open a directory`
- Enters `./examples`
- Navigates to the `refund-flow` tour
- Opens the browse panel
- Repeats the same checks as the `./examples` case

Why these checks exist:

- they ensure that the console wizard resolves the same source target as direct startup
- they exercise the full prompt + input + server + browser flow

### Startup modes -- interactive file selection matches single-file startup

- Starts the server with `bun run dev:interactive`
- Chooses `Open a .tour.yaml file`
- Enters `./examples/payment-flow/payment-flow.tour.yaml`
- Opens the browse panel
- Repeats the same checks as the single-file case

Why these checks exist:

- they ensure that the wizard supports single-file preview without drifting from direct startup behavior

### Startup modes -- interactive startup skips the prompt when a target is explicit

- Starts the server with `bun run dev:interactive ./examples/refund-flow/refund-flow.tour.yaml`
- Opens the browse panel
- Verifies the same visible shape as a single-file preview for `Refund Flow`
- Verifies that the process output does not include interactive prompts

Why these checks exist:

- they guarantee the precedence of an explicit argument over the wizard
- they cover the case where the interactive CLI must behave like a direct command

## Docs Shell And Navigation

File: `packages/web-player/smoke/payment-flow.spec.ts`

### Docs shell browse navigation changes tours without breaking the player

- Navigates to `decision-flow?step=3`
- Verifies the main shell, hydrated theme, current-tour identity, and top bar
- Opens the browse panel from the current tour chip
- Verifies that browse, search, and the tree are visible
- Verifies that the diagram visual state matches the deep-linked step
- Uses browse search to go to `Refund Flow`
- Verifies the URL change and the step text change
- Reopens browse and returns to `Decision Flow`

Why these checks exist:

- they exercise the shell, browse panel, deep links, and cross-tour navigation in the same smoke test
- they verify that the player and diagram remain coherent during navigation

### Browse search keeps long queries strict enough to avoid unrelated fuzzy matches

- Navigates to `refund-flow`
- Opens browse
- Searches for `release`
- Verifies that `Release Pipeline` appears
- Verifies that `Parallel Onboarding` and `Huge System Stress Test` do not appear

Why these checks exist:

- they protect the ergonomics of the search experience
- they prevent fuzzy matching from regressing into noisy results

## Layout And Viewport

File: `packages/web-player/smoke/payment-flow.spec.ts`

### Diagram canvas owns horizontal overflow instead of the document body

- Navigates to `decision-flow`
- Verifies that the diagram is visible
- Compares the document width to the viewport width
- Verifies that the canvas occupies the expected size inside the window

Why these checks exist:

- they catch regressions where the whole page becomes horizontally scrollable

### Focused areas stay reasonably centered through viewport-centering examples

- Navigates to `viewport-centering`
- Verifies centering for the first focus target
- Advances steps and verifies centering again for the lower focus and grouped focus

Why these checks exist:

- they cover the main viewport promise of the player
- they use a fixture designed to validate top, bottom, and grouped cases

### Deep-linked step changes reuse the same Mermaid svg

- Navigates to `decision-flow?step=2`
- Marks the current `svg` with a test id
- Advances to the next step
- Verifies that the same `svg` remains mounted

Why these checks exist:

- they protect against unnecessary diagram remounts
- they help catch performance or visual stability regressions

### Huge-system stress fixture remains navigable and readable

- Navigates to `huge-system?step=5`
- Verifies the expected nodes and focus state
- Advances to the next step
- Verifies the URL, text, and follow-up focus state

Why these checks exist:

- they cover the heaviest fixture in the repo
- they quickly expose regressions in large diagrams

### Huge-system first step starts at a readable focus scale

- Navigates to `huge-system`
- Verifies that the first focus target is near the visible center
- Verifies that the focused node does not start too small

Why these checks exist:

- they protect initial legibility for the densest case in the repo

### Connector labels remain readable as context in a branching diagram

- Navigates to `incident-response?step=2`
- Verifies the primary focus
- Verifies that connector labels marked as context still exist

Why these checks exist:

- they protect the visual hierarchy between primary focus and secondary context

### Long step text does not break the usable diagram area

- Navigates to `incident-response?step=4`
- Measures the text box, overlay, and canvas layout
- Verifies that the diagram still keeps enough usable space

Why these checks exist:

- they cover layout regressions caused by longer editorial content

### Dark mode persists across reloads and direct navigation

- Navigates to `payment-flow`
- Enables dark mode
- Reloads
- Navigates to `refund-flow`
- Verifies that the theme remains `dark`

Why these checks exist:

- they cover real persistence, not just a local toggle change

### Unknown tours show a guided 404 with a single recovery action

- Navigates to an unknown slug
- Verifies `404`, the heading, and the message
- Verifies the `Back to Tours` link
- Uses that action and confirms recovery

Why these checks exist:

- they protect the intentionally guided error recovery experience

### Empty-focus steps keep viewport behavior stable

- Navigates to `viewport-centering?step=3`
- Advances to the `empty-focus` step
- Verifies the absence of focused nodes
- Verifies that the canvas scroll returns to the expected neutral state

Why these checks exist:

- they cover a tour semantic already supported by the v1 contract
- they protect against subtle viewport regressions on neutral steps

## Navigation Minimap

File: `packages/web-player/smoke/payment-flow.spec.ts`

### Desktop minimap stays visible and tracks the focused step

- Navigates to `payment-flow`
- Verifies that the minimap shell and surface are visible on desktop
- Verifies that the current-step focus marker exists
- Advances to the next step
- Verifies that the minimap focus marker style changes with the new focus target

Why these checks exist:

- they validate that the minimap is part of the desktop player shell
- they confirm that the minimap follows guided-step focus, not just raw scroll position

### Clicking the minimap pans the main diagram viewport

- Navigates to `huge-system`
- Records the current diagram scroll position
- Clicks near the far corner of the minimap surface
- Verifies that the main diagram scroll position changes

Why these checks exist:

- they validate the simplest direct-manipulation navigation path
- they use the browser-visible scroll state of the real canvas instead of internals

### Dragging the minimap viewport rectangle pans the main diagram viewport

- Navigates to `huge-system`
- Records the current diagram scroll position
- Drags the minimap viewport rectangle
- Verifies that the main diagram scroll position changes

Why these checks exist:

- they protect the higher-precision navigation mode of the minimap
- they ensure the minimap is not just a passive indicator

### Small screens hide the minimap automatically

- Shrinks the viewport to a mobile-sized width
- Navigates to `payment-flow`
- Verifies that the step overlay still exists
- Verifies that the minimap does not render

Why these checks exist:

- they protect the desktop-first scope of minimap v1
- they ensure mobile layouts do not inherit a cramped or accidental minimap UI
