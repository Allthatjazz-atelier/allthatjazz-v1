import gsap from "gsap";

// ─── Morph slider ↔ rejilla ────────────────────────────────────────────────────
// Un solo gesto, dos eases: se recogen con expo.in y aterrizan con expo.out.
// Las fases se solapan —no hay un hold— para que se lea como una respiración.
// Stagger fijo desde el centro (la pieza que se estaba mirando lidera),
// 55 ms entre rangos: se oye el coro, no un disparo a la vez.
//
// Los clones viven en una capa de vuelo. Las vistas origen y destino se ponen
// en "ghost" para no pintar dos veces la misma imagen.
//
// El gesto se pide en DOS TIEMPOS. Sus dos mitades no necesitan lo mismo:
//
//   · la recogida solo necesita saber de dónde sale cada pieza, y eso ya está
//     medido en el frame del click;
//   · la apertura necesita la vista de destino montada y maquetada —React
//     reconcilia, la rejilla se desplaza hasta la pieza activa, se vuelve a
//     medir—, y eso son varios frames.
//
// Antes se esperaba a lo segundo para empezar lo primero, así que entre el dedo
// y el primer píxel en movimiento cabía toda esa cadena. `beginMorph` arranca la
// recogida ya; `land()` engancha la apertura cuando el destino está listo.
//
// El margen es de sobra: la primera apertura no entra hasta `recedeDur -
// overlap` (360 ms en escritorio, 230 en táctil) y preparar el destino cuesta
// decenas de ms. Si aun así llegara tarde, el guion entero se adelanta en bloque
// conservando las diferencias, en vez de recortar cada hueco por su cuenta —eso
// dejaba a todas a cero y perdía la ola justo en el caso en que más se nota—.
//
// `snapshot()` completa el cuadro: fotografía lo que va en vuelo para que otro
// gesto lo herede. Es lo que hace que cambiar de idea a media transición sea un
// cambio de rumbo y no un corte.

const RECEDE_DUR = 0.56;
const BLOOM_DUR = 0.88;
const OVERLAP = 0.2;
const STAGGER = 0.055;
const STAGGER_RANKS = 7;
const RECEDE_EASE = "expo.in";
const BLOOM_EASE = "expo.out";

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
// caso real (escritorio de 1440 a 12 columnas) y unas 16 en móvil a 4. Los topes
// quedan por encima a propósito, para que no muerdan salvo en una pantalla
// absurdamente grande.
const MAX_FLYERS = { fine: 96, coarse: 48 };

// ── Geometría del cúmulo ──────────────────────────────────────────────────────
// Cuánto del offset original conserva cada pieza al recogerse, y cómo de grande
// queda allí. El reparto era una constante (22 %) y el tamaño otra (48–96 px), y
// esa pareja solo cuadra en una pantalla ancha: el 22 % de 1512 px son ±166 px
// de reparto y dieciséis miniaturas de 48 se distinguen sin problema. En 375 px
// ese mismo 22 % son ±37, y ahí dentro no cabe nada sin apilarse —el tamaño es
// absoluto y su dispersión relativa al viewport, así que en cuanto la pantalla
// se estrecha una se come a la otra—.
//
// La corrección va en el REPARTO, no en el tamaño: ensanchar el cúmulo deja las
// piezas donde estaban de tamaño y les da sitio. Y así el escritorio no se toca
// —sigue en 0,22 exacto por encima de 1024 px—, que es lo que se quería.
const COMPRESS_WIDE = 0.22;
const COMPRESS_NARROW = 0.42;
const COMPRESS_FROM = 1024;
const COMPRESS_NARROWEST = 360;
const CLUSTER_MIN = 48;
const CLUSTER_MAX = 96;

const compressFor = (vw) => {
  const t = Math.min(1, Math.max(0, (COMPRESS_FROM - vw) / (COMPRESS_FROM - COMPRESS_NARROWEST)));
  return COMPRESS_WIDE + (COMPRESS_NARROW - COMPRESS_WIDE) * t;
};

/** El suelo del tamaño también cede en pantallas pequeñas: 48 px fijos son
 *  mucho cuando la zona entera mide 157. Por encima de ~440 px de lado corto no
 *  muerde, así que el escritorio se queda en 48 clavados. */
const clusterMinFor = (vmin) => Math.min(CLUSTER_MIN, vmin * 0.11);

const coarsePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const motionOf = () => (
  coarsePointer()
    ? COARSE
    : { recedeDur: RECEDE_DUR, bloomDur: BLOOM_DUR, overlap: OVERLAP, stagger: STAGGER, ranks: STAGGER_RANKS }
);

/** Techo del gesto en escritorio. El escenario lo usa como red de seguridad. */
export const MORPH_MS = Math.round(
  (RECEDE_DUR + BLOOM_DUR * 1.1 - OVERLAP + STAGGER * (STAGGER_RANKS - 1) + 0.12) * 1000,
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

const distToVanish = (r, vanish) => {
  if (!r) return Infinity;
  const c = centerOf(r);
  return Math.hypot(c.x - vanish.x, c.y - vanish.y);
};

/** Tira la pieza hacia el punto de fuga dejando un residual de su offset. */
function recedeRect(from, vanish, cluster) {
  const c = centerOf(from);
  const mx = vanish.x + (c.x - vanish.x) * cluster.compress;
  const my = vanish.y + (c.y - vanish.y) * cluster.compress;
  const long = Math.max(from.w, from.h);
  const s = Math.max(cluster.min, Math.min(CLUSTER_MAX, long * 0.14));
  const k = s / long;
  const w = from.w * k;
  const h = from.h * k;
  return { x: mx - w / 2, y: my - h / 2, w, h };
}

/** 0 en el centro del viewport, ranks-1 en los bordes. */
function rankOf(rect, origin, vw, vh, ranks) {
  const c = centerOf(rect);
  const d = Math.hypot(c.x - origin.x, c.y - origin.y);
  const t = Math.min(1, d / (Math.hypot(vw, vh) * 0.42));
  return Math.round(t * (ranks - 1));
}

// ── Colocación ────────────────────────────────────────────────────────────────
// El clon se maqueta a una caja fija (`base`) y todo lo demás es transform. Se
// anima con las propiedades de GSAP (x, y, scale) y no construyendo la cadena a
// mano en un `onUpdate`: sale lo mismo —la escala es el ancho relativo y las dos
// vistas respetan la proporción del medio, así que el alto cae solo— pero por la
// vía rápida de GSAP, sin objeto intermedio, sin plantilla por frame y sin
// interpolar un alto que nadie leía.
//
// El z-index NO se toca aquí: se fija una vez al crear el clon, por rango.
// Recalcularlo por frame —salía del área de la caja— reordena las piezas unas
// sobre otras durante todo el vuelo, y eso se ve: el cúmulo parpadea. Un orden
// estable vale más que uno exacto.
const scaleIn = (base, rect) => (base.w > 0 ? rect.w / base.w : 1);
const boxVars = (base, rect) => ({ x: rect.x, y: rect.y, scale: scaleIn(base, rect) });

function styleFlyer(el, base, at) {
  el.className = "stage__flyer";
  el.draggable = false;
  el.style.width = `${base.w}px`;
  el.style.height = `${base.h}px`;
  el.style.transformOrigin = "0 0";
  gsap.set(el, boxVars(base, at || base));
}

// Se prefiere el fotograma del lado que se ve MÁS GRANDE, y solo si ya está
// decodificado. Yendo de rejilla a slider el clon llevaba el derivado de una
// celda de 83 px y lo estiraba hasta 343: volaba y aterrizaba blando, y la
// nitidez volvía de golpe al revelarse la vista real. Pedir uno sin decodificar
// a mitad de gesto sería peor, así que si el grande no está listo se va con el
// pequeño. Siempre una imagen: un <video> nuevo abriría otro decodificador.
function resolveStill(from, to) {
  const a = from?.visible !== false ? from : null;
  const b = to;
  const stillOf = (r) => r?.poster || (r?.kind !== "video" && r?.src) || null;
  const decodificado = (r) => {
    const el = r?.el;
    if (!el) return false;
    return el.tagName === "IMG" ? Boolean(el.complete && el.naturalWidth) : true;
  };
  const areaA = a ? a.w * a.h : 0;
  const areaB = b ? b.w * b.h : 0;
  const orden = areaB > areaA * 1.2 && decodificado(b) ? [b, a] : [a, b];
  for (const r of orden) {
    const s = stillOf(r);
    if (s) return s;
  }
  return null;
}

function makeClone(src, base, at) {
  const img = document.createElement("img");
  styleFlyer(img, base, at);
  img.alt = "";
  img.src = src;
  return img;
}

/** La apertura dura un poco más cuando el salto de escala es grande. Sin esto,
 *  una rejilla de 12 columnas (la pieza crece ×2,4 desde el cúmulo) y una de 3
 *  (×7) comparten tiempo: la densa se atropella y la suelta se arrastra. */
function paceOf(ratios) {
  if (!ratios.length) return 1;
  const orden = [...ratios].sort((a, b) => a - b);
  const mediana = orden[orden.length >> 1];
  const octavas = Math.log2(Math.max(1, mediana));
  return 0.88 + Math.min(octavas, 2.9) * 0.07;
}

/**
 * Arranca la recogida con lo único que hace falta saber en el click: de dónde
 * sale cada pieza. La apertura se engancha después con `land()`.
 *
 * `toHint` son los rectángulos del destino tal y como están AHORA, sin esperar a
 * que se coloque. No sirven como geometría —la rejilla todavía no se ha
 * desplazado a la pieza activa— y no se usan para eso: solo dicen, por pieza, si
 * va a verse y de qué tamaño. Con eso basta para elegir el fotograma bueno y
 * maquetar el clon a la caja correcta desde el principio.
 *
 * @param {{
 *   fromFlyers: Map<number, {x:number,y:number,w:number,h:number,src:string,visible?:boolean}>,
 *   toHint?: Map<number, object> | null,
 *   layer: HTMLElement,
 * }} opts
 * @returns {null | {
 *   land: (toFlyers: Map<number, object> | null, onComplete?: () => void) => void,
 *   snapshot: () => Map<number, object>,
 *   kill: () => void,
 * }}
 */
export function beginMorph({ fromFlyers, toHint, layer }) {
  if (!layer || !fromFlyers) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vanish = vanishOf(vw, vh);
  const motion = motionOf();
  const cluster = { compress: compressFor(vw), min: clusterMinFor(Math.min(vw, vh)) };
  const cap = MAX_FLYERS[coarsePointer() ? "coarse" : "fine"];

  // Reloj común de las dos fases. `land()` puede llegar en cualquier momento, y
  // necesita saber cuánto se ha consumido ya del guion para colocar lo suyo.
  const t0 = performance.now();
  const clock = () => (performance.now() - t0) / 1000;

  const tweens = [];
  /** Todo lo que hay en la capa de vuelo, por pieza. Incluye lo que nace en
   *  `land()`, porque `snapshot()` tiene que poder fotografiarlo también. */
  const flying = new Map();
  let killed = false;
  let landed = false;

  const track = (tw) => { tweens.push(tw); return tw; };

  // Solo se recoge lo que se ve. El slider publica también sus slides ocultas:
  // esas no tienen recogida —no hay nada que recoger— pero sí pueden tener
  // destino, y entonces nacen del cúmulo en `land()`.
  let salen = [];
  fromFlyers.forEach((f, k) => { if (f.visible !== false) salen.push(k); });
  // Si alguna vez hubiera más de las que caben, se quedan las de más cerca del
  // centro: son las que se están mirando y las que más se notan si faltan.
  if (salen.length > cap) {
    salen.sort((a, b) => distToVanish(fromFlyers.get(a), vanish) - distToVanish(fromFlyers.get(b), vanish));
    salen.length = cap;
  }

  salen.forEach((key) => {
    const from = fromFlyers.get(key);
    // La pieza que va a verse en el destino Y más grande de lo que sale: se
    // maqueta a la caja de llegada y arranca encogida, en vez de maquetarse a la
    // de salida y estirarse al final. Un <img> se rasteriza a su caja CSS, así
    // que estirarlo ×3 al aterrizar lo deja blando hasta que la vista real
    // releva. Solo afecta a las que aterrizan grandes —tres en un móvil—, que es
    // lo que evita pagar capas enormes por las doce que solo se desvanecen.
    const hint = toHint?.get(key);
    const crece = Boolean(hint?.visible && hint.w > from.w * 1.2);
    const src = resolveStill(from, crece ? hint : null);
    if (!src) return;

    const base = crece ? { ...from, w: hint.w, h: hint.h } : from;
    const mid = recedeRect(from, vanish, cluster);
    const rank = rankOf(from, vanish, vw, vh, motion.ranks);
    const delay = rank * motion.stagger;

    const flyer = makeClone(src, base, from);
    // El centro viaja encima: la ola se lee en profundidad. Se fija aquí y no se
    // vuelve a tocar en todo el vuelo.
    flyer.style.zIndex = String(20 - rank);
    layer.appendChild(flyer);

    flying.set(key, { flyer, base, delay, mid });

    // Heredada de un gesto anterior a medio aparecer o a medio apagarse: se
    // recupera en vez de saltar a opaca. Cambiar de idea le devuelve un futuro.
    if (from.opacity != null && from.opacity < 1) {
      gsap.set(flyer, { opacity: from.opacity });
      track(gsap.to(flyer, { opacity: 1, duration: motion.recedeDur * 0.6, ease: "power2.out" }));
    }

    track(gsap.to(flyer, {
      ...boxVars(base, mid),
      duration: motion.recedeDur,
      delay,
      ease: RECEDE_EASE,
    }));
  });

  /** Dónde está ahora mismo cada pieza en vuelo, en coordenadas de viewport.
   *  Sirve de `fromFlyers` para encadenar otro gesto sin que se note el relevo. */
  const snapshot = () => {
    const out = new Map();
    if (killed) return out;
    flying.forEach((f, key) => {
      const s = Number(gsap.getProperty(f.flyer, "scale")) || 1;
      const src = f.flyer.getAttribute("src");
      if (!src) return;
      const o = Number(gsap.getProperty(f.flyer, "opacity"));
      out.set(key, {
        x: Number(gsap.getProperty(f.flyer, "x")) || 0,
        y: Number(gsap.getProperty(f.flyer, "y")) || 0,
        w: f.base.w * s,
        h: f.base.h * s,
        kind: "image",
        src,
        poster: src,
        el: f.flyer,
        opacity: Number.isFinite(o) ? o : 1,
        visible: true,
      });
    });
    return out;
  };

  const kill = () => {
    if (killed) return;
    killed = true;
    tweens.forEach((tw) => tw.kill());
    tweens.length = 0;
    flying.forEach((f) => f.flyer.remove());
    flying.clear();
  };

  /**
   * Engancha la apertura. `toFlyers` son los rectángulos del destino ya
   * maquetado; las piezas sin destino se apagan y las que no salían de ninguna
   * parte nacen del cúmulo.
   */
  const land = (toFlyers, onComplete) => {
    if (killed || landed) return;
    landed = true;

    const ahora = clock();

    // Se reparte en dos pasadas porque la segunda necesita saber lo que salió de
    // la primera. Cada pieza trae su hueco en tiempo absoluto —contado desde el
    // click— y solo después se traduce a un retraso.
    const guion = [];
    const ratios = [];

    // ── Las que ya van en vuelo: abren, o se apagan si no tienen destino ──────
    flying.forEach((f, key) => {
      const to = toFlyers?.get(key);
      if (to && to.visible !== false) {
        const rank = rankOf(to, vanish, vw, vh, motion.ranks);
        if (f.mid?.w > 0) ratios.push(to.w / f.mid.w);
        guion.push({
          at: f.delay + motion.recedeDur - motion.overlap + rank * motion.stagger,
          run: (delay, dur) => track(gsap.to(f.flyer, {
            ...boxVars(f.base, to),
            duration: dur,
            delay,
            ease: BLOOM_EASE,
            // Releva a la recogida en vez de pelearse con ella por las mismas
            // propiedades durante el solape: al arrancar, la apertura mata lo
            // que quedara de la otra y toma los valores donde estén.
            overwrite: "auto",
          })),
        });
      } else {
        guion.push({
          at: f.delay + motion.recedeDur * 0.45,
          fixed: 0.28,
          run: (delay) => track(gsap.to(f.flyer, {
            opacity: 0, duration: 0.28, delay, ease: "power2.in",
          })),
        });
      }
    });

    // ── Y las que no salían de ninguna parte: nacen del cúmulo ────────────────
    const restante = Math.max(0, cap - flying.size);
    let llegan = [];
    toFlyers?.forEach((t, k) => { if (t.visible && !flying.has(k)) llegan.push(k); });
    if (llegan.length > restante) {
      llegan.sort((a, b) => distToVanish(toFlyers.get(a), vanish) - distToVanish(toFlyers.get(b), vanish));
      llegan.length = restante;
    }

    llegan.forEach((key) => {
      const to = toFlyers.get(key);
      const src = resolveStill(fromFlyers.get(key), to);
      if (!src) return;

      const mid = recedeRect(to, vanish, cluster);
      const rank = rankOf(to, vanish, vw, vh, motion.ranks);
      if (mid.w > 0) ratios.push(to.w / mid.w);

      // Aquí la caja CSS es la del DESTINO y la pieza arranca encogida hasta el
      // cúmulo. Al revés —maquetarla a los 48 px del cúmulo y estirarla ×8— se
      // rasterizaba a 48 px y llegaba deshecha.
      const flyer = makeClone(src, to, mid);
      // Sin recogida que las ordene, el rango que las coloca es el de llegada.
      flyer.style.zIndex = String(20 - rank);
      flyer.style.opacity = "0";
      layer.appendChild(flyer);
      flying.set(key, { flyer, base: to, delay: 0 });

      guion.push({
        at: motion.recedeDur - motion.overlap + rank * motion.stagger,
        run: (delay, dur) => {
          track(gsap.to(flyer, {
            ...boxVars(to, to),
            duration: dur,
            delay,
            ease: BLOOM_EASE,
          }));
          track(gsap.to(flyer, {
            opacity: 1,
            duration: coarsePointer() ? 0.24 : 0.36,
            delay,
            ease: "power2.out",
          }));
        },
      });
    });

    const bloomDur = motion.bloomDur * paceOf(ratios);

    // Si el destino llegó tarde, el guion entero se adelanta lo justo para que
    // la primera pieza entre ya, y las demás conservan sus diferencias. Recortar
    // cada hueco por su cuenta las dejaría a todas en cero: la ola se perdería
    // entera justo en el caso en que más se nota.
    const primero = guion.length ? Math.min(...guion.map((g) => g.at)) : 0;
    const adelanto = Math.max(0, ahora - primero);
    let fin = 0;
    guion.forEach((g) => {
      const delay = Math.max(0, g.at + adelanto - ahora);
      const dur = g.fixed || bloomDur;
      fin = Math.max(fin, delay + dur);
      g.run(delay, dur);
    });

    // Los clones se quedan un frame de más: el destino se revela debajo y solo
    // entonces el caller llama a kill(). Si se quitaran aquí se vería el hueco.
    track(gsap.delayedCall(fin, () => { onComplete?.(); }));
  };

  return { land, snapshot, kill };
}
