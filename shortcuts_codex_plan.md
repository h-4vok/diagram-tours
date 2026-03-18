# Consistent Keyboard Shortcuts and Discoverability v1

## Summary

Add a coherent desktop-first shortcut system across the top-level player surfaces, with matching UX so users can actually discover it.

Chosen decisions:
- discoverability uses both inline hints and a full shortcuts modal
- non-obvious shortcuts use single-letter keys
- scope is `core + timeline`
- inline hints stay contextual, not always-on everywhere

The goal is to make keyboard interaction feel intentional and learnable, not "hidden power-user behavior".

## Key Changes

### Shortcut system

- Add a single shortcut controller in `web-player` that listens at the window level and ignores keystrokes when focus is inside editable inputs or textareas.
- Support this v1 keymap:
  - `b`: toggle browse panel
  - `i`: toggle issues popover
  - `m`: toggle minimap collapsed/expanded state
  - `/`: open browse and focus the search input
  - `?`: open the shortcuts help modal
  - `ArrowRight` and `n`: next step
  - `ArrowLeft` and `p`: previous step
  - `1`-`9`: jump directly to timeline step numbers when the current tour has that many steps
  - `Esc`: close shortcuts modal, browse, issues, and node-step chooser in that order of highest transient UI first
- Shortcuts should only act when they make sense:
  - no step navigation if there is no next/previous step
  - no timeline number jump beyond current tour length
  - no panel toggle conflicts while typing in search
- Keep click behavior and existing controls unchanged; shortcuts are additive.

### Discoverability and UI UX

- Add a new `Shortcuts` affordance in the top bar as a subtle button or chip that opens the shortcuts modal.
- The same modal also opens with `?`.
- Add contextual inline keycaps to the main shortcut-enabled controls:
  - `Browse` shows `B`
  - `Issues` shows `I`
  - minimap toggle shows `M`
  - browse search label or placeholder advertises `/`
  - timeline container or first pill area shows number-jump hint
  - step next/previous buttons show `N`/`P` or arrow glyph hints
- Keep inline hints compact and visually secondary; they should feel like "discoverable metadata", not button labels.
- Add a one-line hint in the shortcuts modal header like `Press ? anytime to reopen this help`.
- Do not add a first-run coachmark in v1.

### Shortcuts modal

- Add a lightweight modal/popover layer for shortcut help, visually aligned with the existing overlays.
- Group shortcuts into clear sections:
  - Panels
  - Steps
  - Timeline
  - Search
- Each row shows:
  - key
  - action label
  - optional note when the action is contextual
- Modal behavior:
  - opens from top bar or `?`
  - closes on `Esc`, backdrop click, or explicit close action
  - should not interfere with browse/issues state beyond overlay stacking rules

### Overlay and precedence rules

- Only one "major helper" overlay should be open at once among:
  - browse
  - issues
  - shortcuts modal
- Opening one closes the others.
- The node-step chooser remains independent but closes on `Esc` before broader overlays.
- `/` always opens browse and puts focus in search, even if another helper overlay is open.
- `?` always opens the shortcuts modal from the current state, unless typing inside an input.

### Timeline and player integration

- Timeline pills remain clickable and now become keyboard-addressable through number keys.
- Number shortcuts map to visible step numbers, not zero-based indices.
- If a tour has more than 9 steps, only `1`-`9` are handled in v1; no `0`, no multi-digit parsing.
- Existing route-driven step changes stay the single source of truth; shortcuts reuse the same navigation path as buttons and node-click navigation.

## Public Interfaces / Types

- No parser or `core` contract changes.
- Add web-player-local shortcut helpers/types for:
  - shortcut action identifiers
  - shortcut eligibility checks
  - shortcut help item definitions for modal rendering
- Keep the help content defined in code as structured data so the modal and inline hints draw from the same source of truth.
- No new persisted settings in v1.

## Test Plan

- Unit/component coverage:
  - shortcut handler ignores keystrokes in inputs
  - `b`, `i`, `m`, `/`, `?` trigger the expected surfaces
  - `n`/`p` and arrow keys move steps correctly
  - number keys jump timeline steps when valid
  - invalid number keys do nothing
  - opening browse/issues/help enforces overlay exclusivity
  - shortcuts modal renders grouped help items
  - inline key hints render on the intended controls
- Smoke coverage:
  - `b` opens and closes browse
  - `/` opens browse and focuses search
  - `i` opens issues
  - `?` opens shortcut help
  - `n`/`p` and arrow keys move steps visibly
  - timeline number shortcuts jump to the expected step
  - `m` toggles minimap collapsed state on desktop
  - `Esc` closes transient UI in the expected order
- Documentation:
  - update `README.md` capability list
  - update `docs/testing/smoke-tests.md`
  - update `backlog.md` by moving the item to `In Progress` at start, with testing notes, then to `Done` if fully delivered

## Assumptions and Defaults

- v1 is desktop-first.
- Shortcuts are disabled while typing in editable controls.
- Inline hints are contextual and minimal, not always visible on every control.
- The top bar gets a visible `Shortcuts` entry so discoverability does not depend on already knowing `?`.
- Single-letter shortcuts are acceptable because this is a focused app surface, not a text-heavy editor.
- Timeline number-jump support intentionally caps at 9 for v1.
