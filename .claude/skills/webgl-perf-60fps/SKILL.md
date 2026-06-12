---
name: webgl-perf-60fps
description: Performance rules for keeping this WebGL + GSAP + Lenis app at 60fps (120fps on capable displays) across desktop and mid-range mobile. Use whenever adding/editing scenes, animations, or any code path that runs every frame, and proactively when sustaining smoothness matters ("smooth", "lag", "stutter", "jank").
---

# WebGL perf — keeping it mega smooth

The project's identity depends on smooth motion. A dropped frame in a hero transition kills the "agency-tier" feel. Apply these rules proactively, not as a post-hoc audit.

## Frame budget

- 60fps → 16.6ms/frame. Realistic budget for app work: ~10ms (browser eats the rest).
- 120fps display → 8.3ms/frame. Code must stay under ~5ms.
- Mobile (mid-range iPhone/Android) is the real target. Test there before claiming "smooth."

## Rendering loop — one RAF to rule them all

**Anti-pattern**: each component starts its own `requestAnimationFrame`. With 3 sliders, 1 cursor, 1 Lenis, that's 5 RAFs all calling `renderer.render` independently.

**Rule**: each component that owns a renderer drives its own RAF (current pattern), but never spawn extra RAFs for non-render work — pipe everything through GSAP's ticker or React state batched via `requestAnimationFrame` once.

```js
gsap.ticker.add((time) => {
  // runs on the same frame as GSAP tweens
});
```

Lenis already syncs with rAF in `_app.js`. Don't add a second Lenis loop.

## Renderer setup

- `setPixelRatio(Math.min(window.devicePixelRatio, 2))` — capping at 2 saves 50%+ fillrate on Retina/iPhone Pro.
- `antialias: true` is fine for small/medium canvases; for full-screen heavy fragments, disable AA and rely on shader smoothstep.
- `powerPreference: "high-performance"` for hero canvases on desktop. Mobile ignores this.
- `alpha: true` only if compositing over DOM — otherwise opaque is faster (one less blend per pixel).

## Texture costs

- Upload once, reuse. **Never** create a `CanvasTexture` per frame. The `capturePageTexture` pattern in `menu/index15.js` is fine for one-shot transitions; cache the result for the duration of the transition.
- `tex.needsUpdate = true` only when the source actually changed (video frame, canvas redraw).
- Mipmaps cost VRAM and a one-time GPU upload. For UI textures rendered at native size set `tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter`.
- Decode images via `createImageBitmap` (used implicitly by `TextureLoader` in modern browsers).

## Geometry

- Reuse `BufferGeometry` across instances of the same shape. Don't rebuild `makePatch(...)` every render.
- For static geometry, set `geometry.setUsage(THREE.StaticDrawUsage)`. For per-frame vertex updates use `DynamicDrawUsage` and update only the changed range with `geometry.attributes.position.needsUpdate = true` plus an `updateRange`.

## Shader cost

- Each `texture2D` call is a memory op. The chromatic aberration in `RingSLider4.js` does 4 reads — fine. Don't go past ~8 per fragment for full-screen.
- `discard` is cheap on desktop but breaks early-Z on tile-based mobile GPUs. For SDF alphas on full-screen overlays prefer alpha blend over `discard`.
- `pow(x, 5.0)` is fine; replace with `x*x*x*x*x` if you're micro-optimizing a hot loop.
- Avoid `if` branches that diverge across a warp/wave — use `mix(a, b, step(...))`.

## React + Three lifecycle

- Three.js scenes mount/unmount on route change. If a route mounts/unmounts a heavy scene rapidly, the GC churn kills frame pacing. Use `useRef` to cache the renderer and rebuild scene-level objects only.
- `useMemo` for derived data (resolved media URLs, geometry params) — but **not** for renderers/textures. Side effects live in `useEffect`.
- Don't put per-frame state into React state — that's a re-render per frame. Use refs.

## Video textures

- `<video>` must be `playsInline muted` to autoplay on mobile.
- A paused video texture still costs nothing per frame **unless** you keep calling `tex.needsUpdate = true`. Don't.
- Multiple simultaneous video decodes choke mobile Safari hard. Limit to 1-2 concurrent playing videos; pause the rest.

## Lenis / scroll perf

- Animating `transform` and `opacity` only. Anything triggering layout (top/left/width/height/margin) kills smooth scroll.
- `will-change: transform` on the few elements that animate continuously. Don't sprinkle it everywhere — it allocates a layer each time.
- ScrollTrigger `scrub: 0.5..1` smooths chunky scenes. `scrub: true` (no number) is instant and can feel jittery.

## DOM around the canvas

- Avoid layout reads (`offsetWidth`, `getBoundingClientRect`) inside the RAF loop — they force synchronous layout. Cache on mount + on resize.
- `IntersectionObserver` to know when a heavy scene is off-screen — pause its RAF or skip `renderer.render`.

```js
const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; });
// inside RAF: if (!visibleRef.current) return raf = requestAnimationFrame(tick);
```

## Pause when hidden

```js
const onVis = () => { document.hidden ? pause() : resume(); };
document.addEventListener("visibilitychange", onVis);
```

Prevents burning battery + keeps video sync clean.

## Measuring

- Chrome DevTools → Performance → record 5s of the interaction. Look for long tasks (>16ms) and the "GPU" track.
- `stats.js` is fine for dev — gate it behind `if (process.env.NODE_ENV !== "production")`.
- For shader cost specifically, Spector.js gives a per-draw breakdown.

## Quick checklist before claiming "smooth"

1. Test on a mid-range phone (or Chrome DevTools mobile throttle 4x CPU + slow 4G).
2. Hard-reload, watch frame rate during the hero entry and any transition.
3. Scroll through the page — no scroll jank, no layout shift.
4. Open another tab, return — scene resumes cleanly.
5. Remount the page (route in/out) — no leaked listeners, RAF count steady (DevTools > Performance > "Long animation frames").
