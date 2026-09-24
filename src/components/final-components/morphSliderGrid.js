import gsap from "gsap";

// ─── Morph slider ↔ rejilla ────────────────────────────────────────────────────
// Un solo gesto, dos eases: se recogen con expo.in y aterrizan con expo.out.
// Las fases se solapan —no hay un hold— para que se lea como una respiración.
// Stagger fijo desde el centro (la pieza que se estaba mirando lidera),
// 55 ms entre rangos: se oye el coro, no un disparo a la vez.
//
// Los clones viven en una capa de vuelo. Las vistas origen y destino se ponen
// en "ghost" para no pintar dos veces la misma imagen.

const RECEDE_DUR = 0.56;
const BLOOM_DUR = 0.88;
const OVERLAP = 0.2;
const STAGGER = 0.055;
const STAGGER_RANKS = 7;
const RECEDE_EASE = "expo.in";
const BLOOM_EASE = "expo.out";
const COMPRESS = 0.22;
const CLUSTER_MIN = 48;
const CLUSTER_MAX = 96;

export const MORPH_MS = Math.round(
  (RECEDE_DUR + BLOOM_DUR - OVERLAP + STAGGER * (STAGGER_RANKS - 1) + 0.12) * 1000,
);

export const prefersReduce = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function waitFor(pred, ms = 1400) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (pred()) return resolve(true);
      if (performance.now() - t0 > ms) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function afterLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

const vanishOf = (vw, vh) => ({
  x: vw * 0.5,
  y: vh * 0.52,
});

/** Tira la pieza hacia el punto de fuga dejando un residual de su offset. */
function recedeRect(from, vanish) {
  const c = centerOf(from);
  const mx = vanish.x + (c.x - vanish.x) * COMPRESS;
  const my = vanish.y + (c.y - vanish.y) * COMPRESS;
  const long = Math.max(from.w, from.h);
  const s = Math.max(CLUSTER_MIN, Math.min(CLUSTER_MAX, long * 0.14));
  const k = s / long;
  const w = from.w * k;
  const h = from.h * k;
  return { x: mx - w / 2, y: my - h / 2, w, h };
}

function recedeFromDest(to, vanish) {
  return recedeRect(to, vanish);
}

/** 0 en el centro del viewport, STAGGER_RANKS-1 en los bordes. */
function rankOf(rect, origin, vw, vh) {
  const c = centerOf(rect);
  const d = Math.hypot(c.x - origin.x, c.y - origin.y);
  const t = Math.min(1, d / (Math.hypot(vw, vh) * 0.42));
  return Math.round(t * (STAGGER_RANKS - 1));
}

function applyBox(el, start, box) {
  // Escala uniforme por el ancho: las dos vistas respetan la proporción del
  // medio, así que el alto cae solo. Evita aplastar el fotograma.
  const s = start.w > 0 ? box.w / start.w : 1;
  el.style.transform = `translate3d(${box.x.toFixed(2)}px,${box.y.toFixed(2)}px,0) scale(${s.toFixed(4)})`;
}

/** Fotograma actual: tapa el hueco negro mientras el clon del vídeo arranca. */
function snapshotPoster(video) {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  try {
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}

function styleFlyer(el, start) {
  el.className = "stage__flyer";
  el.draggable = false;
  el.style.width = `${start.w}px`;
  el.style.height = `${start.h}px`;
  el.style.transformOrigin = "0 0";
  applyBox(el, start, start);
}

function resolveMedia(from, to) {
  const a = from?.visible !== false ? from : null;
  const b = to;
  const videoSrc = (a?.kind === "video" && a.src) || (b?.kind === "video" && b.src);
  if (videoSrc) {
    return {
      kind: "video",
      src: videoSrc,
      poster: a?.poster || b?.poster || null,
      currentTime: a?.currentTime || b?.currentTime || 0,
      el: (a?.kind === "video" && a.el) || (b?.kind === "video" && b.el) || null,
    };
  }
  const src = a?.src || b?.src || a?.poster || b?.poster;
  return src ? { kind: "image", src } : null;
}

function makeClone(media, start) {
  if (media.kind === "video") {
    const v = document.createElement("video");
    styleFlyer(v, start);
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("muted", "");
    v.preload = "auto";
    v.poster = snapshotPoster(media.el) || media.poster || "";
    v.src = media.src;
    const t = media.currentTime || 0;
    const kick = () => {
      try { if (t > 0.05 && Number.isFinite(t)) v.currentTime = t; } catch { /* ok */ }
      v.play().catch(() => {});
    };
    if (v.readyState >= 1) kick();
    else v.addEventListener("loadedmetadata", kick, { once: true });
    return v;
  }
  const img = document.createElement("img");
  styleFlyer(img, start);
  img.alt = "";
  img.src = media.src;
  return img;
}

/**
 * @param {{
 *   fromFlyers: Map<number, {x:number,y:number,w:number,h:number,src:string,visible?:boolean}>,
 *   toFlyers: Map<number, {x:number,y:number,w:number,h:number,src:string,visible?:boolean}>,
 *   layer: HTMLElement,
 *   onComplete?: () => void,
 * }} opts
 */
export function runMorph({ fromFlyers, toFlyers, layer, onComplete }) {
  if (!layer) {
    onComplete?.();
    return { kill() {} };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vanish = vanishOf(vw, vh);

  const keys = new Set();
  fromFlyers.forEach((f, k) => { if (f.visible !== false) keys.add(k); });
  toFlyers.forEach((f, k) => { if (f.visible) keys.add(k); });

  const clones = [];
  const tl = gsap.timeline({
    defaults: { ease: RECEDE_EASE },
    onComplete: () => {
      // Los clones se quedan un frame: el destino se revela debajo y luego
      // el caller llama a kill(). Si los quitáramos aquí se vería el hueco.
      onComplete?.();
    },
  });

  const cleanup = () => {
    clones.forEach((el) => {
      if (el.tagName === "VIDEO") {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      el.remove();
    });
    clones.length = 0;
  };

  keys.forEach((key) => {
    const from = fromFlyers.get(key);
    const to = toFlyers.get(key);
    const media = resolveMedia(from, to);
    if (!media) return;

    const start = from && from.visible !== false ? from : recedeFromDest(to, vanish);
    const mid = from && from.visible !== false
      ? recedeRect(from, vanish)
      : recedeFromDest(to, vanish);
    const end = to || mid;
    const lands = Boolean(to);
    const arrivesFromCluster = !from || from.visible === false;

    const recedeRank = rankOf(from || mid, vanish, vw, vh);
    const bloomRank = rankOf(end, vanish, vw, vh);
    const recedeDelay = recedeRank * STAGGER;
    const bloomDelay = bloomRank * STAGGER;

    const flyer = makeClone(media, start);
    // El centro viaja encima: la ola se lee en profundidad.
    flyer.style.zIndex = String(20 - recedeRank);
    flyer.style.opacity = arrivesFromCluster ? "0" : "1";
    layer.appendChild(flyer);
    clones.push(flyer);

    const proxy = { x: start.x, y: start.y, w: start.w, h: start.h };

    if (!arrivesFromCluster) {
      tl.to(proxy, {
        x: mid.x, y: mid.y, w: mid.w, h: mid.h,
        duration: RECEDE_DUR,
        ease: RECEDE_EASE,
        onUpdate: () => applyBox(flyer, start, proxy),
      }, recedeDelay);
    } else {
      applyBox(flyer, start, mid);
      proxy.x = mid.x; proxy.y = mid.y; proxy.w = mid.w; proxy.h = mid.h;
    }

    const bloomAt = recedeDelay + RECEDE_DUR - OVERLAP + bloomDelay;
    if (lands) {
      tl.to(proxy, {
        x: end.x, y: end.y, w: end.w, h: end.h,
        duration: BLOOM_DUR,
        ease: BLOOM_EASE,
        onUpdate: () => applyBox(flyer, start, proxy),
      }, Math.max(0, bloomAt));
      if (arrivesFromCluster) {
        tl.to(flyer, { opacity: 1, duration: 0.36, ease: "power2.out" }, Math.max(0, bloomAt));
      }
    } else {
      tl.to(flyer, { opacity: 0, duration: 0.28, ease: "power2.in" }, recedeDelay + RECEDE_DUR * 0.45);
    }
  });

  if (!clones.length) {
    tl.kill();
    onComplete?.();
    return { kill() {} };
  }

  return {
    kill() {
      tl.kill();
      cleanup();
    },
  };
}
