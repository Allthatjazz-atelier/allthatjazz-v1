---
name: immersive-architecture
description: System-level architecture for this immersive WebGL site — how scenes compose, how state flows between sliders/menu, when to use one canvas vs many, preloading, route transitions, and the capture-and-blit pattern this repo relies on. Use whenever wiring multiple WebGL components together, adding new routes/scenes, or making structural decisions.
---

# Immersive architecture — how the pieces fit

The app is a sequence of WebGL scenes (sliders, rings, transitions) composed under a menu/header shell, with smooth scroll (Lenis), a custom cursor, and an overlay system. This skill is about the **system glue**, not the individual scenes.

## High-level layout

```
_app.js
 ├── Lenis singleton (smooth scroll)
 ├── CustomCursor (always-on)
 ├── ScrollTrigger registered globally
 └── <Component /> (page)
       ├── HomeSliderProvider (slider mode context: "final" | "ring")
       └── HeaderFooter15 (menu + about-modal capture/transition)
             └── HomeSliderWrapper
                   ├── FinalSlider4   (data-aqua-canvas)
                   └── RingSlider4    (data-ring-canvas)
```

State that crosses scene boundaries lives in `HomeSliderContext`. The active scene exposes a canvas via a `data-*` attribute so the menu's transition layer can capture it (see "Capture pattern" below).

## Pattern: data attributes as cross-component selectors

Each scene's canvas tags itself:

- `data-aqua-canvas="true"` → FinalSlider's canvas
- `data-ring-canvas="true"` → RingSlider's canvas
- `data-atj-hero-mode` on `<html>` → current mode ("final" | "ring")

`menu/index15.js` `getHeroCaptureCanvas()` reads `document.documentElement.dataset.atjHeroMode` and queries the matching canvas. **This is the contract.** Don't break it without updating both sides.

When adding a new scene that needs to participate in the About-modal transition, give it a `data-*` attribute and extend `getHeroCaptureCanvas`.

## Pattern: capture-and-blit (the "About" transition)

The lens-distortion transition in `menu/index15.js`:

1. Grab the live WebGL canvas of the current scene (`getHeroCaptureCanvas`).
2. Rasterize it to a 2D canvas with a white background fill — this prevents alpha=0 regions (e.g. the ring's hole) from leaking into the new texture.
3. Wrap in `THREE.CanvasTexture`, store its size in `userData.size`.
4. Use as `uTexture1` in the transition shader; the destination scene/state is `uTexture2`.
5. Animate `uProgress` 0→1 with GSAP (`expo.inOut`, ~1.2s).
6. On complete, dispose the texture.

Reuse this pattern for any "morph between scenes" moment. **Always rasterize with a white background** — the lesson is in the comment on `rasterizeHeroTo2D`.

## Pattern: one Lenis, many RAFs

Lenis runs at the app root. Each scene component runs its own `requestAnimationFrame` for its renderer. This works because:

- Lenis updates scroll position once per frame
- ScrollTrigger updates via `lenis.on("scroll", ...)`
- Each scene reads scroll-driven uniforms via ScrollTrigger or by querying `window.scrollY` (which Lenis updates)

**Never** create a second Lenis. If a route doesn't want smooth scroll, conditionally mount the Lenis instance based on the route.

## Pattern: media preloading

`useOptimizedMedia` hook centralizes image/video resolution. Components consume `getImage(name)`/`getVideo(name)` and gate render on `isLoaded`. The pattern in `FinalSlider4.js`:

```js
const { getImage, getVideo, isLoaded } = useOptimizedMedia();
const resolvedGroups = useMemo(
  () => (isLoaded ? IMAGE_NAMES.map(g => g.map(n => getImage(n).src)) : null),
  [isLoaded, getImage]
);
```

For new scenes that depend on media: use this hook, gate on `isLoaded`, don't bypass with raw `<img src=...>`.

## When to add a new canvas vs reuse one

- **New canvas** when the scene has fundamentally different camera/perspective (e.g. ring uses curved geometry with a perspective camera, slider uses ortho-friendly flat quads).
- **Reuse canvas** when it's a variation of an existing scene — pass props/uniforms instead.
- **One canvas, many materials** is fine and usually faster than multiple canvases. Multiple canvases means multiple WebGL contexts (browsers cap at ~8-16).

## Routing & scene transitions

Pages Router (Next 15+) is the current setup. For scene-to-scene transitions within a page (most of this app), GSAP-driven uniform changes are the right tool. For route-level transitions, intercept `router.events.routeChangeStart`, freeze the WebGL canvas via capture, then animate.

Do not introduce framer-motion `AnimatePresence` or next-page-transitions — keep transitions in GSAP/WebGL.

## State boundaries

- **App-level**: Lenis, CustomCursor, ScrollTrigger registration, theme.
- **Page-level**: Slider mode context (current scene), preloader state.
- **Component-level**: refs to renderer, scene, materials, RAF id. Never lift these to React state.
- **Per-frame**: uniforms. Never lift to React state.

## File-system conventions worth preserving

- `src/components/<domain>/<Component>.js` — domain folders (`final/`, `ring/`, `menu/`, `tools/`, `about/`).
- Shared shaders / utils don't currently have a home — when a shader is used by 2+ components, factor to `src/components/shaders/<name>.js` exporting tagged strings.
- Hooks in `src/hooks/`.

## Anti-patterns observed in this codebase

1. **15 iterations of `menu/index*.js`**: clear sign of exploration overflow. Before adding `index16.js`, see `consolidate-iterations` skill (if installed) or propose consolidation.
2. **Inline shaders duplicated across files**: the cover-UV helper and SDF rounded-corner snippet appear in multiple places. Centralize.
3. **CSS-in-JS-string injection** (e.g. `CAPTION_CSS` template literal in `FinalSlider4.js`): fine for component-local styles, but if 3+ components define the same caption pattern, lift to `globals.css` or a `<style jsx global>` block.

## When making architectural changes

- State the impact on the data-attribute contract.
- State whether the change affects the Lenis loop or RAF count.
- Confirm preloader gating still works for new media.
- Confirm cleanup paths (route change, remount) still dispose everything.
