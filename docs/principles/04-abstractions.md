# Abstractions

The repository prefers earned abstractions.

We do not abstract early just to look organized.

## Good abstractions

Good abstractions make a stable responsibility clearer.

They remove duplication in meaning.

They create a boundary that helps the reader understand where a kind of work belongs.

## Weak abstractions

Weak abstractions usually:

- rename complexity without reducing it
- hide control flow that should stay visible
- create generic helpers with no domain meaning
- add indirection before the design has stabilized

## TypeScript and Svelte posture

We are not trying to recreate C# class architecture by reflex.

Small modules, focused functions, explicit adapters, and thin Svelte shells are often the better abstraction shape here.

That does not mean classes are forbidden.

It means they should be chosen because they clarify a responsibility, not because they feel more formal.

## Review question

Did this abstraction make the design easier to understand, or did it only move code out of sight?
