"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { SPACE_IMAGES, ALL_VIDEOS } from "@/data/mediaCatalog";

const IMAGE_NAMES = SPACE_IMAGES;
const VIDEO_NAMES = ALL_VIDEOS;

// Campo: derivado mobile (~1080). Focus: desktop (~1920) en pantallas grandes.
// WebP (no AVIF/HEIC): WebGL-safe y conserva alpha + croma mejor que el JPEG aplanado.
const IMAGE_COPIES = 2;
const isHeic = (p) => /\.hei[cf]$/i.test(p || "");
const isWebglSafe = (p) => p && !isHeic(p) && !/\.avif$/i.test(p);
const toFieldUrl = (url) => (url || "").replace(".desktop.", ".mobile.");

const toWebp = (p) => (p || "").replace(/\.avif$/i, ".webp");

const pickWebglUrl = (img) => {
  const fromAvif = toWebp(img.src);
  const list = [fromAvif, img.src, img.fallback].filter(isWebglSafe);
  return list.find((s) => /\.webp$/i.test(s)) || list[0] || null;
};

// ─── Shaders ───────────────────────────────────────────────────────────────────
const VERT = /* glsl */ `
  uniform vec2 uSize;
  varying vec2  vUv;
  varying float vDepth;

  void main() {
    vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * uSize, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    vUv    = uv;
    vDepth = -mvCenter.z;
  }
`;

const FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vDepth;

  uniform sampler2D uTex;
  uniform float uVisNear;
  uniform float uVisFarStart;
  uniform float uFlipV;
  uniform float uOpacity;
  uniform float uExpandRange;

  void main() {
    if (uOpacity < 0.004) discard;
    if (vDepth < uVisNear || vDepth > uVisFarStart) discard;

    vec2 uv = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, uFlipV));
    vec4 texel = texture2D(uTex, uv);
    vec3 rgb = mix(
      texel.rgb,
      clamp((texel.rgb - 0.062745) / 0.858824, 0.0, 1.0),
      uExpandRange
    );
    float a = texel.a * uOpacity;
    gl_FragColor = vec4(mix(vec3(1.0), rgb, a), 1.0);
  }
`;

export default function Space3dFocusOpt({
  count,
  box     = { x: 30, y: 18, z: 42 },
  damping = 0.085,

  visNearEnd  = 1.0,
  visNear     = 3.0,
  visFarStart = 40.0,
  visFarEnd   = 50.0,
} = {}) {
  const canvasRef = useRef(null);

  const { getImage, getVideo, isLoaded, imageIds, videoIds } = useOptimizedMedia();
  const getImageRef = useRef(getImage);
  const getVideoRef = useRef(getVideo);
  const imageIdsRef = useRef(imageIds);
  const videoIdsRef = useRef(videoIds);
  getImageRef.current = getImage;
  getVideoRef.current = getVideo;
  imageIdsRef.current = imageIds;
  videoIdsRef.current = videoIds;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded) return;

    const isMobile = window.innerWidth <= 768;
    const dprCap = isMobile ? 1 : 2;

    const imageNames = imageIdsRef.current.length ? imageIdsRef.current : IMAGE_NAMES;
    const imageSrcs = imageNames
      .map((n) => {
        const img = getImageRef.current(n);
        const hi = pickWebglUrl(img);
        if (!hi) return null;
        const jpg = isWebglSafe(img.fallback) ? img.fallback : null;
        return {
          field: toFieldUrl(hi),
          hi,
          fieldFb: jpg ? toFieldUrl(jpg) : null,
          hiFb: jpg && jpg !== hi ? jpg : null,
        };
      })
      .filter(Boolean);
    const videoNames = videoIdsRef.current.length ? videoIdsRef.current : VIDEO_NAMES;
    const videoData = videoNames.map((n) => {
      const v = getVideoRef.current(n);
      return { sources: v.sources, poster: v.poster };
    });

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      alpha: false,
      // RouteTransition ya no hace readback; About de index17 tampoco.
      preserveDrawingBuffer: false,
      powerPreference: isMobile ? "default" : "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xffffff, 1);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      Math.max(box.x, box.z) * 4,
    );

    const plane = new THREE.PlaneGeometry(1, 1);
    const loader = new THREE.TextureLoader();

    const placeholderTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat,
    );
    placeholderTex.flipY = false;
    placeholderTex.premultiplyAlpha = false;
    placeholderTex.generateMipmaps = false;
    placeholderTex.minFilter = THREE.NearestFilter;
    placeholderTex.magFilter = THREE.NearestFilter;
    placeholderTex.needsUpdate = true;

    const texCache = new Map();
    const texWaiting = new Map();

    const configureImageTexture = (tex) => {
      tex.colorSpace        = THREE.SRGBColorSpace;
      // Billboards de cara a cámara: aniso no aporta y gasta bandwidth.
      tex.anisotropy        = 1;
      tex.generateMipmaps   = true;
      tex.minFilter         = THREE.LinearMipmapLinearFilter;
      tex.magFilter         = THREE.LinearFilter;
      tex.flipY             = true;
      tex.premultiplyAlpha  = false;
    };

    const loadImage = (src, cb, fallback) => {
      if (!src) {
        if (fallback) loadImage(fallback, cb);
        return;
      }
      const cached = texCache.get(src);
      if (cached) { cb(cached); return; }
      const waiting = texWaiting.get(src);
      if (waiting) { waiting.push(cb); return; }
      texWaiting.set(src, [cb]);
      loader.load(
        src,
        (tex) => {
          configureImageTexture(tex);
          const w = tex.image?.width || 1;
          const h = tex.image?.height || 1;
          const entry = { tex, aspect: w / h };
          texCache.set(src, entry);
          (texWaiting.get(src) || []).forEach((fn) => fn(entry));
          texWaiting.delete(src);
        },
        undefined,
        () => {
          texWaiting.delete(src);
          if (fallback && fallback !== src) loadImage(fallback, cb);
        },
      );
    };

    const applyAspect = (item, aspect) => {
      const ar = Math.min(2.6, Math.max(0.4, aspect));
      const s  = Math.sqrt(ar);
      item.mat.uniforms.uSize.value.set(item.scaleBase * s, item.scaleBase / s);
    };

    const slots = [
      ...imageSrcs.flatMap((img) =>
        Array.from({ length: IMAGE_COPIES }, () => ({
          type: "image",
          ...img,
        })),
      ),
      ...videoData.map((vd) => ({ type: "video", sources: vd.sources, poster: vd.poster })),
    ];
    const total = typeof count === "number" ? Math.min(count, slots.length) : slots.length;
    const limitedSlots = slots.slice(0, total);

    const slotKey = (slot) =>
      slot.type === "video"
        ? `v:${slot.sources?.[0]?.src || slot.poster || ""}`
        : `i:${slot.hi || slot.field}`;

    const uniques = [];
    const dupes = [];
    const seenKeys = new Set();
    for (const slot of limitedSlots) {
      const k = slotKey(slot);
      if (seenKeys.has(k)) dupes.push(slot);
      else {
        seenKeys.add(k);
        uniques.push(slot);
      }
    }
    uniques.sort((a, b) => (a.type === "video" ? 0 : 1) - (b.type === "video" ? 0 : 1));

    const randInBox = () => new THREE.Vector3(
      (Math.random() - 0.5) * box.x,
      (Math.random() - 0.5) * box.y,
      (Math.random() - 0.5) * box.z,
    );

    const occupied = [];
    const siblingsOf = new Map();
    const placePoint = (siblings = [], attempts = 40) => {
      let best = randInBox();
      let bestScore = -1;
      for (let t = 0; t < attempts; t++) {
        const p = randInBox();
        let nearest = Infinity;
        for (const q of occupied) {
          const d = p.distanceToSquared(q);
          if (d < nearest) nearest = d;
        }
        let sib = Infinity;
        for (const q of siblings) {
          const d = p.distanceToSquared(q);
          if (d < sib) sib = d;
        }
        const score = siblings.length ? nearest * 0.3 + sib * 0.7 : nearest;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      occupied.push(best);
      return best;
    };

    const placed = [];
    for (const slot of uniques) {
      const p = placePoint();
      siblingsOf.set(slotKey(slot), [p]);
      placed.push({ slot, pos: p });
    }
    for (const slot of dupes) {
      const sibs = siblingsOf.get(slotKey(slot)) || [];
      const p = placePoint(sibs);
      sibs.push(p);
      placed.push({ slot, pos: p });
    }

    const items = [];
    const videoItems = [];
    const videoEls = [];

    const bindFieldTex = (item, { tex, aspect }) => {
      item.fieldTex = tex;
      if (!item.hiBound && !item.active) item.mat.uniforms.uTex.value = tex;
      applyAspect(item, aspect);
    };

    const ensureHiRes = (item) => {
      if (item.type !== "image" || !item.hiSrc || item.hiSrc === item.fieldSrc) return;
      if (item.hiBound) return;
      loadImage(item.hiSrc, ({ tex, aspect }) => {
        item.hiTex = tex;
        item.hiBound = true;
        applyAspect(item, aspect);
        if (focus.item === item && !item.active) {
          item.mat.uniforms.uTex.value = tex;
        }
      }, item.hiFb);
    };

    for (const { slot, pos } of placed) {
      const scaleBase = 1.15 + Math.random() * 1.35;

      const uniforms = {
        uTex:          { value: placeholderTex },
        uSize:         { value: new THREE.Vector2(scaleBase, scaleBase) },
        uVisNear:      { value: visNear },
        uVisFarStart:  { value: visFarStart },
        uFlipV:        { value: 0 },
        uOpacity:      { value: 1 },
        uExpandRange:  { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        toneMapped: true,
      });

      const mesh = new THREE.Mesh(plane, mat);
      mesh.position.copy(pos);
      mesh.frustumCulled = false;
      scene.add(mesh);

      const item = {
        mesh,
        mat,
        scaleBase,
        type: slot.type,
        active: false,
        homePos: pos.clone(),
        fieldTex: null,
        hiTex: null,
        hiBound: false,
      };
      items.push(item);

      if (slot.type === "video") {
        item.sources = slot.sources;
        item.poster  = slot.poster;
        item.posterTex = null;
        item.video     = null;
        item.videoTex  = null;
        videoItems.push(item);
        if (slot.poster) {
          loadImage(slot.poster, ({ tex, aspect }) => {
            item.posterTex = tex;
            if (!item.active) item.mat.uniforms.uTex.value = tex;
            applyAspect(item, aspect);
          });
        }
      } else {
        item.fieldSrc = slot.field;
        item.hiSrc = slot.hi;
        item.hiFb = slot.hiFb;
        loadImage(slot.field, (entry) => bindFieldTex(item, entry), slot.fieldFb || slot.hi);
      }
    }

    const MAX_ACTIVE_VIDEOS = isMobile ? 2 : 3;

    const activateVideo = (item) => {
      if (!item.video) {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = "auto";
        vid.crossOrigin = "anonymous";
        const src = item.sources?.[0]?.src;
        if (src) vid.src = encodeURI(src);
        vid.style.display = "none";
        document.body.appendChild(vid);

        const vtex = new THREE.VideoTexture(vid);
        vtex.colorSpace = THREE.SRGBColorSpace;
        vtex.minFilter = THREE.LinearFilter;
        vtex.magFilter = THREE.LinearFilter;
        vtex.generateMipmaps = false;
        vtex.flipY = false;
        vtex.premultiplyAlpha = false;

        vid.addEventListener("loadedmetadata", () => {
          if (vid.videoWidth && vid.videoHeight) {
            applyAspect(item, vid.videoWidth / vid.videoHeight);
            if (focus.item === item) {
              const fit = fitDistFor(item);
              gsap.to(state, { dist: fit, targetDist: fit, duration: 0.4, ease: "power2.out" });
            }
          }
        });

        item.video = vid;
        item.videoTex = vtex;
        videoEls.push(vid);
      }
      item.active = true;
      item.mat.uniforms.uTex.value = item.videoTex;
      item.mat.uniforms.uFlipV.value = 1;
      item.mat.uniforms.uExpandRange.value = 1;
      item.video.play().catch(() => {});
    };

    const deactivateVideo = (item) => {
      if (!item.active) return;
      item.active = false;
      if (item.video) item.video.pause();
      item.mat.uniforms.uTex.value = item.posterTex || placeholderTex;
      item.mat.uniforms.uFlipV.value = 0;
      item.mat.uniforms.uExpandRange.value = 0;
    };

    const updateActiveVideos = () => {
      if (!videoItems.length) return;
      if (focus.item) {
        for (const it of videoItems) {
          if (it === focus.item) { if (!it.active) activateVideo(it); }
          else { if (it.active) deactivateVideo(it); }
        }
        return;
      }
      const cam = camera.position;
      const ranked = videoItems
        .map((it) => ({ it, d: cam.distanceToSquared(it.mesh.position) }))
        .filter((o) => {
          const d = Math.sqrt(o.d);
          return d >= visNear * 0.7 && d <= visFarStart * 1.15;
        })
        .sort((a, b) => a.d - b.d);

      const activeSet = new Set(ranked.slice(0, MAX_ACTIVE_VIDEOS).map((o) => o.it));
      for (const it of videoItems) {
        if (activeSet.has(it)) { if (!it.active) activateVideo(it); }
        else { if (it.active) deactivateVideo(it); }
      }
    };

    const PITCH_LIMIT = Math.PI / 2 - 0.05;
    const startDist = box.z * 0.52;
    const maxDist = Math.max(box.z * 0.75, visFarStart * 0.85);
    const minDist = visNear + 0.6;

    const state = {
      yaw: 0, pitch: 0, dist: startDist,
      targetYaw: 0, targetPitch: 0, targetDist: startDist,
      minDist, maxDist,
    };

    const applyCamera = () => {
      const cp = Math.cos(state.pitch);
      camera.position.x = state.dist * cp * Math.sin(state.yaw);
      camera.position.y = state.dist * Math.sin(state.pitch);
      camera.position.z = state.dist * cp * Math.cos(state.yaw);
      camera.lookAt(0, 0, 0);
    };
    applyCamera();

    const focus = { item: null, locked: false, saved: null };
    const CLICK_PX = 8;

    const fitDistFor = (item) => {
      const sz = item.mat.uniforms.uSize.value;
      const vFov = (camera.fov * Math.PI) / 180;
      const margin = 0.68;
      const distH = sz.y / (2 * Math.tan(vFov / 2) * margin);
      const distW = sz.x / (2 * Math.tan(vFov / 2) * camera.aspect * margin);
      return Math.max(distH, distW, 1.6);
    };

    let canvasRect = canvas.getBoundingClientRect();
    const refreshRect = () => { canvasRect = canvas.getBoundingClientRect(); };

    const nearSq = (visNear * 0.85) ** 2;
    const farSq  = (visFarStart * 1.15) ** 2;
    const hitFarSq = (visFarStart * 1.05) ** 2;
    const hitNearSq = (visNear * 0.85) ** 2;

    const hitTest = (clientX, clientY) => {
      const mx = clientX - canvasRect.left;
      const my = clientY - canvasRect.top;
      const w = canvasRect.width;
      const h = canvasRect.height;
      const vFov = (camera.fov * Math.PI) / 180;
      let best = null;
      let bestD = Infinity;
      const ndc = new THREE.Vector3();
      const camPos = camera.position;
      for (const item of items) {
        if (!item.mesh.visible) continue;
        if (item.mat.uniforms.uOpacity.value < 0.05) continue;
        ndc.copy(item.mesh.position).project(camera);
        if (ndc.z < -1 || ndc.z > 1) continue;
        const sx = (ndc.x * 0.5 + 0.5) * w;
        const sy = (-ndc.y * 0.5 + 0.5) * h;
        const distSq = camPos.distanceToSquared(item.mesh.position);
        if (distSq < hitNearSq || distSq > hitFarSq) continue;
        const dist = Math.sqrt(distSq);
        const worldPerPx = (2 * dist * Math.tan(vFov / 2)) / h;
        const sz = item.mat.uniforms.uSize.value;
        const hw = (sz.x / worldPerPx) * 0.5;
        const hh = (sz.y / worldPerPx) * 0.5;
        if (Math.abs(mx - sx) <= hw && Math.abs(my - sy) <= hh && dist < bestD) {
          bestD = dist;
          best = item;
        }
      }
      return best;
    };

    const cullItems = () => {
      const camPos = camera.position;
      if (focus.item) {
        for (const it of items) {
          it.mesh.visible = it.mat.uniforms.uOpacity.value >= 0.004;
        }
        return;
      }
      for (const it of items) {
        if (it.mat.uniforms.uOpacity.value < 0.004) {
          it.mesh.visible = false;
          continue;
        }
        const d = camPos.distanceToSquared(it.mesh.position);
        it.mesh.visible = d >= nearSq && d <= farSq;
      }
    };

    const enterFocus = (item) => {
      if (focus.item || !item) return;
      focus.item = item;
      focus.locked = true;
      focus.saved = {
        yaw: state.yaw,
        pitch: state.pitch,
        dist: state.dist,
        targetYaw: state.targetYaw,
        targetPitch: state.targetPitch,
        targetDist: state.targetDist,
      };

      gsap.killTweensOf(state);
      for (const it of items) gsap.killTweensOf(it.mat.uniforms.uOpacity);
      gsap.killTweensOf(item.mesh.position);

      ensureHiRes(item);

      const fit = fitDistFor(item);
      item.mat.uniforms.uVisNear.value = 0.01;
      item.mat.uniforms.uVisFarStart.value = 400;

      for (const it of items) {
        if (it === item) {
          gsap.to(it.mat.uniforms.uOpacity, { value: 1, duration: 0.3, ease: "power2.out" });
        } else {
          gsap.to(it.mat.uniforms.uOpacity, { value: 0, duration: 0.55, ease: "power2.out" });
        }
      }

      gsap.to(item.mesh.position, {
        x: 0, y: 0, z: 0,
        duration: 1.05,
        ease: "power3.inOut",
      });
      gsap.to(state, {
        yaw: 0, pitch: 0, dist: fit,
        targetYaw: 0, targetPitch: 0, targetDist: fit,
        duration: 1.05,
        ease: "power3.inOut",
      });

      if (item.type === "video") activateVideo(item);
      canvas.style.cursor = "default";
    };

    const exitFocus = () => {
      const item = focus.item;
      if (!item || !focus.saved) return;
      const saved = focus.saved;

      gsap.killTweensOf(state);
      for (const it of items) gsap.killTweensOf(it.mat.uniforms.uOpacity);
      gsap.killTweensOf(item.mesh.position);

      gsap.to(item.mesh.position, {
        x: item.homePos.x,
        y: item.homePos.y,
        z: item.homePos.z,
        duration: 1.25,
        ease: "power3.inOut",
      });
      gsap.to(state, {
        yaw: saved.yaw,
        pitch: saved.pitch,
        dist: saved.dist,
        targetYaw: saved.targetYaw,
        targetPitch: saved.targetPitch,
        targetDist: saved.targetDist,
        duration: 1.25,
        ease: "power3.inOut",
        onComplete: () => {
          item.mat.uniforms.uVisNear.value = visNear;
          item.mat.uniforms.uVisFarStart.value = visFarStart;
          focus.item = null;
          focus.locked = false;
          focus.saved = null;
        },
      });
      for (const it of items) {
        if (it === item) continue;
        gsap.to(it.mat.uniforms.uOpacity, {
          value: 1,
          duration: 0.9,
          delay: 0.4,
          ease: "power2.out",
        });
      }
    };

    const drag = { active: false, x: 0, y: 0, sx: 0, sy: 0, moved: false };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      refreshRect();
      drag.active = true;
      drag.moved = false;
      drag.x = drag.sx = e.clientX;
      drag.y = drag.sy = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      if (!focus.item) canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e) => {
      if (!drag.active) {
        if (!focus.item) {
          canvas.style.cursor = hitTest(e.clientX, e.clientY) ? "pointer" : "grab";
        }
        return;
      }
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > CLICK_PX) drag.moved = true;
      if (focus.item) return;
      const k = 0.005;
      state.targetYaw   -= dx * k;
      state.targetPitch += dy * k;
      state.targetPitch  = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.targetPitch));
    };

    const onPointerUp = (e) => {
      const wasClick = drag.active && !drag.moved;
      drag.active = false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* ok */ }
      if (wasClick) {
        if (focus.item) exitFocus();
        else {
          const hit = hitTest(e.clientX, e.clientY);
          if (hit) enterFocus(hit);
        }
      }
      if (!focus.item) canvas.style.cursor = "grab";
    };

    const onWheel = (e) => {
      e.preventDefault();
      if (focus.item) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      state.targetDist = Math.max(
        state.minDist,
        Math.min(state.maxDist, state.targetDist + dy * 0.018),
      );
    };

    let pinchStartDist = 0;
    let pinchStartCamDist = 0;
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartCamDist = state.targetDist;
        drag.active = false;
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault();
        if (focus.item) return;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d  = Math.hypot(dx, dy);
        const next = pinchStartCamDist - (d / pinchStartDist - 1) * Math.max(10, Math.abs(pinchStartCamDist));
        state.targetDist = Math.max(state.minDist, Math.min(state.maxDist, next));
      }
    };
    const onTouchEnd = () => { pinchStartDist = 0; };

    canvas.addEventListener("pointerdown",   onPointerDown);
    canvas.addEventListener("pointermove",   onPointerMove);
    canvas.addEventListener("pointerup",     onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel",         onWheel, { passive: false });
    canvas.addEventListener("touchstart",    onTouchStart, { passive: true });
    canvas.addEventListener("touchmove",     onTouchMove,  { passive: false });
    canvas.addEventListener("touchend",      onTouchEnd);

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cap = w <= 768 ? 1 : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      refreshRect();
      if (focus.item) {
        const fit = fitDistFor(focus.item);
        state.dist = state.targetDist = fit;
      }
    };
    window.addEventListener("resize", onResize);

    const onKeyDown = (e) => {
      if (e.key === "Escape" && focus.item) exitFocus();
    };
    window.addEventListener("keydown", onKeyDown);

    let visible = !document.hidden;
    const onVisibility = () => {
      visible = !document.hidden;
      if (document.hidden) videoItems.forEach((it) => it.video?.pause());
    };
    document.addEventListener("visibilitychange", onVisibility);

    let raf = 0;
    let frame = 0;
    let readyDispatched = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;

      if (!focus.locked) {
        state.yaw   += (state.targetYaw   - state.yaw)   * damping;
        state.pitch += (state.targetPitch - state.pitch) * damping;
        state.dist  += (state.targetDist  - state.dist)  * damping;
      }
      applyCamera();
      cullItems();

      if (frame % 12 === 0) updateActiveVideos();
      for (const it of videoItems) {
        if (it.active && it.videoTex) it.videoTex.needsUpdate = true;
      }
      frame++;

      renderer.render(scene, camera);

      if (!readyDispatched) {
        readyDispatched = true;
        window.dispatchEvent(new CustomEvent("atj-scene-ready"));
      }
    };
    raf = requestAnimationFrame(tick);

    canvas.style.cursor = "grab";

    return () => {
      cancelAnimationFrame(raf);
      gsap.killTweensOf(state);
      items.forEach((it) => {
        gsap.killTweensOf(it.mat.uniforms.uOpacity);
        gsap.killTweensOf(it.mesh.position);
      });
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown",   onPointerDown);
      canvas.removeEventListener("pointermove",   onPointerMove);
      canvas.removeEventListener("pointerup",     onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel",         onWheel);
      canvas.removeEventListener("touchstart",    onTouchStart);
      canvas.removeEventListener("touchmove",     onTouchMove);
      canvas.removeEventListener("touchend",      onTouchEnd);

      items.forEach((it) => it.mat.dispose());
      texCache.forEach(({ tex }) => tex.dispose());
      placeholderTex.dispose();
      videoItems.forEach((it) => {
        if (it.videoTex) it.videoTex.dispose();
        if (it.video) {
          it.video.pause();
          it.video.removeAttribute("src");
          it.video.load?.();
          it.video.remove();
        }
      });
      plane.dispose();
      renderer.dispose();
    };
  }, [isLoaded, count, box.x, box.y, box.z, damping, visNearEnd, visNear, visFarStart, visFarEnd]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#fff",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        data-space3d-canvas="true"
        style={{ display: "block", width: "100vw", height: "100vh" }}
      />
    </div>
  );
}
