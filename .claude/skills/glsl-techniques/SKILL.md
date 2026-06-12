---
name: glsl-techniques
description: GLSL shader patterns used in this repo — SDF rounded borders, chromatic aberration, lens distortion, cover-UV, color-range expansion, displacement, post-FX in the main fragment. Use whenever writing or modifying `vertexShader`/`fragmentShader` strings, `ShaderMaterial` uniforms, or any `.glsl` content. Pair with `three-vanilla-r182`.
---

# GLSL techniques — patterns from this repo

All shaders here are written as **inline tagged template strings** (`/* glsl */ \`...\``) inside the JS file that owns the material. Keep them there — there's no `.glsl` build pipeline.

## Boilerplate

```js
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
```

For a full-screen pass (orthographic), the same vertex shader works — just pass a `PlaneGeometry(2,2)`.

## Pattern: cover-UV (CSS `object-fit: cover` in shader)

Used to make a texture fill the canvas without distortion regardless of aspect mismatch. Reference: `menu/index15.js` `getCoverUV`.

```glsl
vec2 coverUV(vec2 uv, vec2 res, vec2 texSize) {
  vec2 s = res / texSize;
  float scale = max(s.x, s.y);
  vec2 scaled = texSize * scale;
  vec2 offset = (res - scaled) * 0.5;
  return (uv * res - offset) / scaled;
}
```

## Pattern: SDF rounded rectangle with smooth alpha

Reference: `FinalSlider4.js` `slideFrag`. Smoothstep edge in pixel space gives sub-pixel AA without MSAA.

```glsl
// uAspect = width/height of the quad
vec2 p = (vUv - 0.5);
p.x *= uAspect;
vec2 q = abs(p) - vec2(uAspect * 0.5, 0.5) + uRadius;
float d = length(max(q, 0.0)) - uRadius;
float a = smoothstep(0.006, -0.006, d);
if (a < 0.01) discard;       // avoid sampling outside
gl_FragColor = vec4(color.rgb, a);
```

Material flags: `transparent: true, depthWrite: false`.

## Pattern: chromatic aberration

Reference: `RingSLider4.js` `FRAG`. Cheap, looks expensive.

```glsl
float ab = uIntensity * 0.006;
float r = texture2D(uTex, uv + vec2(ab, 0.0)).r;
float g = texture2D(uTex, uv               ).g;
float b = texture2D(uTex, uv - vec2(ab, 0.0)).b;
float a = texture2D(uTex, uv               ).a;
gl_FragColor = vec4(r, g, b, a);
```

For radial CA scale `ab` by `length(vUv - 0.5)`.

## Pattern: lens distortion / magnifier bubble

Reference: `menu/index15.js` `getLensDistortion` — used for the spherical transition. Two SDFs (sphere + focus) drive `mFactor`, then push UVs along the radial direction.

Key insight: `mFactor = pow(mFactor, 5.0)` gives the strong falloff that makes it look like real refraction. Don't lower below 4.

## Pattern: BT.601 limited → full range

Some H.264 videos arrive in limited range (16-235 / 255). Reference: `FinalSlider4.js` lines 18-19.

```glsl
if (uExpandRange > 0.5) {
  c.rgb = (c.rgb - 0.062745) / 0.858824;
  c = clamp(c, 0.0, 1.0);
}
```

Only enable for sources you know are limited — applying twice crushes blacks.

## Pattern: vertex displacement (subtle distort along curved geometry)

Reference: `RingSLider4.js` `VERT`. The cylinder patch bows inward/outward in X based on V:

```glsl
vec3 p = position;
p.x += sin(uv.y * 3.14159265) * uDistort * 0.08;
gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
```

Combine with `RingSLider4.js` `makePatch` `curvature` parameter for the radial barrel/waist profile.

## Pattern: mask + mix for transitions

Reference: `menu/index15.js` main `void main()`. The full transition fragment is:

```glsl
float mask = step(bubbleRadius, dist);       // 0 inside the growing bubble
float finalMask = max(mask, 1.0 - d.inside);
gl_FragColor = mix(newImg, currentImg, finalMask);
```

`step` + `mix` is almost always cheaper than nested `if`. Use `smoothstep` if you want a feathered edge instead of a hard one.

## Conventions

- **Uniforms**: prefix with `u` (`uTex`, `uProgress`, `uTime`, `uResolution`). Two-uniform reads of the same texture in different swizzles is fine — the compiler dedupes.
- **Varyings**: prefix with `v`. Only pass what the fragment needs (UV and maybe a derived value). Each varying is interpolated per fragment — keep them few.
- **Precision**: don't declare `precision` at the top; three.js injects it. If you need `highp` for distance math, write `precision highp float;` explicitly.
- **No `#version`/`#extension` lines**: three.js prepends them.

## Common pitfalls

- Forgetting `tex.colorSpace = THREE.SRGBColorSpace` — colors look muddy.
- Sampling outside [0,1] without `tex.wrapS/wrapT = THREE.ClampToEdgeWrapping` — bleeds on rounded-corner SDFs.
- Branching with `if` on dynamic values is OK on modern GPUs, but prefer `step`/`mix`/`smoothstep` for short branches.
- `discard` is cheap on desktop but breaks early-Z; for full-screen passes prefer alpha blending.

## When proposing a new shader

1. State the input uniforms + their expected ranges.
2. Show the GLSL inline.
3. Note any material flags (`transparent`, `depthWrite`, `blending`) that must change.
4. Confirm whether it can fold into an existing fragment vs needing a new material.
