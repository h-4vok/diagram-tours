# Architecture

Diagram Tour is split into a small set of focused packages inside a Bun monorepo.

- `core` defines the shared domain model and will grow into the tour engine that coordinates steps, focus targets, and playback state.
- `parser` reads Mermaid diagram files and tour YAML files, then normalizes and validates them into the core domain types.
- `web-player` provides the browser UI for loading a tour and running it interactively.

Later versions may add optional plugins or integrations for features such as text-to-speech or audio narration, but those are out of scope for the current scaffold.

