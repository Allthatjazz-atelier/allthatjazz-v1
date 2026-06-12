---
name: consolidate-iterations
description: Push back against creating yet another numeric-suffix iteration (`index16.js`, `FinalSlider5.js`, `RingSlider5.js`, `BerlinClock6`, etc.). Use whenever a request would result in a new file whose name is an existing-name + integer, or when proposing changes to one of the many `index*.js` / `*Slider*.js` / `BerlinClock*.js` variants. Encourages consolidation, flagging dead variants, and asking before forking.
---

# Don't add `index16.js` — consolidate or ask

This repo has accumulated numeric-suffix iterations as a form of exploration:

- `src/components/menu/index.js … index15.js` (15 variants)
- `src/components/final/FinalSlider.js … FinalSlider4.js` (4 variants)
- `src/components/ring/RingSlider.js … RingSLider4.js` (4 variants, note casing)
- `src/components/tools/BerlinClock.js, BerlinClock2..5` (6 variants)
- `src/components/about/` likely similar

Only one of each is actually used by `pages/index.js` (currently `HeaderFooter15`, `FinalSlider4`, `RingSlider4`, etc.). The rest are dead exploration branches kept "just in case."

## The rule

Before creating `<Name><N+1>.js`, **stop and ask the user** one of:

1. "Do you want me to **modify the active variant in place** (the one referenced from `pages/index.js`)?"
2. "Do you want me to **fork it under a feature-named file** instead of a numeric suffix? (e.g., `FinalSliderGrid.js`, `RingSliderConcave.js`)"
3. "Are the previous iterations still needed, or can I delete the dead ones first?"

Numeric suffixes hide intent. `FinalSliderGrid.js` says what it is — `FinalSlider5.js` says nothing.

## When a numeric variant is OK

Almost never. The only legitimate case is a **time-bounded A/B comparison** where the user wants both versions live for a few days. In that case, agree on a deletion date and add it to a project memory.

## How to consolidate (if the user agrees)

1. Identify the active variant from `pages/index.js` (and `_app.js`) imports.
2. Diff it against the next-most-recent variant to extract what changed.
3. If the differences are **parameter-shaped** (a constant, a uniform, a layout flag), expose them as props/defaults on the active component and delete the dead variants.
4. If the differences are **structural** (different geometry, different shader), keep the active variant and delete the others — they're frozen explorations, not maintainable code.
5. Move anything irrecoverably worth preserving to a comment block at the top of the active file or to a git tag.

## Heuristic for "which is active"

Grep imports from `pages/index.js`, then transitively. Anything not reachable from there is dead unless `pages/about/` or similar references it.

```bash
grep -rE "from ['\"]@?/?components/(final|ring|menu|tools|about)" src/pages
```

## When the user explicitly asks for `index16.js`

If they explicitly say "create index16", respect it — but in the same response, point out the consolidation backlog and ask whether to clean up after the new variant lands.

## What this skill is NOT

- Not a refactor mandate. Don't propose mass deletions unprompted.
- Not a style police. The user iterates rapidly by design; the goal is to prevent the *next* unnecessary fork, not to relitigate the past 15.

## Quick phrasing for the pushback

> "I can do that — but `menu/index15.js` is already the active variant. Should I edit it in place, or fork to a feature-named file (`menu/MorphTransition.js`) instead of `index16.js`? The numeric suffix makes the next iteration harder to find."
