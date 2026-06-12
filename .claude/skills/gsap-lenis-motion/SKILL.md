---
name: gsap-lenis-motion
description: GSAP 3 + ScrollTrigger + @gsap/react + Lenis smooth scroll patterns for this repo. Use whenever editing animations, timelines, scroll-linked effects, or any file importing `gsap`, `ScrollTrigger`, `useGSAP`, or `lenis`. Includes the Lenis↔ScrollTrigger sync pattern from `_app.js`.
---

# GSAP + Lenis — conventions for this repo

The app uses GSAP 3.13 with ScrollTrigger registered globally in `src/pages/_app.js`. Lenis owns the smooth scroll loop and drives ScrollTrigger via `lenis.on("scroll", ScrollTrigger.update)`. Do not introduce alternative smooth-scroll libs (Locomotive, etc.) or alternative animation libs (Framer Motion, anime.js) — keep everything in GSAP.

## Global setup (already in `_app.js`)

```js
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
});

const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
requestAnimationFrame(raf);

lenis.on("scroll", () => ScrollTrigger.update());
```

**Don't duplicate this** in components. Lenis is a singleton at the App level.

## Component animations: prefer `useGSAP` (`@gsap/react`)

Auto-cleans tweens/timelines on unmount. Replaces the `useEffect` + manual `kill()` boilerplate.

```js
import { useGSAP } from "@gsap/react";

useGSAP(() => {
  gsap.to(ref.current, { opacity: 1, duration: 0.6, ease: "power3.out" });
}, { scope: containerRef, dependencies: [isActive] });
```

For imperative scenes (three.js update uniforms) plain `gsap.to(uniforms.uProgress, { value: 1 })` works — `gsap` mutates `.value` directly and the next RAF picks it up.

## Driving WebGL uniforms with GSAP

```js
gsap.to(material.uniforms.uProgress, {
  value: 1,
  duration: 1.4,
  ease: "expo.inOut",
  onUpdate: () => { /* uniform already mutated; render loop reads it */ },
});
```

Don't call `renderer.render()` from `onUpdate` — the project's RAF loop already renders every frame. Onupdate is for side effects (DOM, captions).

## ScrollTrigger patterns

### Scrubbed scene progression

```js
gsap.to(material.uniforms.uProgress, {
  value: 1,
  ease: "none",
  scrollTrigger: {
    trigger: containerRef.current,
    start: "top top",
    end: "+=200%",
    scrub: 0.8,           // small scrub = lag that smooths jitter
    pin: true,
  },
});
```

### Refresh on layout changes

ScrollTrigger caches positions. If you change DOM size after mount (e.g. media loads), call `ScrollTrigger.refresh()` once after layout settles.

### Don't fight Lenis

Lenis already drives `ScrollTrigger.update`. Setting `scroller: window` is the default and correct. **Never** pass a custom scroller proxy unless you switch off Lenis on that route.

## Easing palette (project taste)

- Hero / cinematic: `"expo.inOut"`, `"power4.out"`
- UI micro: `"power2.out"`, `"power3.out"`
- Bounce-free emphasis: `"back.out(1.2)"` sparingly; avoid elastic — clashes with the brutalist style
- Custom: `CustomEase` plugin is fine if registered locally

The Lenis easing already in `_app.js` (`1.001 - 2^(-10t)`) is a standard exp-out — don't change without reason.

## Timelines

For sequenced steps prefer `gsap.timeline()` over chained `.to` calls:

```js
const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
tl.to(captionRef.current, { opacity: 1 })
  .to(material.uniforms.uRadius, { value: 0.08 }, "<")  // start with previous
  .to(counterRef.current, { opacity: 1 }, "-=0.2");      // overlap
```

Use position parameters (`"<"`, `"-=0.2"`, `">0.1"`) rather than nested timelines for short sequences.

## FLIP (layout transitions)

GSAP's FLIP plugin is the right tool when an element changes parent or size and you want a smooth morph. Register only if you import it. Don't reach for it for simple in-place tweens.

## Performance

- `gsap.set` is synchronous and faster than `gsap.to({ duration: 0 })` for initial state.
- `force3D: true` is default — don't override.
- For 1000+ targets use `gsap.utils.toArray` + a single staggered tween, not 1000 tweens.
- Avoid animating layout properties (`width`, `top`, `left`) when `transform` works — same rule as CSS.

## Cleanup

`useGSAP` handles it. For raw `useEffect`:

```js
useEffect(() => {
  const ctx = gsap.context(() => {
    // tweens / ScrollTriggers
  }, containerRef);
  return () => ctx.revert();
}, []);
```

`ctx.revert()` kills tweens, removes ScrollTriggers it created, and resets inline styles. Use it instead of tracking individual `tween.kill()` calls.

## When proposing motion changes

- State which element/uniform animates, the ease, and the duration.
- If it's scroll-linked, state the `start`/`end` and whether it's pinned.
- Confirm no duplicate Lenis instance is being created.
