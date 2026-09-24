/**
 * pieces.js — la lista canónica de piezas del portfolio.
 *
 * Fuente única para todas las vistas (slider, galaxia y el futuro grid). Que las
 * tres recorran este mismo array, en este mismo orden, es lo que hace posible el
 * morph: una pieza es la misma pieza en todas partes, y su índice es su
 * identidad. Si cada vista construyera su propia lista, la transición tendría
 * que emparejar por nombre y cualquier discrepancia se vería como un salto.
 *
 * Total: TARGET_PIECES. Mientras no haya 120 originales, se rellena ciclando el
 * catálogo — nunca la misma pieza dos veces dentro de una galería, así que las
 * copias quedan separadas por al menos un tramo entero. Por eso la identidad de
 * una pieza es su `index`, no su `name`: con relleno hay nombres repetidos, y el
 * morph empareja por posición en la lista.
 *
 * Orden: las galerías van seguidas, y dentro de cada galería se baraja con
 * semilla fija. Así el slider mezcla imágenes y vídeos —no hay bloques de vídeo
 * seguidos de bloques de foto— pero al morphar a la galaxia cada tramo contiguo
 * de la tira se despliega en su propio cúmulo, en vez de cruzarse toda la
 * pantalla. La semilla es fija a propósito: el orden debe ser idéntico en cada
 * carga y en las dos vistas.
 */

import { SPACE_IMAGES, ALL_VIDEOS, VIDEO_LABEL_BY_NAME } from "./mediaCatalog";

export const ORDER_SEED = 20260923;

/** Piezas totales. Con 120 originales en el manifiesto, el relleno desaparece solo. */
export const TARGET_PIECES = 120;

/**
 * Galerías del portfolio. `shape` es la silueta del cúmulo en la galaxia y tiene
 * que existir en su objeto SHAPES: ring · arc · ball · shell · spindle · disc ·
 * lattice · swarm. Un nombre desconocido cae silenciosamente en `swarm`.
 */
export const GALLERIES = [
  {
    id: "adec",
    label: "AdeC",
    shape: "ring",
    images: ["adec-scroll-11", "adec-scroll-12", "adec-scroll-13", "atj-webcontent-002", "atj-webcontent-003"],
  },
  {
    id: "galaxy-bar",
    label: "Galaxy Bar",
    shape: "ball",
    images: ["galaxy-bar-stickers", "galaxybar-explo-serviellets02", "atj-webcontent-001", "atj-webcontent-004", "atj-webcontent-005"],
  },
  {
    id: "johnny",
    label: "Johnny Carretes",
    shape: "spindle",
    images: ["atj-webcontent-006", "atj-webcontent-007", "atj-webcontent-008", "atj-webcontent-009", "atj-webcontent-010"],
  },
  {
    id: "bisbis",
    label: "Bis Bis",
    shape: "lattice",
    images: ["atj-webcontent-011", "atj-webcontent-012", "atj-webcontent-013", "atj-webcontent-014", "atj-webcontent-015"],
  },
  {
    id: "socarrat",
    label: "Socarrat",
    shape: "shell",
    images: ["atj-webcontent-016", "atj-webcontent-017", "atj-webcontent-018", "atj-webcontent-019", "atj-webcontent-020"],
  },
  {
    id: "dfny",
    label: "DFNY",
    shape: "disc",
    images: ["atj-webcontent-021", "atj-webcontent-022", "atj-webcontent-023", "atj-webcontent-024", "atj-webcontent-025"],
  },
  {
    id: "playground",
    label: "Playground",
    shape: "swarm",
    images: ["atj-webcontent-026", "atj-webcontent-027", "atj-webcontent-028", "atj-webcontent-029", "atj-webcontent-030"],
  },
  {
    id: "archive",
    label: "Archive",
    shape: "arc",
    images: ["img-3514", "img-3623", "img-3777-3", "img-5434", "img-5438", "img-5447", "texture-ballon-9-bitmap", "atj-paper-mockup-02-nobg"],
  },
];

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffled = (list, rnd) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const labelFor = (name, type) => {
  if (type === "video" && VIDEO_LABEL_BY_NAME[name]) return VIDEO_LABEL_BY_NAME[name];
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Devuelve la lista ordenada de piezas.
 * @param {string[]} imageIds nombres de imagen disponibles (del manifiesto)
 * @param {string[]} videoIds nombres de vídeo disponibles
 * @returns {{name:string,type:"image"|"video",duplicate:boolean,gallery:string,galleryLabel:string,label:string,index:number}[]}
 */
export function buildPieces(imageIds, videoIds, { seed = ORDER_SEED, target = TARGET_PIECES } = {}) {
  const images = imageIds?.length ? imageIds : SPACE_IMAGES;
  const videos = videoIds?.length ? videoIds : ALL_VIDEOS;
  const imagePool = new Set(images);

  const buckets = GALLERIES.map((g) => ({
    ...g,
    members: g.images.filter((n) => imagePool.has(n)).map((name) => ({ name, type: "image" })),
  }));

  // Imágenes del manifiesto que nadie reclama: al último grupo, sin perderlas.
  const claimed = new Set(buckets.flatMap((b) => b.members.map((m) => m.name)));
  images.filter((n) => !claimed.has(n)).forEach((name) => {
    buckets[buckets.length - 1].members.push({ name, type: "image" });
  });

  // Vídeos repartidos en rueda: cada galería acaba con material de los dos tipos.
  videos.forEach((name, i) => {
    buckets[i % buckets.length].members.push({ name, type: "video" });
  });

  // Relleno hasta `target`, solo con imágenes: los vídeos son los que hay y
  // duplicarlos multiplicaría elementos <video>, que es lo caro. Va al grupo
  // menos poblado y nunca repite dentro del mismo grupo.
  if (images.length) {
    const taken = buckets.map((b) => new Set(b.members.map((m) => m.name)));
    let total = buckets.reduce((a, b) => a + b.members.length, 0);
    let cursor = 0;
    let guard = target * images.length;
    while (total < target && guard-- > 0) {
      let bi = 0;
      for (let i = 1; i < buckets.length; i++) {
        if (buckets[i].members.length < buckets[bi].members.length) bi = i;
      }
      const name = images[cursor % images.length];
      cursor += 1;
      if (taken[bi].has(name)) continue;
      taken[bi].add(name);
      buckets[bi].members.push({ name, type: "image", duplicate: true });
      total += 1;
    }
  }

  const rnd = mulberry(seed);
  const out = [];
  for (const bucket of buckets) {
    for (const m of shuffled(bucket.members, rnd)) {
      out.push({
        name: m.name,
        type: m.type,
        duplicate: !!m.duplicate,
        gallery: bucket.id,
        galleryLabel: bucket.label,
        label: labelFor(m.name, m.type),
        index: out.length,
      });
    }
  }
  return out;
}
