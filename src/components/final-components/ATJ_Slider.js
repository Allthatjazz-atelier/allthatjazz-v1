"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { buildPieces } from "@/data/pieces";

// ─── Slider horizontal plano ───────────────────────────────────────────────────
// Sin WebGL: DOM + transforms. Reproduce exactamente la métrica del VideoSlider
// de three.js. La caja sale de su cámara: fov 45, z=5 y los planos asentados en
// z=-0.8 en desktop (z=0 en móvil) dan una altura visible de 4.8049 / 6.6274
// unidades, y el plano de 2.0×2.5 / 3.8×4.25 ocupa 52.03vh / 64.13vh.
// Y como allí, el medio se encaja DENTRO de la caja conservando su proporción
// (`videoBaseScale`): la caja marca el ritmo, el medio se ve a su tamaño.
//
// El contenido sale de `@/data/pieces`: la misma lista y el mismo orden que usará
// la galaxia. Las galerías van seguidas y dentro de cada una se baraja, así que
// imágenes y vídeos se alternan sin patrón visible pero cada tramo contiguo de la
// tira es un cúmulo — al morphar, la tira se despliega en vez de cruzarse toda la
// pantalla. El componente publica además el rectángulo de cada pieza por
// `viewRef`: es lo único que necesita la galaxia para continuar sin salto (FLIP).

const SLIDE_VH = { desktop: 52.03, mobile: 64.13 };      // alto de la caja, en vh
const SLIDE_AR = { desktop: 0.8, mobile: 0.894118 };     // ancho / alto de la caja
const GAP_RATIO = { desktop: 0.06, mobile: 0.045 };      // hueco / ancho de caja
// Aire contra el chrome. En móvil 64vh × 0.89 desborda el ancho de un iPhone
// y la leyenda se corta arriba: la caja se clampa a esta banda.
const CHROME = {
  desktop: { top: 56, bottom: 96, side: 24, cap: 22 },
  mobile: { top: 72, bottom: 132, side: 16, cap: 22 },
};

const WHEEL_K = 1.0;      // px de recorrido por px de rueda
const SMOOTHING = 0.22;   // mismo amortiguado que la versión WebGL
const SNAP_DELAY = 140;   // ms de calma antes de encajar
const SNAP_DUR = 0.55;
// Inercia del dedo en móvil. Un flick recorre varias piezas y luego se asienta;
// sin esto cada gesto encaja en la siguiente y con ~120 hay que ir de una en una.
// Fricción por frame a 60 Hz + arrastre constante: el 0.978 anterior dejaba una
// cola de ~4 s; con esto el coast dura ~0.8 s y el snap (power3.out) cierra.
const GLIDE_F = 0.948;
const GLIDE_DRAG = 0.18;        // px/frame @60: mata el coasting lento
const GLIDE_GAIN = 30;          // px/frame por cada px/ms del dedo
const GLIDE_MAX_SLIDES = 8;
const GLIDE_STOP = 0.75;        // cede al snap antes de que el glide se agote
const MAX_ACTIVE_VIDEOS = { desktop: 4, mobile: 2 };
const NEAR_IMAGES = 6;    // piezas a cada lado que reciben `src` de imagen

const pickSrc = (sources, preferMp4 = false) => {
  if (!sources?.length) return null;
  const mp4 = sources.find((s) => s.type === "video/mp4");
  // En móvil el H.264 llega al primer frame antes que el VP9.
  if (preferMp4 && mp4) return mp4.src;
  if (typeof document === "undefined") return sources[0]?.src || null;
  const v = document.createElement("video");
  return (sources.find((s) => v.canPlayType(s.type) !== "") || sources[0])?.src || null;
};

// El póster solo se usa como miniatura: el derivado mobile sobra y pesa un tercio.
const toFieldUrl = (url) => (url || "").replace(".desktop.", ".mobile.");
const toWebp = (p) => (p || "").replace(/\.avif$/i, ".webp");

export default function ATJ_Slider({ viewRef, active = true } = {}) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  // En un ref y no en las dependencias del efecto: cambiar de vista no debe
  // reconstruir el slider, solo dormirlo.
  const activeRef = useRef(active);
  activeRef.current = active;
  const itemRefs = useRef([]);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [glideSettle, setGlideSettle] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  // Dedo o inercia en curso: syncMedia no lanza play() a mitad de gesto
  // (Safari iOS corta el swipe si un <video> arranca en ese momento).
  const interactingRef = useRef(false);

  // Proporción real de cada medio, por índice. El motor la usa para que el hueco
  // entre bordes visibles sea siempre el mismo, sea cual sea el encaje.
  const aspectRef = useRef([]);
  const relayoutRef = useRef(null);

  const { getImage, getVideo, isLoaded, imageIds, videoIds } = useOptimizedMedia();

  const pieces = useMemo(() => {
    if (!isLoaded) return [];
    return buildPieces(imageIds, videoIds)
      .map((p) => {
        if (p.type === "video") {
          const v = getVideo(p.name);
          const src = pickSrc(v?.sources, isMobile);
          if (!src) return null;
          return { ...p, src, still: toFieldUrl(v?.poster) || null };
        }
        const img = getImage(p.name);
        // Mismo derivado que carga la galaxia (webp mobile): al morphar, la
        // textura sale de la caché del navegador en vez de volver a descargarse.
        const webp = [img?.src, img?.fallback].map(toWebp).find((u) => /\.webp$/i.test(u || ""));
        const still = toFieldUrl(webp || img?.src) || img?.src || null;
        if (!still) return null;
        return { ...p, src: null, still };
      })
      .filter(Boolean);
  }, [isLoaded, imageIds, videoIds, getImage, getVideo, isMobile]);

  // El medio se encaja dentro de la caja como en `videoBaseScale`: la proporción
  // sale del fotograma fijo y se afina con los metadatos del vídeo.
  const applyFit = useCallback((i, mediaAspect) => {
    if (!mediaAspect) return;
    aspectRef.current[i] = mediaAspect;
    relayoutRef.current?.();
    const el = itemRefs.current[i]?.querySelector(".atj-slide__fit");
    if (!el) return;
    const box = SLIDE_AR[window.innerWidth <= 768 ? "mobile" : "desktop"];
    const fx = mediaAspect > box ? 1 : mediaAspect / box;
    const fy = mediaAspect > box ? box / mediaAspect : 1;
    el.style.setProperty("--fit-x", fx.toFixed(4));
    el.style.setProperty("--fit-y", fy.toFixed(4));
  }, []);

  useEffect(() => { aspectRef.current = []; }, [pieces]);

  useEffect(() => {
    if (!pieces.length) return;
    // Una medición por URL: con relleno hay nombres repetidos y no tiene sentido
    // instanciar 120 Image() para 63 ficheros.
    const byUrl = new Map();
    pieces.forEach((p, i) => {
      if (!p.still) return;
      const list = byUrl.get(p.still) || [];
      list.push(i);
      byUrl.set(p.still, list);
    });
    const imgs = [];
    for (const [url, indices] of byUrl) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const ar = img.naturalWidth / img.naturalHeight;
        indices.forEach((i) => applyFit(i, ar));
      };
      img.src = url;
      imgs.push(img);
    }
    return () => imgs.forEach((img) => { img.onload = null; img.src = ""; });
  }, [pieces, applyFit, isMobile]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Motor: posición, bucle infinito y reparto de transforms ───────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !pieces.length) return;

    const key = isMobile ? "mobile" : "desktop";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = pieces.length;

    const metrics = { w: 0, h: 0, gap: 0, unit: 0, total: 0, vw: 0, vh: 0 };
    // Ancho visible de cada medio y su centro a lo largo de la tira. La caja
    // sigue fijando el alto; el hueco se mide entre bordes reales del medio.
    const widths = new Float64Array(n);
    const centers = new Float64Array(n);
    const computeStrip = () => {
      const box = SLIDE_AR[key];
      let x = 0;
      for (let i = 0; i < n; i++) {
        const ar = aspectRef.current[i];
        const w = metrics.w * (ar && ar < box ? ar / box : 1);
        widths[i] = w;
        centers[i] = x + w / 2;
        x += w + metrics.gap;
      }
      metrics.total = x;
    };
    const measure = () => {
      metrics.vw = window.innerWidth;
      metrics.vh = window.innerHeight;
      const chrome = CHROME[key];
      const ar = SLIDE_AR[key];
      const availW = Math.max(1, metrics.vw - chrome.side * 2);
      const availH = Math.max(1, metrics.vh - chrome.top - chrome.bottom - chrome.cap);
      let h = (metrics.vh * SLIDE_VH[key]) / 100;
      let w = h * ar;
      if (w > availW) { w = availW; h = w / ar; }
      if (h > availH) { h = availH; w = h * ar; }
      metrics.h = h;
      metrics.w = w;
      metrics.gap = metrics.w * GAP_RATIO[key];
      metrics.unit = metrics.w + metrics.gap;
      computeStrip();
      const midY = chrome.top + (metrics.vh - chrome.top - chrome.bottom) / 2;
      root.style.setProperty("--slide-w", `${metrics.w}px`);
      root.style.setProperty("--slide-h", `${metrics.h}px`);
      root.style.setProperty("--slide-mid", `${midY}px`);
    };
    measure();

    const pos = { current: centers[0], target: centers[0] };
    let snapTimer = null;
    let snapTween = null;
    let dragging = false;
    let glide = 0;
    const sample = { v: 0, t: 0 };

    // Cada pieza se coloca en la ventana [-total/2, total/2) alrededor del
    // centro: con eso el carrusel es infinito sin clonar nodos.
    const wrap = (d) => {
      let x = ((d % metrics.total) + metrics.total) % metrics.total;
      if (x >= metrics.total / 2) x -= metrics.total;
      return x;
    };
    const wrapOffset = (i) => wrap(centers[i] - pos.current);
    const nearest = (p) => {
      let i = 0;
      let d = Infinity;
      for (let k = 0; k < n; k++) {
        const dk = wrap(centers[k] - p);
        if (Math.abs(dk) < Math.abs(d)) { d = dk; i = k; }
      }
      return { i, d };
    };

    const centered = { current: -1 };

    // Las proporciones llegan asíncronas: al recalcular la tira, la pieza del
    // centro se queda donde está y el resto se reacomoda alrededor.
    let dirty = false;
    const reflow = () => {
      dirty = false;
      const anchor = centered.current >= 0 ? centered.current : 0;
      const before = wrapOffset(anchor);
      computeStrip();
      const shift = wrap(centers[anchor] - pos.current) - before;
      pos.current += shift;
      pos.target += shift;
      if (snapTween?.isActive()) snapNow();
    };
    relayoutRef.current = () => { dirty = true; };

    const layout = () => {
      if (dirty) reflow();
      const left = metrics.vw / 2 - metrics.w / 2;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < n; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const x = wrapOffset(i);
        const dist = Math.abs(x);
        if (dist < bestDist) { bestDist = dist; best = i; }
        // Fuera de pantalla con margen de una pieza: se aparca, no se pinta.
        const visible = dist < metrics.vw / 2 + metrics.unit;
        el.style.transform = `translate3d(${(left + x).toFixed(2)}px,0,0)`;
        el.style.visibility = visible ? "visible" : "hidden";
      }
      if (best !== centered.current) {
        const prev = centered.current;
        centered.current = best;
        if (key === "mobile") {
          if (prev >= 0) itemRefs.current[prev]?.classList.remove("is-open");
          itemRefs.current[best]?.classList.add("is-open");
        }
        // Sin setState a mitad de swipe: un render de toda la tira + play()
        // de vídeo es el hitch que Safari enseña como glitch.
        if (!dragging && !glide) setActiveIndex(best);
      }
    };

    const snapNow = () => {
      snapTween?.kill();
      const target = pos.target + nearest(pos.target).d;
      if (reduce) { pos.target = target; pos.current = target; layout(); return; }
      snapTween = gsap.to(pos, { target, duration: SNAP_DUR, ease: "power3.out" });
    };

    const queueSnap = () => {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapNow, SNAP_DELAY);
    };

    const nudge = (dir) => {
      snapTween?.kill();
      clearTimeout(snapTimer);
      const { i, d } = nearest(pos.target);
      const j = (i + dir + n) % n;
      const step = widths[i] / 2 + metrics.gap + widths[j] / 2;
      const target = pos.target + d + dir * step;
      if (reduce) { pos.target = target; pos.current = target; layout(); return; }
      snapTween = gsap.to(pos, { target, duration: SNAP_DUR, ease: "power3.out" });
    };

    // ── Entrada ──────────────────────────────────────────────────────────────
    const onWheel = (e) => {
      e.preventDefault();
      snapTween?.kill();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      pos.target += (e.deltaMode === 1 ? delta * 16 : delta) * WHEEL_K;
      queueSnap();
    };

    const drag = { id: null, x: 0, moved: false };
    // move/up en window: setPointerCapture en iOS dispara pointercancel y
    // suelta el gesto. El id del pointer sigue bastando para filtrar.
    const bindDrag = () => {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    };
    const unbindDrag = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (dragging) return;
      snapTween?.kill();
      clearTimeout(snapTimer);
      dragging = true;
      interactingRef.current = true;
      glide = 0;
      sample.v = 0;
      sample.t = performance.now();
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.moved = false;
      root.style.cursor = "grabbing";
      bindDrag();
    };
    const onPointerMove = (e) => {
      if (!dragging || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      if (Math.abs(dx) > 1) drag.moved = true;
      const now = performance.now();
      const dt = now - sample.t;
      if (dt > 0 && dt < 80) sample.v = sample.v * 0.35 + (-dx / dt) * 0.65;
      else sample.v = dt > 0 && dt < 120 ? -dx / dt : 0;
      sample.t = now;
      pos.target -= dx;
      pos.current -= dx;   // el arrastre va pegado al dedo, sin amortiguar
    };
    const settleAfterDrag = () => {
      interactingRef.current = false;
      queueSnap();
      setActiveIndex(centered.current);
    };
    const endDrag = (e, cancelled) => {
      if (!dragging || e.pointerId !== drag.id) return;
      dragging = false;
      unbindDrag();
      root.style.cursor = "grab";
      if (pendingResize) applyResize();
      // Safari robó el gesto (barra, rubber-band, captura): asentar, no lanzar.
      if (cancelled) { settleAfterDrag(); return; }
      if (key === "mobile" && !reduce && drag.moved) {
        const age = performance.now() - sample.t;
        const v = age < 100 ? sample.v : 0;
        let g = v * GLIDE_GAIN;
        const maxDist = metrics.unit * GLIDE_MAX_SLIDES;
        const est = Math.abs(g) / (1 - GLIDE_F);
        if (est > maxDist && est > 0) g *= maxDist / est;
        glide = Math.abs(g) < GLIDE_STOP ? 0 : g;
        if (!glide) settleAfterDrag();
        return;
      }
      settleAfterDrag();
    };
    const onPointerUp = (e) => endDrag(e, false);
    const onPointerCancel = (e) => endDrag(e, true);
    const onTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
    };

    const onKeyDown = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-1); }
    };

    let pendingResize = false;
    const applyResize = () => {
      pendingResize = false;
      const before = metrics.w;
      const prevVw = metrics.vw;
      measure();
      if (before > 0 && metrics.vw !== prevVw) {
        const k = metrics.w / before;
        pos.current *= k;
        pos.target *= k;
      }
      layout();
    };
    const onResize = () => {
      // iOS: esconder la barra cambia innerHeight y, si reescalamos, la tira
      // salta. El ancho solo cambia de verdad (giro, split view).
      if (window.innerWidth === metrics.vw) return;
      if (dragging) { pendingResize = true; return; }
      applyResize();
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    let raf = 0;
    let lastTick = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const steps = Math.min(2, (now - lastTick) / (1000 / 60));
      lastTick = now;
      if (document.hidden || !activeRef.current) return;
      if (glide) {
        // Normalizado a 60 Hz: en ProMotion el glide no viaja el doble ni se
        // apaga en la mitad de tiempo. El drag corta la cola sin un corte seco.
        pos.current += glide * steps;
        pos.target = pos.current;
        glide *= Math.pow(GLIDE_F, steps);
        glide -= Math.sign(glide) * GLIDE_DRAG * steps;
        if (Math.abs(glide) < GLIDE_STOP) {
          glide = 0;
          interactingRef.current = false;
          snapNow();
          setActiveIndex(centered.current);
          setGlideSettle((n) => n + 1);
        }
      } else if (!dragging) {
        pos.current += (pos.target - pos.current) * (reduce ? 1 : SMOOTHING);
      }
      layout();
    };
    raf = requestAnimationFrame(tick);
    root.style.cursor = "grab";
    layout();

    // ── API para el morph: dónde está cada pieza en pantalla ─────────────────
    if (viewRef) {
      viewRef.current = {
        view: "slider",
        // Rectángulos en coordenadas de viewport, por nombre de pieza. Es lo
        // que la galaxia necesita para continuar el movimiento sin salto.
        // Clave: el índice en la lista canónica. Con relleno hay nombres
        // repetidos, así que el nombre no identifica una pieza; la posición sí.
        getRects() {
          const out = new Map();
          for (let i = 0; i < n; i++) {
            const el = itemRefs.current[i];
            if (!el || el.style.visibility === "hidden") continue;
            const r = (el.querySelector(".atj-slide__fit") || el).getBoundingClientRect();
            // Clave: el índice canónico de la lista, no la posición en este
            // array. Las dos vistas descartan piezas que no resuelven, y si
            // cada una numera lo suyo el morph empareja fotos distintas.
            out.set(pieces[i].index, { x: r.left, y: r.top, w: r.width, h: r.height, name: pieces[i].name });
          }
          return out;
        },
        // Misma geometría que getRects más el fotograma: el morph DOM↔DOM
        // clona estas imágenes a una capa de vuelo y las oculta aquí.
        getFlyers() {
          const out = new Map();
          for (let i = 0; i < n; i++) {
            const el = itemRefs.current[i];
            if (!el || el.style.visibility === "hidden") continue;
            const fit = el.querySelector(".atj-slide__fit") || el;
            const r = fit.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            const video = fit.querySelector("video");
            const img = fit.querySelector("img");
            const p = pieces[i];
            const isVideo = p.type === "video";
            const videoSrc = isVideo
              ? (video?.currentSrc || video?.getAttribute?.("src") || p.src)
              : null;
            const poster = video?.getAttribute?.("poster") || p.still || img?.currentSrc || img?.src || null;
            const src = isVideo ? videoSrc : (img?.currentSrc || img?.src || p.still);
            if (!src && !poster) continue;
            out.set(p.index, {
              x: r.left, y: r.top, w: r.width, h: r.height,
              name: p.name,
              kind: isVideo && videoSrc ? "video" : "image",
              src: src || poster,
              poster,
              currentTime: video?.currentTime || 0,
              el: isVideo ? video : img,
              visible: true,
            });
          }
          return out;
        },
        setGhost(on) {
          root.classList.toggle("is-ghost", !!on);
        },
        getActive: () => {
          const p = pieces[centered.current];
          return p ? { index: p.index, name: p.name, gallery: p.gallery } : null;
        },
        goTo(target, { duration = 0.9 } = {}) {
          const i = typeof target === "number"
            ? pieces.findIndex((p) => p.index === target)
            : pieces.findIndex((p) => p.name === target);
          if (i < 0 || i >= n) return;
          snapTween?.kill();
          if (dirty) reflow();
          const delta = wrap(centers[i] - pos.target);
          // Instantáneo: el morph de entrada necesita la tira ya colocada
          // aunque el RAF esté dormido (capa inactiva).
          if (!duration) {
            pos.target += delta;
            pos.current = pos.target;
            layout();
            return;
          }
          gsap.to(pos, { target: pos.target + delta, duration, ease: "power3.inOut" });
        },
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(snapTimer);
      snapTween?.kill();
      gsap.killTweensOf(pos);
      interactingRef.current = false;
      unbindDrag();
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      if (viewRef) viewRef.current = null;
      relayoutRef.current = null;
    };
  }, [pieces, isMobile, viewRef]);

  // ── Medios: solo carga y reproduce lo que está cerca del centro ───────────
  // La misma función la llaman el cambio de pieza activa y el de visibilidad: si
  // no, al volver de una pestaña en segundo plano los vídeos se quedan parados
  // (Chrome difiere el autoplay mientras el documento está oculto).
  const syncMedia = useCallback(() => {
    if (!pieces.length) return;
    const n = pieces.length;
    const near = (i, radius) => {
      const d = Math.abs(((i - activeIndex + n + n / 2) % n) - n / 2);
      return d <= radius;
    };
    const videoCap = MAX_ACTIVE_VIDEOS[isMobile ? "mobile" : "desktop"];
    const playRadius = Math.max(1, Math.floor(videoCap / 2));
    // En móvil el vecino ya está en marcha, y el siguiente ya tiene buffer,
    // antes de que el gesto lo traiga al centro.
    const prepRadius = isMobile ? playRadius + 1 : playRadius;

    itemRefs.current.forEach((el, i) => {
      const piece = pieces[i];
      if (!el || !piece) return;

      if (piece.type === "image") {
        const img = el.querySelector("img");
        if (!img) return;
        // Las imágenes lejanas ni se piden: con 63 piezas, cargarlas todas sería
        // más pesado que la galaxia entera.
        if (near(i, NEAR_IMAGES) && !img.getAttribute("src")) img.setAttribute("src", piece.still);
        return;
      }

      const video = el.querySelector("video");
      if (!video) return;
      video.muted = true;   // la propiedad, no el atributo: es la que mira el autoplay
      if (!near(i, prepRadius)) {
        if (!video.paused) video.pause();
        return;
      }
      if (!video.getAttribute("src")) {
        video.preload = "auto";
        video.setAttribute("src", piece.src);
        video.addEventListener("loadedmetadata", () => {
          if (video.videoWidth && video.videoHeight) applyFit(i, video.videoWidth / video.videoHeight);
        }, { once: true });
      }
      const shouldPlay = near(i, playRadius) && !document.hidden && active && !interactingRef.current;
      if (shouldPlay) video.play().catch(() => {});
      else if (!video.paused) video.pause();
    });
  }, [pieces, isMobile, activeIndex, applyFit, active, glideSettle]);

  useEffect(() => { syncMedia(); }, [syncMedia]);

  // La marca del pie hace scramble hasta que la pieza del centro puede pintarse.
  const contentReadyRef = useRef(false);
  useEffect(() => {
    if (contentReadyRef.current || !pieces.length) return undefined;
    const piece = pieces[activeIndex];
    const el = itemRefs.current[activeIndex];
    if (!piece || !el) return undefined;
    let drop = false;
    const done = () => {
      if (drop || contentReadyRef.current) return;
      contentReadyRef.current = true;
      window.dispatchEvent(new Event("atj:content-ready"));
    };
    if (piece.type === "image") {
      const img = el.querySelector("img");
      if (!img) return undefined;
      if (img.complete && img.naturalWidth) done();
      else img.addEventListener("load", done, { once: true });
      return () => { drop = true; img.removeEventListener("load", done); };
    }
    const video = el.querySelector("video");
    const poster = video?.poster || piece.still;
    if (!poster) { done(); return undefined; }
    const img = new Image();
    img.onload = done;
    img.onerror = done;
    img.src = poster;
    return () => { drop = true; img.onload = null; img.onerror = null; };
  }, [pieces, activeIndex]);

  useEffect(() => {
    document.addEventListener("visibilitychange", syncMedia);
    return () => document.removeEventListener("visibilitychange", syncMedia);
  }, [syncMedia]);

  const setItemRef = useCallback((el, i) => { itemRefs.current[i] = el; }, []);
  const total = String(pieces.length).padStart(2, "0");

  return (
    <div className="atj-slider" ref={rootRef} role="group" aria-label="Portfolio" tabIndex={-1}>
      <div className="atj-slider__track" ref={trackRef}>
        {pieces.map((p, i) => (
          <figure
            key={p.index}
            className={`atj-slide${hoverIndex === i || (isMobile && activeIndex === i) ? " is-open" : ""}`}
            ref={(el) => setItemRef(el, i)}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((v) => (v === i ? null : v))}
          >
            <div className="atj-slide__fit">
              <figcaption className="atj-slide__caption">
                <span className="atj-slide__label">
                  {p.galleryLabel}
                  <span className="atj-slide__sep">·</span>
                  <span className="atj-slide__title">{p.label}</span>
                </span>
                <span className="atj-slide__counter">
                  {String(i + 1).padStart(2, "0")} / {total}
                </span>
              </figcaption>
              {p.type === "video" ? (
                <video
                  className="atj-slide__media"
                  poster={p.still || undefined}
                  muted
                  loop
                  playsInline
                  preload="none"
                  tabIndex={-1}
                />
              ) : (
                // Derivados ya optimizados del manifiesto y carga controlada por
                // cercanía: next/image pelearía con el posicionado absoluto.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="atj-slide__media" alt="" decoding="async" draggable="false" />
              )}
            </div>
          </figure>
        ))}
      </div>

      <style>{`
        .atj-slider {
          position: fixed;
          inset: 0;
          background: var(--atj-bg);
          overflow: hidden;
          touch-action: none;
          overscroll-behavior: none;
          -webkit-user-select: none;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }
        .atj-slider__track {
          position: absolute;
          top: var(--slide-mid, 50%);
          left: 0;
          width: 100%;
          height: 0;
        }
        .atj-slide {
          position: absolute;
          top: 0;
          left: 0;
          width: var(--slide-w, 0px);
          height: var(--slide-h, 0px);
          margin: calc(var(--slide-h, 0px) / -2) 0 0 0;
          will-change: transform;
          backface-visibility: hidden;
        }
        .atj-slide__fit {
          position: absolute;
          left: 50%;
          top: 50%;
          width: calc(var(--fit-x, 1) * 100%);
          height: calc(var(--fit-y, 1) * 100%);
          transform: translate(-50%, -50%);
        }
        .atj-slide__media {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          pointer-events: none;
          user-select: none;
        }
        .atj-slide__caption {
          position: absolute;
          left: 0;
          right: 0;
          bottom: calc(100% + 6px);
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1em;
          font: 800 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -0.045em;
          color: var(--atj-fg);
          white-space: nowrap;
          opacity: 0;
          transition: opacity 180ms ease;
          pointer-events: none;
        }
        .atj-slide.is-open .atj-slide__caption { opacity: 1; }
        .atj-slide__counter { font-variant-numeric: tabular-nums; }
        .atj-slide__sep { opacity: 0.35; margin: 0 0.5em; }
        .atj-slide__title { font-weight: 400; }

        /* El morph vuela clones: las piezas de aquí se ocultan el tiempo que
           duran en el aire para no pintarlas dos veces. */
        .atj-slider.is-ghost .atj-slide { visibility: hidden !important; }

        @media (prefers-reduced-motion: reduce) {
          .atj-slide__caption { transition: none; }
        }
      `}</style>
    </div>
  );
}
