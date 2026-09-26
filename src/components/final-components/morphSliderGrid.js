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
// El tamaño llega después que la posición: la pieza se separa de sus vecinas
// antes de crecer, así que se abren sin pisarse en el centro. Sin esto, todas
// alcanzan su tamaño final mientras siguen amontonadas junto al punto de fuga.
const BLOOM_SIZE_LAG = 0.28;
const CLUSTER_MIN = 48;
const CLUSTER_MAX = 96;

// En táctil el mismo relato, más corto y en tres olas: menos capas vivas a la vez.
const COARSE = {
  recedeDur: 0.35,
  bloomDur: 0.55,
  overlap: 0.12,
  stagger: 0.045,
  ranks: 3,
};

// Tope de clones en vuelo. Es una válvula, no una decisión de estilo: vuelan
// todas las piezas que estén en pantalla, y en la práctica eso son 60 en el peor
// caso real (escritorio de 1440 a 12 columnas) y unas 30 en móvil a 4. Los topes
// quedan por encima a propósito, para que no muerdan salvo en una pantalla
// absurdamente grande. Sesenta clones son sesenta escrituras de transform por
// frame; el slider hacía doscientas sin despeinarse.
const MAX_FLYERS = { fine: 96, coarse: 48 };

/** El ease de apertura como función: hace falta aplicarlo a mano sobre `t`. */
const BLOOM_EASE_FN = gsap.parseEase(BLOOM_EASE);

const coarsePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const motionOf = () => (
  coarsePointer()
    ? COARSE
    : { recedeDur: RECEDE_DUR, bloomDur: BLOOM_DUR, overlap: OVERLAP, stagger: STAGGER, ranks: STAGGER_RANKS }
);

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

/** 0 en el centro del viewport, ranks-1 en los bordes. */
function rankOf(rect, origin, vw, vh, ranks) {
  const c = centerOf(rect);
  const d = Math.hypot(c.x - origin.x, c.y - origin.y);
  const t = Math.min(1, d / (Math.hypot(vw, vh) * 0.42));
  return Math.round(t * (ranks - 1));
}

function applyBox(el, start, box) {
  // Escala uniforme por el ancho: las dos vistas respetan la proporción del
  // medio, así que el alto cae solo. Evita aplastar el fotograma.
  const s = start.w > 0 ? box.w / start.w : 1;
  el.style.transform = `translate3d(${box.x.toFixed(2)}px,${box.y.toFixed(2)}px,0) scale(${s.toFixed(4)})`;
  // Profundidad por tamaño: la más grande es la que está más cerca, así que va
  // delante. Antes el z-index se fijaba al salir, por distancia al punto de
  // fuga, y no se volvía a tocar: una miniatura ya encogida conservaba su
  // prioridad y pintaba por encima de otra ya desplegada.
  //
  // El criterio es el ÁREA y no el ancho: dos piezas del mismo ancho y distinta
  // proporción ocupan superficies muy distintas, y ordenarlas por ancho las deja
  // empatadas —decide el orden del DOM, que no tiene nada que ver con cuál se
  // ve más grande—.
  const z = String(Math.round(Math.sqrt(Math.max(0, box.w * box.h))));
  if (el.style.zIndex !== z) el.style.zIndex = z;
}

function styleFlyer(el, start) {
  el.className = "stage__flyer";
  el.draggable = false;
  el.style.width = `${start.w}px`;
  el.style.height = `${start.h}px`;
  el.style.transformOrigin = "0 0";
  applyBox(el, start, start);
}

// Siempre una imagen ya decodificada (póster o still). Un <video> nuevo
// abriría otro decodificador en mitad del gesto.
function resolveStill(from, to) {
  const a = from?.visible !== false ? from : null;
  const b = to;
  const src = a?.poster || b?.poster || (a?.kind !== "video" && a?.src) || (b?.kind !== "video" && b?.src) || null;
  return src || null;
}

function makeClone(src, start) {
  const img = document.createElement("img");
  styleFlyer(img, start);
  img.alt = "";
  img.src = src;
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
  const motion = motionOf();

  const keys = new Set();
  fromFlyers.forEach((f, k) => { if (f.visible !== false) keys.add(k); });
  toFlyers.forEach((f, k) => { if (f.visible) keys.add(k); });

  // Si alguna vez hubiera más de las que caben, se quedan las de más cerca del
  // centro: son las que se están mirando y las que más se notan si faltan.
  const cap = MAX_FLYERS[coarsePointer() ? "coarse" : "fine"];
  if (keys.size > cap) {
    const rank = (k) => {
      const r = fromFlyers.get(k) || toFlyers.get(k);
      if (!r) return Infinity;
      const c = centerOf(r);
      return Math.hypot(c.x - vanish.x, c.y - vanish.y);
    };
    const ordenadas = [...keys].sort((a, b) => rank(a) - rank(b)).slice(0, cap);
    keys.clear();
    ordenadas.forEach((k) => keys.add(k));
  }

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
    clones.forEach((el) => el.remove());
    clones.length = 0;
  };

  keys.forEach((key) => {
    const from = fromFlyers.get(key);
    const to = toFlyers.get(key);
    const src = resolveStill(from, to);
    if (!src) return;

    const start = from && from.visible !== false ? from : recedeFromDest(to, vanish);
    const mid = from && from.visible !== false
      ? recedeRect(from, vanish)
      : recedeFromDest(to, vanish);
    const end = to || mid;
    const lands = Boolean(to);
    const arrivesFromCluster = !from || from.visible === false;

    const recedeRank = rankOf(from || mid, vanish, vw, vh, motion.ranks);
    const bloomRank = rankOf(end, vanish, vw, vh, motion.ranks);
    const recedeDelay = recedeRank * motion.stagger;
    const bloomDelay = bloomRank * motion.stagger;

    const flyer = makeClone(src, start);
    flyer.style.opacity = arrivesFromCluster ? "0" : "1";
    layer.appendChild(flyer);
    clones.push(flyer);

    const proxy = { x: start.x, y: start.y, w: start.w, h: start.h };

    if (!arrivesFromCluster) {
      tl.to(proxy, {
        x: mid.x, y: mid.y, w: mid.w, h: mid.h,
        duration: motion.recedeDur,
        ease: RECEDE_EASE,
        onUpdate: () => applyBox(flyer, start, proxy),
      }, recedeDelay);
    } else {
      applyBox(flyer, start, mid);
      proxy.x = mid.x; proxy.y = mid.y; proxy.w = mid.w; proxy.h = mid.h;
    }

    const bloomAt = recedeDelay + motion.recedeDur - motion.overlap + bloomDelay;
    if (lands) {
      // La apertura interpola el CENTRO y el TAMAÑO por separado, con el tamaño
      // un poco retrasado. Se recorre con un progreso propio (`t`) y el ease va
      // dentro: así las dos curvas salen del mismo reloj y no hay dos tweens
      // peleándose por las mismas propiedades durante el solape de fases.
      const c0 = { x: mid.x + mid.w / 2, y: mid.y + mid.h / 2 };
      const c1 = { x: end.x + end.w / 2, y: end.y + end.h / 2 };
      const box = { x: 0, y: 0, w: 0, h: 0 };
      proxy.t = 0;
      tl.to(proxy, {
        t: 1,
        duration: motion.bloomDur,
        ease: "none",
        onUpdate: () => {
          const p = BLOOM_EASE_FN(proxy.t);
          const q = BLOOM_EASE_FN(
            Math.min(1, Math.max(0, (proxy.t - BLOOM_SIZE_LAG) / (1 - BLOOM_SIZE_LAG))),
          );
          box.w = mid.w + (end.w - mid.w) * q;
          box.h = mid.h + (end.h - mid.h) * q;
          box.x = c0.x + (c1.x - c0.x) * p - box.w / 2;
          box.y = c0.y + (c1.y - c0.y) * p - box.h / 2;
          applyBox(flyer, start, box);
        },
      }, Math.max(0, bloomAt));
      if (arrivesFromCluster) {
        tl.to(flyer, { opacity: 1, duration: coarsePointer() ? 0.24 : 0.36, ease: "power2.out" }, Math.max(0, bloomAt));
      }
    } else {
      tl.to(flyer, { opacity: 0, duration: 0.28, ease: "power2.in" }, recedeDelay + motion.recedeDur * 0.45);
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
