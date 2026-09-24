"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { buildPieces } from "@/data/pieces";
import { setDensityLadder, useViewPrefs } from "@/components/final-components/viewPrefs";

// ─── Rejilla editorial ─────────────────────────────────────────────────────────
// Sin WebGL: una rejilla CSS de ancho de columna fijo y alto natural. Cada pieza
// se ve en su proporción real, y eso es además lo que hace exacto el morph
// con el slider: allí el medio también se dibuja en su proporción dentro
// de la caja, así que el rectángulo que publica una vista es el mismo que espera
// la otra. Un vuelo de dos fases, sin deformación.
//
// El contenido y su orden salen de `@/data/pieces`: las galerías van seguidas y
// dentro de cada una se baraja con semilla fija, así que la rejilla se lee como
// un archivo por proyectos y el slider recorre lo mismo en el mismo orden.
//
// La página no se recorta contra el chrome: la rejilla ocupa el viewport entero
// y arranca con un margen que la despega del navbar, pero al hacer scroll las
// piezas pasan POR DETRÁS de las pills y del lockup, que están en z-index 9999.
//
// Los vídeos están en movimiento, no en póster: corren los que se ven —el resto
// ni siquiera tiene `src`, así que no hay decodificador abierto— y desde una
// copia de 480 px, que es lo que hace barato tener varios a la vez.

/** Columnas por nivel de densidad. En un móvil 12·8·6·3 no significa nada. */
const LADDER = {
  desktop: [12, 8, 6, 3],
  tablet: [8, 6, 4, 2],
  mobile: [4, 3, 2],
};

const GUTTER = { desktop: 18, tablet: 16, mobile: 12 };
const GAP = { desktop: 10, tablet: 8, mobile: 6 };

// Aire bajo las pills al entrar (16 + 21 de reloj + 4 + 21 de densidad = 62; en
// táctil 16 + 25 + 6 + 25 = 72) y sobre el lockup (44 + 44 + 8 de línea base,
// más el desbordamiento del h1).
const TOP_INSET = { desktop: 88, tablet: 90, mobile: 90 };
const BOTTOM_INSET = { desktop: 132, tablet: 124, mobile: 108 };

const FLIP_DUR = 0.72;
const FLIP_EASE = "power3.inOut";
const FALLBACK_AR = 0.8;

// Vídeos corriendo a la vez, como mucho. Los elige la cercanía al centro de la
// pantalla; el resto se pausa aunque esté visible. En móvil el límite lo pone
// el sistema tanto como la GPU.
const MAX_PLAYING = { desktop: 12, tablet: 8, mobile: 4 };
// Margen del observador: un vídeo se prepara antes de entrar y suelta el
// decodificador solo cuando se ha ido de verdad.
const VIDEO_BAND = 300;
// Por encima de este ancho en píxeles de pantalla la copia de 480 se queda
// corta y se sube al derivado de 1080.
const VIDEO_THUMB_MAX_PX = 560;

/** Marcadores de galería (ADEC · 001). Una constante: la rejilla lisa es la que
 *  se aprobó, pero el archivo por tramos está a un `true` de distancia. */
const SHOW_GALLERY_MARKS = false;

// ── Vista de detalle ──────────────────────────────────────────────────────────
// Solo en los dos escalones densos: en 6 y 3 columnas la pieza ya se ve.
const DETAIL_LEVELS = [0, 1];
// Lado largo de la pieza ampliada. No se ata a la rejilla: atarla a un número de
// columnas obligaba a una caja de ancho fijo, y una vertical dejaba dentro dos
// franjas de blanco a los lados. Aquí la caja es la pieza — el blanco es el
// mismo por los cuatro costados — y el tamaño no depende de la densidad.
const DETAIL_MAX = 400;
/** Cuánto puede crecer la pieza sobre DETAIL_MAX al reajustarse al hueco. */
const DETAIL_GROW = 1.25;
const DETAIL_PAD = 12;      // blanco alrededor, igual en los cuatro lados
const DETAIL_MARGIN = 16;   // aire mínimo contra el navbar y el lockup
const DETAIL_CAP_H = 22;    // línea de pie

const breakpointOf = (w) => (w <= 768 ? "mobile" : w <= 1180 ? "tablet" : "desktop");

const pickSrc = (sources) => {
  if (!sources?.length) return null;
  if (typeof document === "undefined") return sources[0]?.src || null;
  const v = document.createElement("video");
  return (sources.find((s) => v.canPlayType(s.type) !== "") || sources[0])?.src || null;
};

const toFieldUrl = (url) => (url || "").replace(".desktop.", ".mobile.");

export default function ATJ_Grid({ viewRef, active = true, onSelect } = {}) {
  const rootRef = useRef(null);
  const innerRef = useRef(null);
  const itemRefs = useRef([]);
  const mediaRefs = useRef([]);
  const videoRefs = useRef([]);
  const [detail, setDetail] = useState(null);

  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1512 : window.innerWidth));
  const { level } = useViewPrefs();

  const activeRef = useRef(active);
  activeRef.current = active;

  const bp = breakpointOf(vw);
  const ladder = LADDER[bp];
  const cols = ladder[Math.min(level, ladder.length - 1)];
  const gutter = GUTTER[bp];
  const gap = GAP[bp];

  // La rejilla es quien conoce sus puntos de ruptura, así que es quien publica
  // la escalera que pintan las pills del navbar.
  useEffect(() => { setDensityLadder(ladder); }, [ladder]);

  const { getImageSet, getVideo, isLoaded, imageIds, videoIds } = useOptimizedMedia();

  // Ancho real de celda: es el `sizes` que necesita el navegador para elegir
  // derivado. Tiene que ser correcto ya en el primer render — sin él asume
  // 100vw y se trae el fichero de 1920 para una celda de 174.
  const cellPx = Math.max(1, Math.round((vw - gutter * 2 - gap * (cols - 1)) / cols));
  const sizes = `${cellPx}px`;
  const cellDevicePx = cellPx * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

  const pieces = useMemo(() => {
    if (!isLoaded) return [];
    return buildPieces(imageIds, videoIds)
      .map((p) => {
        if (p.type === "video") {
          const v = getVideo(p.name);
          const poster = v?.posterThumb || v?.poster;
          if (!poster) return null;
          return {
            ...p,
            src: poster,
            // El póster grande solo se pide si la celda crece lo bastante.
            srcSet: v.posterThumb && v.poster
              ? `${v.posterThumb} 384w, ${v.poster} ${v.width || 864}w`
              : null,
            videoThumb: v.thumbSrc || null,
            videoFull: toFieldUrl(pickSrc(v.sources)),
            w: v.width,
            h: v.height,
          };
        }
        const set = getImageSet(p.name);
        if (!set?.src) return null;
        return { ...p, src: set.src, srcSet: set.srcSet, w: set.width, h: set.height, heic: set.heic };
      })
      .filter(Boolean);
  }, [isLoaded, imageIds, videoIds, getImageSet, getVideo]);

  // Qué copia del vídeo toca para el tamaño de celda actual. Cambia solo al
  // cambiar de densidad, así que no hay recarga por scroll.
  const videoSrcFor = useCallback(
    (p) => {
      if (!p.videoThumb) return p.videoFull;
      return cellDevicePx > VIDEO_THUMB_MAX_PX ? p.videoFull || p.videoThumb : p.videoThumb;
    },
    [cellDevicePx],
  );

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVw(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  // ── Vídeos: los que se ven, en movimiento ─────────────────────────────────
  const visibleRef = useRef(new Set());
  const syncRaf = useRef(0);
  const detailIRef = useRef(null);
  detailIRef.current = detail?.i ?? null;

  const syncVideos = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cap = MAX_PLAYING[breakpointOf(window.innerWidth)];
    const mid = window.innerHeight / 2;

    // Prioridad por cercanía al centro: si hay más vídeos a la vista que cupo,
    // se mueven los del medio, que son los que se están mirando.
    const want = new Set();
    if (activeRef.current && !document.hidden && !reduce) {
      [...visibleRef.current]
        .map((i) => {
          const r = mediaRefs.current[i]?.getBoundingClientRect();
          return { i, d: r ? Math.abs(r.top + r.height / 2 - mid) : Infinity };
        })
        .sort((a, b) => a.d - b.d)
        .slice(0, cap)
        .forEach(({ i }) => want.add(i));
    }

    pieces.forEach((p, i) => {
      const v = videoRefs.current[i];
      if (!v || !(p.videoThumb || p.videoFull)) return;
      // La pieza abierta en detalle se reproduce en la caja, no en su celda.
      if (want.has(i) && i !== detailIRef.current) {
        const src = videoSrcFor(p);
        if (src && v.getAttribute("src") !== src) { v.setAttribute("src", src); v.load(); }
        if (v.paused) v.play().catch(() => {});
        return;
      }
      if (!v.paused) v.pause();
      // Fuera de la banda del observador se suelta el decodificador; dentro se
      // conserva, para que un scroll corto no recargue nada.
      if (!visibleRef.current.has(i) && v.getAttribute("src")) {
        v.removeAttribute("src");
        v.load();
        v.style.opacity = "0";
      }
    });
  }, [pieces, videoSrcFor]);

  const scheduleSync = useCallback(() => {
    cancelAnimationFrame(syncRaf.current);
    syncRaf.current = requestAnimationFrame(syncVideos);
  }, [syncVideos]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !pieces.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number(e.target.dataset.i);
          if (e.isIntersecting) visibleRef.current.add(i);
          else visibleRef.current.delete(i);
        }
        scheduleSync();
      },
      { root, rootMargin: `${VIDEO_BAND}px 0px`, threshold: 0 },
    );
    pieces.forEach((p, i) => {
      if (!(p.videoThumb || p.videoFull)) return;
      const el = mediaRefs.current[i];
      if (el) io.observe(el);
    });
    return () => { io.disconnect(); cancelAnimationFrame(syncRaf.current); };
  }, [pieces, scheduleSync]);

  // El observador solo avisa al cruzar el borde: un scroll dentro de la banda
  // no dispara nada y el reparto por cercanía se quedaría viejo.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    root.addEventListener("scroll", scheduleSync, { passive: true });
    document.addEventListener("visibilitychange", scheduleSync);
    return () => {
      root.removeEventListener("scroll", scheduleSync);
      document.removeEventListener("visibilitychange", scheduleSync);
    };
  }, [scheduleSync]);

  // Al salir de la vista se para todo: el escenario deja la capa montada.
  useEffect(() => { scheduleSync(); }, [active, cols, detail, scheduleSync]);

  // ── Vista de detalle ──────────────────────────────────────────────────────
  // La pieza se amplía centrada sobre su propia celda y tapa la rejilla, que no
  // se mueve. Sin viaje ni escala: aparece con un fundido corto, como en el
  // archivo de referencia. La geometría va en coordenadas del contenido, así
  // que la caja queda pegada a su pieza si se hace scroll.
  const openDetail = useCallback(
    (i) => {
      if (!DETAIL_LEVELS.includes(level)) return;
      const p = pieces[i];
      const fig = itemRefs.current[i];
      const inner = innerRef.current;
      const scroller = rootRef.current;
      if (!p || !fig || !inner || !scroller) return;

      // Solo el HEIC: el manifiesto puede traer el sensor sin girar. El resto
      // usa la proporción del archivo, que es la de la celda.
      const still = p.heic ? fig.querySelector(".atj-grid__media img") : null;
      const ar = still?.naturalWidth && still?.naturalHeight
        ? still.naturalWidth / still.naturalHeight
        : (p.w && p.h ? p.w / p.h : FALLBACK_AR);
      // 2. Las líneas reales de la rejilla. Las columnas son regulares, las
      //    filas no —cada una mide lo que su pieza más alta—, y por eso hay que
      //    leerlas en vez de calcularlas.
      const cs = getComputedStyle(inner);
      const toLines = (value, start) => {
        const out = [start];
        value.split(" ").map(parseFloat).filter((n) => !Number.isNaN(n))
          .forEach((t) => out.push(out[out.length - 1] + t + gap));
        return out;
      };
      const colLines = toLines(cs.gridTemplateColumns, parseFloat(cs.paddingLeft) || gutter);
      const rowLines = toLines(cs.gridTemplateRows, parseFloat(cs.paddingTop) || TOP_INSET[bp]);
      const trackOf = (ls, v) => {
        let k = 0;
        for (let j = 0; j < ls.length - 1; j++) if (ls[j] <= v + 0.5) k = j;
        return k;
      };

      // 3. Se prueban los rectángulos de celdas enteras que contienen la pieza
      //    pulsada y se elige el que menos blanco desaprovecha con la pieza ya
      //    encajada dentro. No se optimiza el tamaño de la caja sino el ajuste,
      //    que es lo que se ve: una caja grande con una pieza pequeña dentro
      //    son dos franjas de blanco a los lados.
      const candidates = (ls, idx, limits) => {
        const out = [];
        for (let a = Math.max(0, idx - 4); a <= idx; a++) {
          for (let b = idx + 1; b < Math.min(ls.length, idx + 6); b++) {
            const start = ls[a];
            const size = ls[b] - gap - start;
            if (size <= 0) continue;
            const pen = limits
              ? (Math.max(0, limits[0] - start) + Math.max(0, start + size - limits[1])) / 100
              : 0;
            out.push({ start, size, pen });
          }
        }
        return out;
      };

      const band = [
        scroller.scrollTop + TOP_INSET[bp],
        scroller.scrollTop + window.innerHeight - BOTTOM_INSET[bp],
      ];
      // La banda solo manda si la pieza está a la vista, que es el caso real de
      // un click. Para una pieza fuera de pantalla todos los candidatos se
      // salen y el que menos penaliza es el más pequeño: la caja salía encogida.
      const verse = fig.offsetTop + fig.offsetHeight > band[0] && fig.offsetTop < band[1];
      const cols_ = candidates(colLines, trackOf(colLines, fig.offsetLeft), null);
      const rows_ = candidates(rowLines, trackOf(rowLines, fig.offsetTop), verse ? band : null);

      const techo = DETAIL_MAX * DETAIL_GROW;
      let best = null;
      let bestScore = Infinity;
      for (const c of cols_) {
        const iw = c.size - DETAIL_PAD * 2;
        if (iw < 60) continue;
        for (const r of rows_) {
          const ih = r.size - DETAIL_PAD * 2 - DETAIL_CAP_H;
          if (ih < 60) continue;
          let fw = Math.min(iw, techo);
          let fh = fw / ar;
          if (fh > ih) { fh = Math.min(ih, techo); fw = fh * ar; }
          const desperdicio = 1 - (fw * fh) / (iw * ih);
          const errTamano = Math.abs(Math.max(fw, fh) - DETAIL_MAX) / DETAIL_MAX;
          const score = desperdicio + errTamano * 0.8 + c.pen + r.pen;
          if (score < bestScore) {
            bestScore = score;
            best = { left: c.start, top: r.start, boxW: c.size, boxH: r.size, w: fw, h: fh };
          }
        }
      }
      if (!best) return;

      const { left, top, boxW, boxH, w, h } = best;
      setDetail({ i, index: p.index, left, top, w, h, boxW, boxH });
    },
    [level, pieces, gutter, gap, bp],
  );

  const closeDetail = useCallback(() => { setDetail(null); }, []);

  // Esc cierra. Cambiar de densidad o salir de la vista también: la geometría se
  // calculó para la rejilla que había.
  useEffect(() => {
    if (!detail) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  useEffect(() => { setDetail(null); }, [cols, active]);

  // ── Cambio de densidad: FLIP + ancla de scroll ────────────────────────────
  // Sin ancla, pasar de 12 a 3 columnas multiplica por dieciséis la altura del
  // documento y el scroll se queda apuntando a otra parte del archivo.
  const flipRef = useRef(null);

  const captureFlip = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const top = TOP_INSET[breakpointOf(window.innerWidth)];
    const before = new Map();
    let anchor = -1;
    let anchorTop = 0;
    let bestDist = Infinity;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      before.set(i, r);
      const dist = Math.abs(r.top - top);
      if (r.bottom > top && dist < bestDist) { bestDist = dist; anchor = i; anchorTop = r.top; }
    });
    flipRef.current = { before, anchor, anchorTop };
  }, []);

  useLayoutEffect(() => {
    const flip = flipRef.current;
    flipRef.current = null;
    const root = rootRef.current;
    if (!flip || !root) return;

    // 1. Borrar lo que quedara de un cambio anterior. El rectángulo "antes" se
    //    midió con el transform puesto —es lo que ve el ojo, y encadenar desde
    //    ahí es lo correcto— pero el "después" tiene que ser la posición de
    //    maquetación limpia o el delta sale al doble.
    const els = itemRefs.current.filter(Boolean);
    gsap.killTweensOf(els);
    gsap.set(els, { clearProps: "transform" });

    // 2. El scroll: el FLIP tiene que medirse contra la posición final.
    if (flip.anchor >= 0) {
      const el = itemRefs.current[flip.anchor];
      if (el) root.scrollTop += el.getBoundingClientRect().top - flip.anchorTop;
    }

    // 3. Cada pieza viaja de donde estaba a donde está. Las dos rejillas
    //    respetan la proporción, así que la escala es uniforme y la imagen no
    //    se deforma por el camino.
    const h = window.innerHeight;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    itemRefs.current.forEach((el, i) => {
      const b = flip.before.get(i);
      if (!el || !b) return;
      const a = el.getBoundingClientRect();
      const onScreen = (r) => r.bottom > -200 && r.top < h + 200;
      if (!onScreen(a) && !onScreen(b)) return;
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      const s = a.width > 0 ? b.width / a.width : 1;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.005) return;
      gsap.fromTo(
        el,
        { x: dx, y: dy, scale: s, transformOrigin: "0 0" },
        {
          x: 0, y: 0, scale: 1,
          duration: FLIP_DUR,
          ease: FLIP_EASE,
          overwrite: "auto",
          // Al terminar no queda matriz: 120 celdas con transform propio son
          // 120 capas de composición vivas para siempre.
          onComplete: () => gsap.set(el, { clearProps: "transform" }),
        },
      );
    });
  }, [cols]);

  // El nivel lo cambia el navbar, que no puede medir la rejilla: se captura
  // aquí, justo antes de que el store propague el cambio.
  useEffect(() => {
    if (!active) return undefined;
    const onWillChange = () => captureFlip();
    window.addEventListener("atj:density-will-change", onWillChange);
    return () => window.removeEventListener("atj:density-will-change", onWillChange);
  }, [active, captureFlip]);

  // ── API para el escenario: dónde está cada pieza ──────────────────────────
  useEffect(() => {
    if (!viewRef) return undefined;
    viewRef.current = {
      view: "grid",
      // Rectángulos en coordenadas de viewport por índice canónico, igual que
      // el slider, y del medio —no de la celda— porque el pie no viaja.
      // `visible` distingue lo que está en pantalla de lo que queda fuera del
      // scroll, que también tiene rectángulo pero no se ve.
      getRects() {
        const out = new Map();
        const h = window.innerHeight;
        pieces.forEach((p, i) => {
          const el = mediaRefs.current[i];
          if (!el) return;
          const r = el.getBoundingClientRect();
          out.set(p.index, {
            x: r.left, y: r.top, w: r.width, h: r.height,
            name: p.name,
            visible: r.bottom > 0 && r.top < h,
          });
        });
        return out;
      },
      getFlyers() {
        const out = new Map();
        const h = window.innerHeight;
        pieces.forEach((p, i) => {
          const el = mediaRefs.current[i];
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          const video = el.querySelector("video");
          const img = el.querySelector("img");
          const isVideo = Boolean(p.videoThumb || p.videoFull);
          const videoSrc = isVideo
            ? (video?.currentSrc || video?.getAttribute?.("src") || videoSrcFor(p))
            : null;
          const poster = img?.currentSrc || img?.src || p.src || null;
          const src = isVideo ? videoSrc : poster;
          if (!src && !poster) return;
          out.set(p.index, {
            x: r.left, y: r.top, w: r.width, h: r.height,
            name: p.name,
            kind: isVideo && videoSrc ? "video" : "image",
            src: src || poster,
            poster,
            currentTime: video?.currentTime || 0,
            el: isVideo ? video : img,
            visible: r.bottom > 0 && r.top < h,
          });
        });
        return out;
      },
      setGhost(on) {
        rootRef.current?.classList.toggle("is-ghost", !!on);
      },
      getActive() {
        const mid = window.innerHeight / 2;
        let best = null;
        let bestDist = Infinity;
        pieces.forEach((p, i) => {
          const el = mediaRefs.current[i];
          if (!el) return;
          const r = el.getBoundingClientRect();
          const d = Math.abs(r.top + r.height / 2 - mid);
          if (d < bestDist) { bestDist = d; best = p; }
        });
        return best ? { index: best.index, name: best.name, gallery: best.gallery } : null;
      },
      goTo(target, { behavior = "smooth" } = {}) {
        const root = rootRef.current;
        if (!root) return;
        const i = typeof target === "number"
          ? pieces.findIndex((p) => p.index === target)
          : pieces.findIndex((p) => p.name === target);
        const el = itemRefs.current[i];
        if (!el) return;
        const bpNow = breakpointOf(window.innerWidth);
        const band = window.innerHeight - TOP_INSET[bpNow] - BOTTOM_INSET[bpNow];
        const r = el.getBoundingClientRect();
        const delta = r.top - TOP_INSET[bpNow] - Math.max(0, (band - r.height) / 2);
        root.scrollTo({ top: root.scrollTop + delta, behavior });
      },
    };
    return () => { viewRef.current = null; };
  }, [pieces, viewRef, videoSrcFor]);

  const setItemRef = useCallback((el, i) => { itemRefs.current[i] = el; }, []);
  const setMediaRef = useCallback((el, i) => { mediaRefs.current[i] = el; }, []);
  const setVideoRef = useCallback((el, i) => { videoRefs.current[i] = el; }, []);

  let lastGallery = null;

  return (
    // data-lenis-prevent: el Lenis global escucha la rueda en window y hace
    // preventDefault; sin esto el scroll nativo de este contenedor no existe.
    <div className="atj-grid" ref={rootRef} data-lenis-prevent>
      <div
        className="atj-grid__inner"
        ref={innerRef}
        style={{
          "--cols": cols,
          "--gap": `${gap}px`,
          "--gutter": `${gutter}px`,
          "--top": `${TOP_INSET[bp]}px`,
          "--bottom": `${BOTTOM_INSET[bp]}px`,
          "--cap": cols >= 10 ? "10px" : "11px",
          "--detail-pad": `${DETAIL_PAD}px`,
          "--cell-cursor": DETAIL_LEVELS.includes(level) ? "pointer" : "default",
        }}
      >
        {pieces.map((p, i) => {
          const mark = SHOW_GALLERY_MARKS && p.galleryLabel !== lastGallery ? p.galleryLabel : null;
          if (mark) lastGallery = p.galleryLabel;
          const ar = p.w && p.h ? p.w / p.h : FALLBACK_AR;
          const isVideo = Boolean(p.videoThumb || p.videoFull);
          return (
            <Fragment key={p.index}>
              {mark && (
                <div className="atj-grid__mark" aria-hidden="true">
                  <span>{mark.toUpperCase()}</span>
                  <span>{String(i + 1).padStart(3, "0")}</span>
                </div>
              )}
              <figure
                className="atj-grid__cell"
                ref={(el) => setItemRef(el, i)}
                onClick={() => { onSelect?.(p); openDetail(i); }}
              >
                <div
                  className="atj-grid__media"
                  ref={(el) => setMediaRef(el, i)}
                  data-i={i}
                  style={{ aspectRatio: String(ar) }}
                >
                  {/* Derivados del manifiesto y `sizes` exacto: next/image no
                      aporta nada aquí y pelearía con el ratio natural. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="atj-grid__img"
                    src={p.src}
                    srcSet={p.srcSet || undefined}
                    sizes={sizes}
                    alt={p.label}
                    loading="lazy"
                    decoding="async"
                    onLoad={p.heic ? (e) => {
                      const img = e.currentTarget;
                      const box = img.parentElement;
                      if (!box || !img.naturalWidth || !img.naturalHeight) return;
                      box.style.aspectRatio = String(img.naturalWidth / img.naturalHeight);
                    } : undefined}
                  />
                  {isVideo && (
                    // Sin `src` hasta que entra en pantalla: un <video> vacío no
                    // abre decodificador. El póster de debajo tapa el hueco y el
                    // vídeo se revela al empezar a correr.
                    <video
                      className="atj-grid__video"
                      ref={(el) => setVideoRef(el, i)}
                      muted
                      loop
                      playsInline
                      preload="none"
                      tabIndex={-1}
                      onPlaying={(e) => { e.currentTarget.style.opacity = "1"; }}
                    />
                  )}
                </div>
                {/* El nombre del fichero, sin maquillar: es el pie de un archivo,
                    no un título de obra. */}
                <figcaption className="atj-grid__cap">{p.name}</figcaption>
              </figure>
            </Fragment>
          );
        })}

        {detail && pieces[detail.i] && (() => {
          const p = pieces[detail.i];
          const esVideo = Boolean(p.videoFull || p.videoThumb);
          return (
            <Fragment>
              {/* Capa de cierre: un click en cualquier parte devuelve la pieza a
                  su hueco. No tiñe ni difumina la rejilla —la caja blanca ya
                  separa de sobra— y deja pasar la rueda del ratón. */}
              <div className="atj-grid__scrim" onClick={closeDetail} aria-hidden="true" />
              <div
                className="atj-grid__detail"
                role="dialog"
                aria-label={p.name}
                onClick={closeDetail}
                style={{
                  left: `${detail.left}px`,
                  top: `${detail.top}px`,
                  width: `${detail.boxW}px`,
                  height: `${detail.boxH}px`,
                }}
              >
                <div
                  className="atj-grid__detailMedia"
                  style={{ width: `${detail.w}px`, height: `${detail.h}px` }}
                >
                  {/* La miniatura ya está decodificada: se ve en el mismo frame
                      y tapa el hueco mientras llega el derivado grande. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="atj-grid__detailBase" src={p.src} alt="" aria-hidden="true" />
                  {esVideo ? (
                    <video
                      className="atj-grid__detailFull"
                      src={p.videoFull || p.videoThumb}
                      muted
                      loop
                      playsInline
                      autoPlay
                      onPlaying={(e) => { e.currentTarget.style.opacity = "1"; }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="atj-grid__detailFull"
                      src={p.src}
                      srcSet={p.srcSet || undefined}
                      sizes={`${Math.round(detail.w)}px`}
                      alt={p.label}
                      decoding="async"
                      onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
                    />
                  )}
                </div>
                <figcaption className="atj-grid__detailCap">{p.name}</figcaption>
              </div>
            </Fragment>
          );
        })()}
      </div>

      <style>{`
        .atj-grid {
          position: absolute;
          inset: 0;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          background: var(--atj-bg);
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .atj-grid::-webkit-scrollbar { display: none; }

        .atj-grid__inner {
          position: relative;   /* marco de referencia de la caja de detalle */
          display: grid;
          /* minmax(0, 1fr) y no 1fr a secas: el mínimo de 1fr es el min-content
             de la celda, y el pie sin partir mide lo que mida el nombre del
             fichero. Con doce columnas eso ensanchaba la rejilla por encima del
             viewport y se comía el margen lateral. */
          grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
          gap: var(--gap);
          align-items: start;
          /* El aire de entrada es padding, no un recorte: al hacer scroll las
             piezas siguen subiendo y se meten bajo el navbar. */
          padding: var(--top) var(--gutter) var(--bottom);
        }

        .atj-grid__cell {
          position: relative;
          margin: 0;
          min-width: 0;   /* deja que el pie recorte en vez de empujar */
          cursor: var(--cell-cursor, pointer);
        }
        .atj-grid__media {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: var(--atj-surface);
        }
        .atj-grid__img,
        .atj-grid__video {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
        }
        .atj-grid__video {
          opacity: 0;
          transition: opacity 260ms ease;
          pointer-events: none;
        }

        /* Pie fijo bajo cada pieza: nombre de fichero, peso ligero, gris de
           trabajo. Al pasar por encima sube a negro pleno. */
        .atj-grid__cap {
          display: block;
          margin-top: 6px;
          font: 400 var(--cap, 11px)/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -0.02em;
          color: var(--atj-fg);
          opacity: 0.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: opacity 180ms ease;
        }
        .atj-grid__cell:hover .atj-grid__cap { opacity: 1; }

        /* ── Detalle: la pieza crece sobre la rejilla, que no se mueve ─────── */
        .atj-grid__scrim {
          position: absolute;
          inset: 0;
          z-index: 5;
          cursor: pointer;
        }
        .atj-grid__detail {
          position: absolute;
          z-index: 6;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--detail-pad, 12px);
          background: var(--atj-bg);
          cursor: pointer;
          /* Aparece, no viaja: 120 ms de opacidad y ya está encima. */
          animation: atj-detail-in 120ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes atj-detail-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .atj-grid__detailMedia {
          position: relative;
          flex: 0 0 auto;
          overflow: hidden;
          background: var(--atj-surface);
        }
        .atj-grid__detailBase,
        .atj-grid__detailFull {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
        }
        .atj-grid__detailFull {
          opacity: 0;
          transition: opacity 240ms ease;
        }
        .atj-grid__detailCap {
          margin-top: 8px;
          height: 14px;
          max-width: 100%;
          font: 400 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -0.02em;
          color: var(--atj-fg);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .atj-grid__mark {
          grid-column: 1 / -1;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding: 18px 0 6px;
          font: 800 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -0.045em;
          color: var(--atj-fg);
        }
        .atj-grid__mark span:last-child { font-weight: 400; opacity: 0.4; font-variant-numeric: tabular-nums; }

        /* Capa de vuelo: las celdas se ocultan mientras los clones viajan.
           El fondo blanco de la página se queda, que es el suelo del morph. */
        .atj-grid.is-ghost .atj-grid__cell,
        .atj-grid.is-ghost .atj-grid__detail,
        .atj-grid.is-ghost .atj-grid__scrim { visibility: hidden; }

        @media (prefers-reduced-motion: reduce) {
          .atj-grid__cap, .atj-grid__video, .atj-grid__detailFull { transition: none; }
          .atj-grid__detail { animation: none; }
        }
      `}</style>
    </div>
  );
}
