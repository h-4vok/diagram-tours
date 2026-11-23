# Layer Leakage

`Layer leakage` is the secondary engineering smell in this repository.

It happens when the code still works, but responsibilities start crossing architectural lines in quiet ways.

## What it looks like

- UI code taking on parsing responsibilities because it is convenient
- startup orchestration accumulating policy or domain decisions that should live elsewhere
- domain-facing modules learning about filesystem or framework details

## Why it matters

Layer leakage makes the next shortcut easier.

Once that starts, boundaries become conventions instead of design constraints, and the repository becomes harder to evolve with confidence.

## Better direction

Treat layer crossings as deliberate events.

Keep adapters narrow.

Keep contracts explicit.

Prefer passing resolved data into a layer over making that layer discover and interpret everything itself.

## Review question

Is this code doing work that belongs to another layer simply because that other layer is harder to change right now?

If yes, the design is leaking even if the change looks efficient in the moment.
