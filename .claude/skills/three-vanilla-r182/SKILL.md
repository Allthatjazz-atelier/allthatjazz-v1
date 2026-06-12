---
name: three-vanilla-r182
description: Vanilla three.js r182 (imperative, NOT React Three Fiber) inside Next.js + React 19 useEffect. Use whenever editing code that imports `three` directly, builds scenes/renderers/materials/geometries by hand, or touches files like `FinalSlider*.js`, `RingSlider*.js`, `menu/index*.js`. Do NOT use for @react-three/fiber or @react-three/drei code (this repo doesn't use them).
---

# three.js vanilla — conventions for this repo

This project does **not** use react-three-fiber. Every scene is built imperatively inside `useEffect` and torn down in the cleanup. Always match that style — never propose R3F/drei.

## Mount/unmount skeleton

```js
useEffect(() => {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.current,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 100);

  // ... build meshes ...

  let raf = 0;
  const tick = (t) => {
    // update uniforms with t
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onResize = () => { /* update camera + renderer */ };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v?.isTexture && v.dispose());
          m.dispose();
        });
      }
    });
    renderer.dispose();
  };
}, []);
```

**Never leak**: cancel RAF, remove listeners, dispose geometries, materials, textures, and the renderer. Forgetting any of these is the #1 cause of leaks across remounts.

## Geometry conventions

- Custom `BufferGeometry` over primitives when the shape isn't trivial. Reference: `makePatch` in `src/components/ring/RingSLider4.js` (curved cylinder patch, parametric in θ and Y with optional curvature bell).
- Always set `position` (3), `uv` (2), `index`, then `computeVertexNormals()`.
- For full-screen quads use a plain `PlaneGeometry(2, 2)` with an `OrthographicCamera(-1,1,1,-1,0,1)`.

## Materials

- 99% of the work here is `ShaderMaterial` with inline GLSL strings. See `glsl-techniques` skill for the shader patterns.
- For transparent/SDF-masked materials use `transparent: true, depthWrite: false`. If you `discard` in the fragment for the alpha=0 region (as in `FinalSlider4.js` `slideFrag`), keep `depthWrite: false` so it composites cleanly.
- Set `premultipliedAlpha: false` only if you have a specific reason — match the renderer default otherwise.

## Textures

- **Images**: `new THREE.TextureLoader().load(src)`. Always set `tex.colorSpace = THREE.SRGBColorSpace` for albedo, and `tex.anisotropy = renderer.capabilities.getMaxAnisotropy()` for slanted views.
- **Video**: `new THREE.VideoTexture(videoEl)`. Set `tex.colorSpace = THREE.SRGBColorSpace`. If the source is BT.601 limited range (common with H.264 from some encoders), the project compensates in the fragment via `uExpandRange` — see `FinalSlider4.js` lines 13-30.
- **Canvas capture**: `new THREE.CanvasTexture(canvas)` with `tex.minFilter = tex.magFilter = THREE.LinearFilter` for ad-hoc compositing. Pattern used in `menu/index15.js` `capturePageTexture`.
- Always `tex.dispose()` on cleanup. Video textures need the underlying `<video>` to be paused/removed too.

## Renderer flags worth knowing in r182

- `renderer.outputColorSpace = THREE.SRGBColorSpace` (default in r152+, but explicit beats implicit).
- `renderer.toneMapping = THREE.ACESFilmicToneMapping` only when intentionally using HDR/PBR — otherwise leave `NoToneMapping` to avoid washed-out colors with raw textures.
- `renderer.setClearColor(0x000000, 0)` when overlaying on HTML.

## Resize handling

- Debounce/throttle is usually not needed if you only update `camera.aspect`, `camera.updateProjectionMatrix()`, and `renderer.setSize(w, h, false)` (the `false` skips CSS resize — let CSS own layout).
- For `ShaderMaterial` with a `uResolution` uniform, update it inside `onResize`.

## What this repo does NOT use

- ❌ react-three-fiber, drei
- ❌ EffectComposer / postprocessing.js (post-FX is done in the main fragment)
- ❌ GLTFLoader / DRACOLoader (no 3D assets — everything is procedural geometry + image/video textures)
- ❌ OrbitControls (custom pointer drag, e.g. `Knob` in `RingSLider4.js`)

Don't introduce any of these without asking first.

## When proposing changes

- Cite specific lines you're changing.
- If you need a new shader, propose the GLSL inline as a string (matching the `/* glsl */` tagged template style in `RingSLider4.js`).
- If you propose a new component, follow the naming + iteration pattern *only after consulting* `consolidate-iterations` — don't blindly create `FinalSlider5.js`.
