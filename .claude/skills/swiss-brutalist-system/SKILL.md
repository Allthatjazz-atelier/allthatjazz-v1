---
name: swiss-brutalist-system
description: Design system for this project — minimalist Swiss-brutalist adapted for 2026 immersive web. Typography, grid, color, micro-interactions, captions, cursor. Use whenever adding/editing UI surfaces, captions, menus, headings, buttons, layout, or making style judgment calls on visual decisions.
---

# Swiss-brutalist system — visual language

The aesthetic target: **top-tier digital experience agency**. Think Bureau Cool, Cosmos, Locomotive, Resn — minimal chrome, oversized type, generous negative space, asymmetric grids, monochrome with one accent, deliberate motion. Brutalist in confidence (raw, exposed, unapologetic), Swiss in discipline (grid, hierarchy, restraint).

This document is descriptive of intent. When in doubt: **less, larger, sharper**.

## Typography

- **Base font**: system stack `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. The repo's captions (`FinalSlider4.js` lines 56-66) use weight 800, 12px, letter-spacing `-0.045em`. Keep that as the small-label baseline.
- **Headings**: should feel oversized — 8vw–14vw at hero. Tighten letter-spacing on display sizes (`-0.04em` to `-0.06em`).
- **Weights**: 400 for body, 700-800 for emphasis, 900 only for hero display. Never use 300/light — clashes with brutalism.
- **Numerals**: tabular for counters/timers (`font-variant-numeric: tabular-nums`). Captions like `"01/05"` need this.
- **No italics** except for very specific accent moments. Brutalist type is upright.

## Color

- Base: `#FFFFFF` background, `#111111` text (the `#111` already used in captions). Pure black `#000` only for extreme emphasis — `#111` reads as confident-not-harsh.
- One accent maximum per surface. Aqua/teal already appears in label names ("Quiet Green", "Crimson Reign" etc. in `FinalSlider4.js`); treat those as palette anchors, not arbitrary colors per slide.
- Avoid gradients on UI. Gradients live inside WebGL fragments, not in CSS.
- Shadows: minimal. Either none, or a single hard offset (`2px 2px 0 #111`) for brutalist callouts. Never soft drop-shadows on UI.

## Layout & grid

- 12-column grid mental model, but **break it deliberately** — asymmetric placements (caption at 9/12, image at 1/8) feel right.
- Generous side padding on desktop: 24-48px minimum. Don't pad to center — flush-left or asymmetric placement is more brutalist.
- Vertical rhythm: 8pt scale (8/16/24/32/48/64/96).
- Full-bleed media is the default for hero modules. Boxed/contained is the exception.

## Captions & metadata

The pattern in `FinalSlider4.js` (`.slide-caption__label`, `.slide-caption__counter`) is the canonical micro-label style:

- Fixed-positioned over media
- 12px, weight 800, `-0.045em`, `#111`
- Fade in/out at 180ms ease
- `z-index: 9999` to sit above WebGL canvas
- Mobile variant: corners of the slide, flex justify between (counter + label)

Reuse this exact pattern for new captions. Don't reinvent.

## Micro-interactions

- **Hover**: opacity changes (1 → 0.6) or letter-spacing shifts (`-0.045em` → `-0.02em`) over 180-240ms. Never scale buttons.
- **Click feedback**: instant. No `transition: transform` on buttons — too web-2014.
- **Cursor**: custom (the `CustomCursor` already imported in `_app.js`). Cursor states convey interaction more than hover styles do.
- **Page transitions**: full-screen, WebGL-driven. Never CSS fade.

## Motion language

- Eases: `expo.inOut`, `power4.out` for hero; `power2.out`/`power3.out` for UI. Avoid bounce/elastic.
- Durations: 600-1400ms for hero motion, 180-300ms for UI. Anything <120ms reads as instant; >1500ms feels slow unless it's a deliberate cinematic moment.
- Stagger: 30-80ms between siblings. Stagger > simultaneous for lists.
- Pair motion with a sound design moment (if/when audio is added) — but no sound is better than bad sound.

## Imagery

- Treatments are part of the brand: SDF rounded corners (radius 0.04-0.08 in shader units = ~24-48px visual), chromatic aberration on motion, lens distortion on transitions. See `glsl-techniques`.
- Raw images without WebGL treatment should be rare — it weakens the immersive signature.

## Don'ts

- ❌ Rounded buttons with soft shadows (this is not a SaaS dashboard)
- ❌ Gradient backgrounds in CSS
- ❌ Lottie / GIF — everything motion is GSAP + WebGL
- ❌ Material UI / Chakra / Radix UI components (any pre-styled lib breaks the language)
- ❌ Centered hero text in a max-width container with generic CTA below
- ❌ Cookie banners over the hero — defer to scroll
- ❌ Emoji in UI text

## When proposing UI

1. Confirm the type system: which font weight, which size in the scale.
2. Confirm grid position: which columns, asymmetry.
3. Confirm motion: ease + duration.
4. Confirm there's only one accent on the surface.
5. If introducing a new pattern, name it consistently with existing classes (`slide-caption__label` style — BEM-ish kebab + double underscore).
