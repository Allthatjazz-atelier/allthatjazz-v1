"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { SPACE_IMAGES, ALL_VIDEOS } from "@/data/mediaCatalog";

// ─── Constelaciones ────────────────────────────────────────────────────────────
// Sin polvo: cada sprite es una pieza real, clicable y enfocable. `shape` es la
// silueta del cúmulo — es lo que hace reconocible cada galería de lejos.
// PROVISIONAL: sustituir `label` e `images` por las galerías reales.
const CONSTELLATIONS = [
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

// Piezas totales en la galaxia. El catálogo actual tiene 63 activos, así que se
// rellena ciclando el catálogo (nunca dos veces la misma pieza dentro de una
// constelación). Cuando haya 120 originales, el relleno desaparece solo.
const TARGET_PIECES = 120;

// ─── Galaxia ───────────────────────────────────────────────────────────────────
// Núcleo compacto y volumétrico: las constelaciones se reparten sobre una
// esfera de Fibonacci (no en un plano), así hay recorrido real en los tres ejes
// y la masa se lee densa desde cualquier ángulo.
const CORE_R = 9.2;           // radio del núcleo donde viven las constelaciones
const GALAXY_FLAT = 0.78;     // achatado en Y (1 = esfera perfecta)
const BLOB_R = 4.6;           // radio de cada constelación (a más cerca de CORE_R,
                              // más se interpenetran y más densa se ve la masa)
const PIECE_SIZE = [1.2, 2.5];   // tamaño de pieza relativo a la galaxia = densidad aparente

// Cuánto carácter tiene cada constelación: 0 = todas son el mismo enjambre,
// 1 = cada una con su silueta. Es el mando para decidir si las formas aportan.
const SHAPE_VARIETY = 0.6;

// ─── Profundidad ───────────────────────────────────────────────────────────────
// La galaxia se alarga a lo largo del eje de vista inicial: da recorrido en Z
// sin ensanchar la silueta. La cámara se coloca por búsqueda numérica a la
// distancia mínima donde todo entra en cuadro respetando NEAR_MARGIN, así que
// el encuadre es correcto en cualquier pantalla y el gradiente sale solo.
const DEPTH_STRETCH = 1.9;
const FRAME_FILL    = 0.92;    // fracción del cuadro que puede ocupar la galaxia
const NEAR_MARGIN   = 7;      // nada se acerca más que esto a la cámara

const PITCH_0  = 0.42;
const YAW_0    = 0.55;
const FOG_DEPTH = 0.78;       // cuánto se lava hacia blanco lo lejano
const FOG_NEAR_K = 0.42;
const FOG_FAR_K  = 1.15;
const FOG_FAR_R  = 0.9;
const FAR_R      = 2.8;

const VIEW_AXIS = { x: Math.sin(YAW_0), z: Math.cos(YAW_0) };

const MIN_DIST   = 3.6;
const ORBIT_DIST = 11;

// ─── Texturas ──────────────────────────────────────────────────────────────────
const ATLAS_COLS = 11;        // 121 celdas: cubre el catálogo objetivo de ~120
const ATLAS_CELL = 186;
const ATLAS_SIZE = ATLAS_COLS * ATLAS_CELL;
const ATLAS_CAP  = ATLAS_COLS * ATLAS_COLS;
const HIRES_PX = ATLAS_CELL * 0.8;   // por encima de esto la celda del atlas se nota
const VIDEO_PX = 90;                 // tamaño mínimo para que valga la pena reproducir
const MIN_HIT_PX = 22;        // suelo de área de clic: una mota de 12px es inalcanzable

// ─── URLs ──────────────────────────────────────────────────────────────────────
const isHeic = (p) => /\.hei[cf]$/i.test(p || "");
const isWebglSafe = (p) => p && !isHeic(p) && !/\.avif$/i.test(p);
const toFieldUrl = (url) => (url || "").replace(".desktop.", ".mobile.");
const toWebp = (p) => (p || "").replace(/\.avif$/i, ".webp");

const pickWebglUrl = (img) => {
  const fromAvif = toWebp(img.src);
  const list = [fromAvif, img.src, img.fallback].filter(isWebglSafe);
  return list.find((s) => /\.webp$/i.test(s)) || list[0] || null;
};

// ─── Ruido determinista: la galaxia se compone igual en cada carga ─────────────
const TAU = Math.PI * 2;
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = (rnd) => {
  const u = Math.max(1e-6, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd());
};
const between = (rnd, [a, b]) => a + rnd() * (b - a);

// ─── Siluetas ──────────────────────────────────────────────────────────────────
// Todas volumétricas y del mismo radio característico: lo que cambia es el
// carácter (hueca, densa, alargada, plana, reticulada), no el tamaño. Cada una
// se mezcla con un enjambre neutro según SHAPE_VARIETY.
const swarm = (rnd, s) => [gauss(rnd) * s * 0.4, gauss(rnd) * s * 0.34, gauss(rnd) * s * 0.4];

const SHAPES = {
  // Enjambre gaussiano: el neutro.
  swarm: (i, n, rnd, s) => swarm(rnd, s),
  // Bola maciza: uniforme en volumen, se ve más densa que el enjambre.
  ball: (i, n, rnd, s) => {
    const r = s * 0.92 * Math.cbrt(rnd());
    const ct = 1 - 2 * rnd();
    const st = Math.sqrt(Math.max(0, 1 - ct * ct));
    const ph = rnd() * TAU;
    return [Math.cos(ph) * st * r, ct * r, Math.sin(ph) * st * r];
  },
  // Cáscara hueca: Fibonacci sobre la esfera, sin polos ni costuras.
  shell: (i, n, rnd, s) => {
    const k = i + 0.5;
    const phi = Math.acos(1 - (2 * k) / n);
    const th = Math.PI * (1 + Math.sqrt(5)) * k;
    const r = s * (0.88 + rnd() * 0.16);
    return [Math.cos(th) * Math.sin(phi) * r, Math.cos(phi) * r, Math.sin(th) * Math.sin(phi) * r];
  },
  // Huso: alargado en su eje propio.
  spindle: (i, n, rnd, s) => [
    gauss(rnd) * s * 0.22,
    gauss(rnd) * s * 0.22,
    gauss(rnd) * s * 0.78,
  ],
  // Lente: aplastada en su eje propio.
  disc: (i, n, rnd, s) => {
    const a = rnd() * TAU;
    const r = s * 0.95 * Math.sqrt(rnd());
    return [Math.cos(a) * r, gauss(rnd) * s * 0.12, Math.sin(a) * r];
  },
  // Anillo con grosor: toro.
  ring: (i, n, rnd, s) => {
    const a = (i / n) * TAU + rnd() * 0.3;
    const R0 = s * 0.82;
    const t = s * 0.2;
    return [
      Math.cos(a) * R0 + gauss(rnd) * t,
      gauss(rnd) * t,
      Math.sin(a) * R0 + gauss(rnd) * t,
    ];
  },
  // Retícula 3D: la única con orden visible.
  lattice: (i, n, rnd, s) => {
    const side = Math.max(2, Math.ceil(Math.cbrt(n)));
    const ix = i % side;
    const iy = Math.floor(i / side) % side;
    const iz = Math.floor(i / (side * side)) % side;
    const step = (v) => (v / (side - 1 || 1) - 0.5) * s * 1.7;
    return [step(ix) + gauss(rnd) * s * 0.05, step(iy) + gauss(rnd) * s * 0.05, step(iz) + gauss(rnd) * s * 0.05];
  },
  // Media cáscara: cúmulo abierto por un lado.
  arc: (i, n, rnd, s) => {
    const k = i + 0.5;
    const phi = Math.acos(1 - (1.05 * k) / n);
    const th = Math.PI * (1 + Math.sqrt(5)) * k;
    const r = s * (0.9 + rnd() * 0.14);
    return [Math.cos(th) * Math.sin(phi) * r, Math.cos(phi) * r * 0.9, Math.sin(th) * Math.sin(phi) * r];
  },
};

// ─── Shaders ───────────────────────────────────────────────────────────────────
// Color opaco (mezcla hacia blanco): basta el z-buffer, no hay que ordenar. Lo
// filtrado encoge a cero en vez de quedar fantasma, si no taparía en blanco.
const FILTER_GLSL = /* glsl */ `
  uniform float uActive;
  uniform float uFilterMix;

  float groupFactor(float g) {
    float on = abs(g - uActive) < 0.5 ? 1.0 : 0.0;
    return mix(1.0, on, uFilterMix);
  }
`;

const DEPTH_GLSL = /* glsl */ `
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFar;

  float depthFade(float d) {
    float fog = 1.0 - smoothstep(uFogNear, uFogFar, d) * ${FOG_DEPTH.toFixed(2)};
    float far = 1.0 - smoothstep(uFar * 0.84, uFar, d);
    return fog * far;
  }
`;

const CLOUD_VERT = /* glsl */ `
  attribute vec3  iOffset;
  attribute vec2  iSize;
  attribute vec2  iCell;
  attribute float iGroup;

  uniform float uCloud;

  varying vec2  vUv;
  varying vec2  vCell;
  varying float vAlpha;

  ${FILTER_GLSL}
  ${DEPTH_GLSL}

  void main() {
    float grp = groupFactor(iGroup);

    vec4 mvCenter = modelViewMatrix * vec4(iOffset, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * iSize * grp, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    vAlpha = depthFade(-mvCenter.z) * grp * uCloud;
    vUv    = uv;
    vCell  = iCell;
  }
`;

const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uCellScale;

  varying vec2  vUv;
  varying vec2  vCell;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.012) discard;
    vec2 uv = (vCell + vec2(vUv.x, 1.0 - vUv.y)) * uCellScale;
    vec4 texel = texture2D(uAtlas, uv);
    gl_FragColor = vec4(mix(vec3(1.0), texel.rgb, texel.a * vAlpha), 1.0);
  }
`;

const PIECE_VERT = /* glsl */ `
  uniform vec2  uSize;
  uniform float uGroup;
  uniform float uFocused;
  uniform float uOpacity;

  varying vec2  vUv;
  varying float vAlpha;

  ${FILTER_GLSL}
  ${DEPTH_GLSL}

  void main() {
    float grp = mix(groupFactor(uGroup), 1.0, uFocused);

    vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * uSize * grp, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    float env = mix(depthFade(-mvCenter.z), 1.0, uFocused);
    vAlpha = env * grp * uOpacity;
    vUv    = uv;
  }
`;

const PIECE_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uUseAtlas;
  uniform vec2  uCell;
  uniform float uCellScale;
  uniform float uFlipV;
  uniform float uExpandRange;

  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.006) discard;

    vec2 own  = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, uFlipV));
    vec2 cell = (uCell + vec2(vUv.x, 1.0 - vUv.y)) * uCellScale;
    vec2 uv   = mix(own, cell, uUseAtlas);

    vec4 texel = texture2D(uTex, uv);
    vec3 rgb = mix(
      texel.rgb,
      clamp((texel.rgb - 0.062745) / 0.858824, 0.0, 1.0),
      uExpandRange
    );
    float a = texel.a * vAlpha;
    gl_FragColor = vec4(mix(vec3(1.0), rgb, a), 1.0);
  }
`;

// ─── Reparto ───────────────────────────────────────────────────────────────────
function buildGroups(imageNames, videoNames) {
  const imgPool = new Set(imageNames);
  const groups = CONSTELLATIONS.map((c) => ({
    id: c.id,
    label: c.label,
    shape: SHAPES[c.shape] ? c.shape : "swarm",
    members: c.images.filter((n) => imgPool.has(n)).map((name) => ({ name, type: "image" })),
  }));
  if (!groups.length) return [];

  const claimed = new Set(groups.flatMap((g) => g.members.map((m) => m.name)));
  imageNames.filter((n) => !claimed.has(n)).forEach((name, i) => {
    groups[(groups.length - 1 + i) % groups.length].members.push({ name, type: "image" });
  });
  videoNames.forEach((name, i) => {
    groups[i % groups.length].members.push({ name, type: "video" });
  });

  // Relleno hasta TARGET_PIECES ciclando el catálogo, sin repetir dentro de un
  // mismo grupo. Es andamiaje: con 120 originales no entra aquí nunca.
  // El relleno usa solo imágenes: los vídeos son los que hay, no se multiplican.
  const catalog = imageNames.map((name) => ({ name, type: "image" }));
  if (catalog.length) {
    const taken = groups.map((g) => new Set(g.members.map((m) => m.name)));
    let total = groups.reduce((a, g) => a + g.members.length, 0);
    let cursor = 0;
    let guard = TARGET_PIECES * catalog.length;
    while (total < TARGET_PIECES && guard-- > 0) {
      const gi = groups.reduce((best, g, i) => (g.members.length < groups[best].members.length ? i : best), 0);
      const asset = catalog[cursor % catalog.length];
      cursor += 1;
      if (taken[gi].has(asset.name)) continue;
      taken[gi].add(asset.name);
      groups[gi].members.push({ ...asset, filler: true });
      total += 1;
    }
  }

  return groups.filter((g) => g.members.length);
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function NewSpace3dFocus_2({ damping = 0.085 } = {}) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const onFocusRef = useRef(null);

  const [lockedId, setLockedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [inFocus, setInFocus] = useState(false);
  onFocusRef.current = setInFocus;

  const { getImage, getVideo, isLoaded, imageIds, videoIds } = useOptimizedMedia();

  const groups = useMemo(() => {
    const imgs = imageIds?.length ? imageIds : SPACE_IMAGES;
    const vids = videoIds?.length ? videoIds : ALL_VIDEOS;
    return buildGroups(imgs, vids);
  }, [imageIds, videoIds]);

  const getImageRef = useRef(getImage);
  const getVideoRef = useRef(getVideo);
  getImageRef.current = getImage;
  getVideoRef.current = getVideo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded || !groups.length) return;

    const isMobile = window.innerWidth <= 768;
    const dprCap = isMobile ? 1 : 2;
    const POOL_SIZE = isMobile ? 6 : 14;
    const MAX_ACTIVE_VIDEOS = isMobile ? 1 : 3;

    // ── Media ────────────────────────────────────────────────────────────────
    const imageSrc = new Map();   // name → { field, hi, hiFb }
    const videoSrc = new Map();   // name → { sources, poster }
    for (const g of groups) {
      for (const m of g.members) {
        if (m.type === "video") {
          if (videoSrc.has(m.name)) continue;
          const v = getVideoRef.current(m.name);
          if (v?.sources?.length) videoSrc.set(m.name, { sources: v.sources, poster: v.poster || null });
          continue;
        }
        if (imageSrc.has(m.name)) continue;
        const img = getImageRef.current(m.name);
        const hi = pickWebglUrl(img);
        if (!hi) continue;
        const jpg = isWebglSafe(img.fallback) ? img.fallback : null;
        imageSrc.set(m.name, { field: toFieldUrl(hi), hi, hiFb: jpg && jpg !== hi ? jpg : null });
      }
    }

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      alpha: false,
      preserveDrawingBuffer: false,
      powerPreference: isMobile ? "default" : "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xffffff, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 300,
    );

    // Distancia mínima a la que la galaxia entera entra en cuadro respetando el
    // margen cercano. Búsqueda binaria sobre las posiciones reales: se adapta a
    // cualquier pantalla y a cualquier cambio de constantes, sin número mágico.
    const UP_AXIS = new THREE.Vector3(0, 1, 0);
    const fitPos = new THREE.Vector3();
    const fitFwd = new THREE.Vector3();
    const fitRight = new THREE.Vector3();
    const fitUp = new THREE.Vector3();
    const fitRel = new THREE.Vector3();

    const framesAll = (dist, yaw, pitch) => {
      const cp = Math.cos(pitch);
      fitPos.set(dist * cp * Math.sin(yaw), dist * Math.sin(pitch), dist * cp * Math.cos(yaw));
      fitFwd.copy(fitPos).multiplyScalar(-1).normalize();
      fitRight.crossVectors(fitFwd, UP_AXIS).normalize();
      fitUp.crossVectors(fitRight, fitFwd);
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const tanH = tanV * camera.aspect;
      for (const p of pieces) {
        fitRel.copy(p.pos).sub(fitPos);
        const d = fitRel.dot(fitFwd);
        if (d < NEAR_MARGIN) return false;
        if (Math.abs(fitRel.dot(fitRight)) > d * tanH * FRAME_FILL) return false;
        if (Math.abs(fitRel.dot(fitUp)) > d * tanV * FRAME_FILL) return false;
      }
      return true;
    };

    const fitGalaxyDist = (yaw = YAW_0, pitch = PITCH_0) => {
      let lo = NEAR_MARGIN;
      let hi = 160;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        if (framesAll(mid, yaw, pitch)) hi = mid; else lo = mid;
      }
      return hi;
    };

    // ── Atlas ────────────────────────────────────────────────────────────────
    // Un solo archivo para toda la galaxia: 121 celdas ≈ 21 MB de VRAM frente a
    // ~200 MB de texturas sueltas. La resolución completa llega por cercanía.
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = ATLAS_SIZE;
    atlasCanvas.height = ATLAS_SIZE;
    const atlasCtx = atlasCanvas.getContext("2d", { alpha: false });
    atlasCtx.fillStyle = "#ffffff";
    atlasCtx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    const atlasTex = new THREE.CanvasTexture(atlasCanvas);
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.flipY = false;              // la v se invierte en el shader
    atlasTex.premultiplyAlpha = false;
    atlasTex.generateMipmaps = true;
    atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTex.magFilter = THREE.LinearFilter;
    atlasTex.anisotropy = 1;

    const cellOf = new Map();
    const aspectOf = new Map();
    const aspectHooks = new Map();
    const atlasImgs = [];
    let atlasSlot = 0;
    let atlasDirty = false;
    let atlasStamp = 0;

    const takeCell = (name) => {
      if (cellOf.has(name)) return cellOf.get(name);
      if (atlasSlot >= ATLAS_CAP) return null;
      const cell = [atlasSlot % ATLAS_COLS, Math.floor(atlasSlot / ATLAS_COLS)];
      atlasSlot += 1;
      cellOf.set(name, cell);
      return cell;
    };

    const onAspect = (name, fn) => {
      if (aspectOf.has(name)) { fn(aspectOf.get(name)); return; }
      const list = aspectHooks.get(name) || [];
      list.push(fn);
      aspectHooks.set(name, list);
    };

    const loadIntoAtlas = (name, url) => {
      if (!url) return;
      const cell = takeCell(name);
      if (!cell) return;
      const img = new Image();
      img.decoding = "async";
      atlasImgs.push(img);
      img.onload = () => {
        // Estirada a la celda cuadrada; el quad la devuelve a su proporción.
        atlasCtx.drawImage(img, cell[0] * ATLAS_CELL, cell[1] * ATLAS_CELL, ATLAS_CELL, ATLAS_CELL);
        atlasDirty = true;
        const ar = THREE.MathUtils.clamp((img.naturalWidth || 1) / (img.naturalHeight || 1), 0.4, 2.6);
        aspectOf.set(name, ar);
        (aspectHooks.get(name) || []).forEach((fn) => fn(ar));
        aspectHooks.delete(name);
        img.onload = null;
        img.onerror = null;
      };
      img.onerror = () => { img.onload = null; img.onerror = null; };
      img.src = url;
    };

    for (const [name, src] of imageSrc) loadIntoAtlas(name, src.field);
    for (const [name, src] of videoSrc) loadIntoAtlas(name, toFieldUrl(src.poster));

    // ── Uniforms compartidos ─────────────────────────────────────────────────
    const shared = {
      uActive:    { value: -1 },
      uFilterMix: { value: 0 },
      uFogNear:   { value: 20 },
      uFogFar:    { value: 60 },
      uFar:       { value: 120 },
      uCellScale: { value: 1 / ATLAS_COLS },
    };
    const cloudMaster = { value: 1 };

    // ── Siembra ──────────────────────────────────────────────────────────────
    const centers = [];
    const pieces = [];
    const bx = new THREE.Vector3();
    const by = new THREE.Vector3();
    const bz = new THREE.Vector3();
    const upRef = new THREE.Vector3();

    groups.forEach((g, gi) => {
      const rnd = mulberry(1000 + gi * 37);

      // Centro sobre una esfera de Fibonacci, con radio variado para que unas
      // constelaciones queden al fondo y otras delante.
      const k = gi + 0.5;
      const phi = Math.acos(1 - (2 * k) / groups.length);
      const th = Math.PI * (1 + Math.sqrt(5)) * k;
      const rad = CORE_R * (0.45 + 0.55 * rnd());
      let cx = Math.cos(th) * Math.sin(phi) * rad;
      const cy = Math.cos(phi) * rad * GALAXY_FLAT;
      let cz = Math.sin(th) * Math.sin(phi) * rad;

      // Estirado a lo largo del eje de vista: profundidad sin ensanchar.
      const along = cx * VIEW_AXIS.x + cz * VIEW_AXIS.z;
      cx += along * VIEW_AXIS.x * (DEPTH_STRETCH - 1);
      cz += along * VIEW_AXIS.z * (DEPTH_STRETCH - 1);
      centers.push(new THREE.Vector3(cx, cy, cz));

      // Cada cúmulo con su propia inclinación: la silueta no se repite orientada
      // igual ocho veces.
      bz.set(gauss(rnd), gauss(rnd) * 0.7, gauss(rnd));
      if (bz.lengthSq() < 1e-4) bz.set(0, 0, 1);
      bz.normalize();
      upRef.set(Math.abs(bz.y) > 0.92 ? 1 : 0, Math.abs(bz.y) > 0.92 ? 0 : 1, 0);
      bx.crossVectors(upRef, bz).normalize();
      by.crossVectors(bz, bx);

      const shape = SHAPES[g.shape] || SHAPES.swarm;
      const n = g.members.length;
      const s = BLOB_R * (0.85 + 0.35 * Math.min(1, n / 16));

      g.members.forEach((m, i) => {
        const shaped = shape(i, n, rnd, s);
        const neutral = swarm(rnd, s);
        const lx = neutral[0] + (shaped[0] - neutral[0]) * SHAPE_VARIETY;
        const ly = neutral[1] + (shaped[1] - neutral[1]) * SHAPE_VARIETY;
        const lz = neutral[2] + (shaped[2] - neutral[2]) * SHAPE_VARIETY;
        const base = between(rnd, PIECE_SIZE);
        pieces.push({
          name: m.name,
          type: m.type,
          group: gi,
          pos: new THREE.Vector3(
            cx + bx.x * lx + by.x * ly + bz.x * lz,
            cy + bx.y * lx + by.y * ly + bz.y * lz,
            cz + bx.z * lx + by.z * ly + bz.z * lz,
          ),
          base,
          w: base,
          h: base,
          slot: null,
          video: null,
          videoTex: null,
          d: Infinity,
        });
      });
    });

    // Radio real de la galaxia una vez sembrada: lo usan la niebla, el corte
    // lejano y el límite del pivote, en vez de una constante que se desincroniza.
    let GALAXY_RADIUS = 1;
    for (const p of pieces) GALAXY_RADIUS = Math.max(GALAXY_RADIUS, p.pos.length());

    // ── Nube: una instanced mesh con todas las piezas ────────────────────────
    const plane = new THREE.PlaneGeometry(1, 1);
    const n = pieces.length;
    const offsets = new Float32Array(n * 3);
    const sizes = new Float32Array(n * 2);
    const cells = new Float32Array(n * 2);
    const gIdx = new Float32Array(n);

    pieces.forEach((p, i) => {
      p.index = i;
      offsets[i * 3] = p.pos.x;
      offsets[i * 3 + 1] = p.pos.y;
      offsets[i * 3 + 2] = p.pos.z;
      sizes[i * 2] = p.w;
      sizes[i * 2 + 1] = p.h;
      gIdx[i] = p.group;
    });

    const cloudGeo = new THREE.InstancedBufferGeometry();
    cloudGeo.index = plane.index;
    cloudGeo.setAttribute("position", plane.attributes.position);
    cloudGeo.setAttribute("uv", plane.attributes.uv);
    cloudGeo.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    const sizeAttr = new THREE.InstancedBufferAttribute(sizes, 2);
    cloudGeo.setAttribute("iSize", sizeAttr);
    const cellAttr = new THREE.InstancedBufferAttribute(cells, 2);
    cloudGeo.setAttribute("iCell", cellAttr);
    cloudGeo.setAttribute("iGroup", new THREE.InstancedBufferAttribute(gIdx, 1));
    cloudGeo.instanceCount = n;

    const cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uAtlas:     { value: atlasTex },
        uCloud:     cloudMaster,
        uActive:    shared.uActive,
        uFilterMix: shared.uFilterMix,
        uFogNear:   shared.uFogNear,
        uFogFar:    shared.uFogFar,
        uFar:       shared.uFar,
        uCellScale: shared.uCellScale,
      },
      toneMapped: true,
    });

    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.frustumCulled = false;
    scene.add(cloud);

    const writeInstance = (p) => {
      const hidden = p.slot !== null;
      sizes[p.index * 2] = hidden ? 0 : p.w;
      sizes[p.index * 2 + 1] = hidden ? 0 : p.h;
      sizeAttr.needsUpdate = true;
    };

    const applyCell = (p) => {
      const cell = cellOf.get(p.name);
      cells[p.index * 2] = cell ? cell[0] : 0;
      cells[p.index * 2 + 1] = cell ? cell[1] : 0;
      cellAttr.needsUpdate = true;
    };

    const byName = new Map();
    pieces.forEach((p) => {
      applyCell(p);
      const list = byName.get(p.name) || [];
      list.push(p);
      byName.set(p.name, list);
    });

    for (const [name, list] of byName) {
      onAspect(name, (ar) => {
        const s = Math.sqrt(ar);
        for (const p of list) {
          p.w = p.base * s;
          p.h = p.base / s;
          if (p.slot) p.slot.mat.uniforms.uSize.value.set(p.w, p.h);
          else writeInstance(p);
        }
      });
    }

    // ── Pool de piezas promocionadas ─────────────────────────────────────────
    // Lo que está cerca, en vídeo o en focus sale de la nube y pasa a su propia
    // mesh con textura completa. Acota la memoria y deja los draw calls en
    // 1 + lo promocionado.
    const whiteTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat,
    );
    whiteTex.needsUpdate = true;

    const loader = new THREE.TextureLoader();
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: PIECE_VERT,
        fragmentShader: PIECE_FRAG,
        uniforms: {
          uTex:         { value: whiteTex },
          uUseAtlas:    { value: 0 },
          uCell:        { value: new THREE.Vector2() },
          uSize:        { value: new THREE.Vector2(1, 1) },
          uOpacity:     { value: 1 },
          uGroup:       { value: 0 },
          uFocused:     { value: 0 },
          uFlipV:       { value: 0 },
          uExpandRange: { value: 0 },
          uActive:    shared.uActive,
          uFilterMix: shared.uFilterMix,
          uFogNear:   shared.uFogNear,
          uFogFar:    shared.uFogFar,
          uFar:       shared.uFar,
          uCellScale: shared.uCellScale,
        },
        toneMapped: true,
      });
      const mesh = new THREE.Mesh(plane, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      pool.push({ mesh, mat, piece: null, hiTex: null, token: 0 });
    }

    const focus = { piece: null, slot: null, locked: false, savedFilter: null };

    const bindHiRes = (slot, piece, tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 1;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.flipY = true;
      tex.premultiplyAlpha = false;
      slot.hiTex = tex;
      slot.mat.uniforms.uTex.value = tex;
      slot.mat.uniforms.uUseAtlas.value = 0;
      const im = tex.image;
      if (im?.width && im?.height) {
        const ar = THREE.MathUtils.clamp(im.width / im.height, 0.4, 2.6);
        const s = Math.sqrt(ar);
        piece.w = piece.base * s;
        piece.h = piece.base / s;
        slot.mat.uniforms.uSize.value.set(piece.w, piece.h);
      }
    };

    const startVideo = (slot, piece) => {
      if (!piece.video) {
        const src = videoSrc.get(piece.name)?.sources?.[0]?.src;
        const vid = document.createElement("video");
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = "auto";
        vid.crossOrigin = "anonymous";
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
          if (!vid.videoWidth || !vid.videoHeight) return;
          const ar = THREE.MathUtils.clamp(vid.videoWidth / vid.videoHeight, 0.4, 2.6);
          const s = Math.sqrt(ar);
          piece.w = piece.base * s;
          piece.h = piece.base / s;
          if (piece.slot) piece.slot.mat.uniforms.uSize.value.set(piece.w, piece.h);
          else writeInstance(piece);
          if (focus.piece === piece) placeFocus(piece, fitDistFor(piece));
        });

        piece.video = vid;
        piece.videoTex = vtex;
      }
      slot.mat.uniforms.uTex.value = piece.videoTex;
      slot.mat.uniforms.uUseAtlas.value = 0;
      slot.mat.uniforms.uFlipV.value = 1;
      slot.mat.uniforms.uExpandRange.value = 1;
      piece.video.play().catch(() => {});
    };

    const promote = (slot, piece) => {
      slot.piece = piece;
      piece.slot = slot;
      slot.token += 1;
      const token = slot.token;

      slot.mesh.position.copy(piece.pos);
      slot.mesh.visible = true;
      const cell = cellOf.get(piece.name);
      slot.mat.uniforms.uCell.value.set(cell ? cell[0] : 0, cell ? cell[1] : 0);
      slot.mat.uniforms.uTex.value = cell ? atlasTex : whiteTex;
      slot.mat.uniforms.uUseAtlas.value = cell ? 1 : 0;
      slot.mat.uniforms.uSize.value.set(piece.w, piece.h);
      slot.mat.uniforms.uGroup.value = piece.group;
      slot.mat.uniforms.uOpacity.value = focus.piece && focus.piece !== piece ? 0 : 1;
      slot.mat.uniforms.uFocused.value = 0;
      slot.mat.uniforms.uFlipV.value = 0;
      slot.mat.uniforms.uExpandRange.value = 0;
      writeInstance(piece);

      if (piece.type === "video") {
        startVideo(slot, piece);
        return;
      }
      const src = imageSrc.get(piece.name);
      if (!src) return;
      loader.load(
        src.hi,
        (tex) => { if (slot.token === token && slot.piece === piece) bindHiRes(slot, piece, tex); else tex.dispose(); },
        undefined,
        () => {
          if (!src.hiFb) return;
          loader.load(src.hiFb, (tex) => {
            if (slot.token === token && slot.piece === piece) bindHiRes(slot, piece, tex); else tex.dispose();
          });
        },
      );
    };

    const release = (slot) => {
      const piece = slot.piece;
      if (!piece || focus.piece === piece) return;
      slot.token += 1;
      slot.piece = null;
      piece.slot = null;
      slot.mesh.visible = false;
      slot.hiTex?.dispose();
      slot.hiTex = null;
      slot.mat.uniforms.uTex.value = whiteTex;
      slot.mat.uniforms.uUseAtlas.value = 0;
      slot.mat.uniforms.uFlipV.value = 0;
      slot.mat.uniforms.uExpandRange.value = 0;
      slot.mat.uniforms.uOpacity.value = 1;
      if (piece.type === "video") piece.video?.pause();
      writeInstance(piece);
    };

    const visibleGroup = (g) =>
      shared.uFilterMix.value < 0.5 || Math.abs(g - shared.uActive.value) < 0.5;

    const updatePool = () => {
      if (focus.piece) return;
      const camPos = camera.position;
      const focal = (renderer.domElement.clientHeight / 2) / Math.tan((camera.fov * Math.PI) / 360);
      for (const p of pieces) {
        p.d = camPos.distanceTo(p.pos);
        p.px = (focal * Math.max(p.w, p.h)) / Math.max(0.001, p.d);
      }

      const wanted = new Set();
      const images = pieces
        .filter((p) => p.type === "image" && p.px > HIRES_PX && visibleGroup(p.group))
        .sort((a, b) => b.px - a.px);
      const videos = pieces
        .filter((p) => p.type === "video" && p.px > VIDEO_PX && visibleGroup(p.group))
        .sort((a, b) => b.px - a.px)
        .slice(0, MAX_ACTIVE_VIDEOS);

      videos.forEach((p) => wanted.add(p));
      for (const p of images) {
        if (wanted.size >= POOL_SIZE) break;
        wanted.add(p);
      }

      for (const slot of pool) {
        if (slot.piece && !wanted.has(slot.piece)) release(slot);
      }
      for (const p of wanted) {
        if (p.slot) continue;
        const free = pool.find((s) => !s.piece);
        if (!free) break;
        promote(free, p);
      }
    };

    // ── Cámara ───────────────────────────────────────────────────────────────
    const PITCH_LIMIT = Math.PI / 2 - 0.05;
    const startDist = fitGalaxyDist();

    const state = {
      yaw: YAW_0, pitch: PITCH_0, dist: startDist,
      targetYaw: YAW_0, targetPitch: PITCH_0, targetDist: startDist,
      pivot: new THREE.Vector3(),
      targetPivot: new THREE.Vector3(),
      maxDist: startDist * 1.25,
    };
    const nav = { animating: false };
    const tmpV = new THREE.Vector3();

    const forwardOf = (out, yaw, pitch) => {
      const cp = Math.cos(pitch);
      return out.set(-cp * Math.sin(yaw), -Math.sin(pitch), -cp * Math.cos(yaw)).normalize();
    };

    const applyCamera = () => {
      const cp = Math.cos(state.pitch);
      camera.position.set(
        state.pivot.x + state.dist * cp * Math.sin(state.yaw),
        state.pivot.y + state.dist * Math.sin(state.pitch),
        state.pivot.z + state.dist * cp * Math.cos(state.yaw),
      );
      camera.lookAt(state.pivot);
    };
    applyCamera();

    const clampPivot = () => {
      const len = state.targetPivot.length();
      const max = GALAXY_RADIUS * 1.05;
      if (len > max) state.targetPivot.multiplyScalar(max / len);
    };

    // Al llegar al mínimo el zoom deja de acercar y vuela hacia delante: así se
    // atraviesa la galaxia en vez de chocar con ella.
    const zoomBy = (delta) => {
      if (focus.piece || nav.animating) return;
      const next = state.targetDist + delta;
      if (next < MIN_DIST) {
        forwardOf(tmpV, state.targetYaw, state.targetPitch);
        state.targetPivot.addScaledVector(tmpV, MIN_DIST - next);
        clampPivot();
        state.targetDist = MIN_DIST;
      } else if (next > state.maxDist) {
        const excess = next - state.maxDist;
        const len = state.targetPivot.length();
        if (len > 0.001) state.targetPivot.multiplyScalar(Math.max(0, (len - excess) / len));
        state.targetDist = state.maxDist;
      } else {
        state.targetDist = next;
      }
    };

    const flyTo = (pivot, dist, dur = 1.15) => {
      gsap.killTweensOf(state);
      gsap.killTweensOf(state.pivot);
      gsap.killTweensOf(state.targetPivot);
      nav.animating = true;
      gsap.to([state.pivot, state.targetPivot], {
        x: pivot.x, y: pivot.y, z: pivot.z,
        duration: dur, ease: "power3.inOut", overwrite: "auto",
      });
      gsap.to(state, {
        dist, targetDist: dist,
        duration: dur, ease: "power3.inOut", overwrite: "auto",
        onComplete: () => { nav.animating = false; },
      });
    };

    // ── Filtro por constelación ──────────────────────────────────────────────
    let filterTween = null;
    const setFilter = (groupIndex) => {
      filterTween?.kill();
      if (groupIndex == null) {
        filterTween = gsap.to(shared.uFilterMix, {
          value: 0, duration: 0.42, ease: "power2.out",
          onComplete: () => { shared.uActive.value = -1; },
        });
        return;
      }
      shared.uActive.value = groupIndex;
      filterTween = gsap.to(shared.uFilterMix, { value: 1, duration: 0.42, ease: "power2.out" });
    };

    // ── Focus ────────────────────────────────────────────────────────────────
    const CLICK_PX = 8;

    const fitDistFor = (piece) => {
      const vFov = (camera.fov * Math.PI) / 180;
      const margin = 0.68;
      const distH = piece.h / (2 * Math.tan(vFov / 2) * margin);
      const distW = piece.w / (2 * Math.tan(vFov / 2) * camera.aspect * margin);
      return Math.max(distH, distW, 1.6);
    };

    // El destino es "delante de la cámara", no el origen: la pieza sale de su
    // órbita y aterriza centrada estés donde estés dentro de la galaxia.
    const placeFocus = (piece, dist) => {
      if (!piece.slot) return;
      const p = forwardOf(new THREE.Vector3(), state.yaw, state.pitch)
        .multiplyScalar(dist)
        .add(camera.position);
      gsap.to(piece.slot.mesh.position, {
        x: p.x, y: p.y, z: p.z,
        duration: 1.05, ease: "power3.inOut", overwrite: "auto",
      });
    };

    const enterFocus = (piece) => {
      if (focus.piece || !piece) return;

      let slot = piece.slot;
      if (!slot) {
        slot = pool.find((s) => !s.piece) || pool.find((s) => s.piece !== focus.piece);
        if (slot.piece) release(slot);
        promote(slot, piece);
      }

      focus.piece = piece;
      focus.slot = slot;
      focus.locked = true;
      focus.savedFilter = { active: shared.uActive.value, mix: shared.uFilterMix.value };

      gsap.killTweensOf(state);
      gsap.killTweensOf(slot.mesh.position);
      filterTween?.kill();
      pool.forEach((s) => gsap.killTweensOf(s.mat.uniforms.uOpacity));

      slot.mat.uniforms.uFocused.value = 1;
      for (const s of pool) {
        if (s === slot) continue;
        gsap.to(s.mat.uniforms.uOpacity, { value: 0, duration: 0.5, ease: "power2.out" });
      }
      gsap.to(cloudMaster, { value: 0, duration: 0.45, ease: "power2.out" });

      placeFocus(piece, fitDistFor(piece));
      canvas.style.cursor = "default";
      onFocusRef.current?.(true);
    };

    const exitFocus = () => {
      const piece = focus.piece;
      const slot = focus.slot;
      if (!piece || !slot) return;

      gsap.killTweensOf(slot.mesh.position);
      pool.forEach((s) => gsap.killTweensOf(s.mat.uniforms.uOpacity));

      gsap.to(slot.mesh.position, {
        x: piece.pos.x, y: piece.pos.y, z: piece.pos.z,
        duration: 1.2, ease: "power3.inOut",
        onComplete: () => {
          slot.mat.uniforms.uFocused.value = 0;
          focus.piece = null;
          focus.slot = null;
          focus.locked = false;
        },
      });
      for (const s of pool) {
        if (s === slot) continue;
        gsap.to(s.mat.uniforms.uOpacity, { value: 1, duration: 0.9, delay: 0.35, ease: "power2.out" });
      }
      gsap.to(cloudMaster, { value: 1, duration: 0.8, delay: 0.3, ease: "power2.out" });

      if (focus.savedFilter) {
        shared.uActive.value = focus.savedFilter.active;
        gsap.to(shared.uFilterMix, {
          value: focus.savedFilter.mix, duration: 0.5, delay: 0.3, ease: "power2.out",
        });
        focus.savedFilter = null;
      }
      onFocusRef.current?.(false);
    };

    // ── Hit test ─────────────────────────────────────────────────────────────
    // Dos pasadas: primero por el rectángulo real, y si no hay nada, con un
    // área mínima para que las piezas lejanas también sean alcanzables.
    let canvasRect = canvas.getBoundingClientRect();
    const refreshRect = () => { canvasRect = canvas.getBoundingClientRect(); };
    const ndc = new THREE.Vector3();

    const hitTest = (clientX, clientY) => {
      const mx = clientX - canvasRect.left;
      const my = clientY - canvasRect.top;
      const w = canvasRect.width;
      const h = canvasRect.height;
      const vFov = (camera.fov * Math.PI) / 180;
      const tanHalf = Math.tan(vFov / 2);
      let exact = null;
      let exactD = Infinity;
      let loose = null;
      let looseScore = Infinity;

      for (const piece of pieces) {
        if (!visibleGroup(piece.group)) continue;
        ndc.copy(piece.pos).project(camera);
        if (ndc.z < -1 || ndc.z > 1) continue;
        const dist = camera.position.distanceTo(piece.pos);
        if (dist > shared.uFar.value * 0.92) continue;

        const sx = (ndc.x * 0.5 + 0.5) * w;
        const sy = (-ndc.y * 0.5 + 0.5) * h;
        const worldPerPx = (2 * dist * tanHalf) / h;
        const hw = (piece.w / worldPerPx) * 0.5;
        const hh = (piece.h / worldPerPx) * 0.5;
        const dx = Math.abs(mx - sx);
        const dy = Math.abs(my - sy);

        if (dx <= hw && dy <= hh) {
          if (dist < exactD) { exactD = dist; exact = piece; }
        } else if (dx <= Math.max(hw, MIN_HIT_PX / 2) && dy <= Math.max(hh, MIN_HIT_PX / 2)) {
          const score = dx * dx + dy * dy;
          if (score < looseScore) { looseScore = score; loose = piece; }
        }
      }
      return exact || loose;
    };

    // ── Interacción ──────────────────────────────────────────────────────────
    const drag = { active: false, x: 0, y: 0, sx: 0, sy: 0, moved: false };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      refreshRect();
      drag.active = true;
      drag.moved = false;
      drag.x = drag.sx = e.clientX;
      drag.y = drag.sy = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      if (!focus.piece) canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e) => {
      if (!drag.active) {
        if (!focus.piece) {
          canvas.style.cursor = hitTest(e.clientX, e.clientY) ? "pointer" : "grab";
        }
        return;
      }
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > CLICK_PX) drag.moved = true;
      if (focus.piece || nav.animating) return;
      const k = 0.005;
      state.targetYaw -= dx * k;
      state.targetPitch += dy * k;
      state.targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.targetPitch));
    };

    const onPointerUp = (e) => {
      const wasClick = drag.active && !drag.moved;
      drag.active = false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* ok */ }
      if (wasClick) {
        if (focus.piece) exitFocus();
        else {
          const hit = hitTest(e.clientX, e.clientY);
          if (hit) enterFocus(hit);
        }
      }
      if (!focus.piece) canvas.style.cursor = "grab";
    };

    const onWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(dy * 0.018);
    };

    let pinchStart = 0;
    let pinchDist = 0;
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStart = Math.hypot(dx, dy);
        pinchDist = state.targetDist;
        drag.active = false;
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchStart > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.hypot(dx, dy);
        const next = pinchDist - (d / pinchStart - 1) * Math.max(10, Math.abs(pinchDist));
        zoomBy(next - state.targetDist);
        pinchDist = state.targetDist;
        pinchStart = d;
      }
    };
    const onTouchEnd = () => { pinchStart = 0; };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, w <= 768 ? 1 : 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      refreshRect();
      state.maxDist = Math.max(state.maxDist, fitGalaxyDist(state.yaw, state.pitch) * 1.25);
      if (focus.piece) placeFocus(focus.piece, fitDistFor(focus.piece));
    };
    window.addEventListener("resize", onResize);

    const onKeyDown = (e) => {
      if (e.key === "Escape" && focus.piece) exitFocus();
    };
    window.addEventListener("keydown", onKeyDown);

    // Solo pausa vídeos: el loop mira `document.hidden` en cada frame en vez de
    // cachearlo, porque si la visibilidad cambia antes de que exista el listener
    // un flag cacheado deja la escena congelada para siempre.
    const onVisibility = () => {
      if (document.hidden) pieces.forEach((p) => p.video?.pause());
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── API para las pills ───────────────────────────────────────────────────
    apiRef.current = {
      setHover(id) {
        if (focus.piece) return;
        const gi = groups.findIndex((g) => g.id === id);
        if (id != null && gi === -1) return;
        setFilter(id == null ? null : gi);
      },
      lock(id) {
        const gi = groups.findIndex((g) => g.id === id);
        if (gi === -1) return;
        if (focus.piece) exitFocus();
        setFilter(gi);
        flyTo(centers[gi], ORBIT_DIST);
      },
      reset() {
        if (focus.piece) exitFocus();
        setFilter(null);
        flyTo(new THREE.Vector3(), fitGalaxyDist(state.yaw, state.pitch));
      },
    };

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    let frame = 0;
    let readyDispatched = false;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;

      if (!focus.locked && !nav.animating) {
        state.yaw += (state.targetYaw - state.yaw) * damping;
        state.pitch += (state.targetPitch - state.pitch) * damping;
        state.dist += (state.targetDist - state.dist) * damping;
        state.pivot.lerp(state.targetPivot, damping);
      }
      applyCamera();

      const ref = Math.max(state.dist, 6);
      shared.uFogNear.value = ref * FOG_NEAR_K;
      shared.uFogFar.value  = ref * FOG_FAR_K + GALAXY_RADIUS * FOG_FAR_R;
      shared.uFar.value     = ref + GALAXY_RADIUS * FAR_R;

      if (atlasDirty && performance.now() - atlasStamp > 150) {
        atlasTex.needsUpdate = true;
        atlasDirty = false;
        atlasStamp = performance.now();
      }

      if (frame % 12 === 0) updatePool();
      for (const p of pieces) {
        if (p.slot && p.videoTex && p.video && !p.video.paused) p.videoTex.needsUpdate = true;
      }
      frame += 1;

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
      apiRef.current = null;
      onFocusRef.current?.(false);
      filterTween?.kill();
      gsap.killTweensOf(state);
      gsap.killTweensOf(state.pivot);
      gsap.killTweensOf(state.targetPivot);
      gsap.killTweensOf(shared.uFilterMix);
      gsap.killTweensOf(cloudMaster);
      pool.forEach((s) => {
        gsap.killTweensOf(s.mat.uniforms.uOpacity);
        gsap.killTweensOf(s.mesh.position);
      });

      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);

      atlasImgs.forEach((img) => { img.onload = null; img.onerror = null; img.src = ""; });
      pool.forEach((s) => { s.hiTex?.dispose(); s.mat.dispose(); });
      pieces.forEach((p) => {
        if (p.videoTex) p.videoTex.dispose();
        if (p.video) {
          p.video.pause();
          p.video.removeAttribute("src");
          p.video.load?.();
          p.video.remove();
        }
      });
      cloudGeo.dispose();
      cloudMat.dispose();
      plane.dispose();
      atlasTex.dispose();
      whiteTex.dispose();
      renderer.dispose();
    };
  }, [isLoaded, groups, damping]);

  // ── Pills ──────────────────────────────────────────────────────────────────
  const handleEnter = useCallback((id) => {
    if (lockedId) return;
    setHoverId(id);
    apiRef.current?.setHover(id);
  }, [lockedId]);

  const handleLeave = useCallback(() => {
    if (lockedId) return;
    setHoverId(null);
    apiRef.current?.setHover(null);
  }, [lockedId]);

  const handleClick = useCallback((id) => {
    if (lockedId === id) {
      setLockedId(null);
      setHoverId(null);
      apiRef.current?.reset();
      return;
    }
    setLockedId(id);
    setHoverId(id);
    apiRef.current?.lock(id);
  }, [lockedId]);

  const handleAll = useCallback(() => {
    setLockedId(null);
    setHoverId(null);
    apiRef.current?.reset();
  }, []);

  const marked = lockedId ?? hoverId;

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

      <div className="cst" data-dimmed={inFocus ? "true" : "false"}>
        <div className="cst-bar" role="group" aria-label="Constelaciones">
          <button
            type="button"
            className={`cst-pill${lockedId === null ? " is-active" : ""}`}
            onMouseEnter={handleLeave}
            onClick={handleAll}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={lockedId === g.id}
              className={`cst-pill${marked === g.id ? " is-active" : ""}`}
              onMouseEnter={() => handleEnter(g.id)}
              onMouseLeave={handleLeave}
              onFocus={() => handleEnter(g.id)}
              onBlur={handleLeave}
              onClick={() => handleClick(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .cst {
          position: fixed;
          top: calc(16px + 1.5em + 4px);
          left: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          z-index: 9998;
          pointer-events: none;
          font-size: 0.875rem;
          letter-spacing: -0.04em;
          color: #111;
          transition: opacity 240ms ease;
        }
        .cst[data-dimmed="true"] { opacity: 0; }

        .cst-bar {
          display: flex;
          align-items: stretch;
          gap: 2px;
          max-width: min(94vw, 1040px);
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          pointer-events: auto;
        }
        .cst-bar::-webkit-scrollbar { display: none; }

        .cst-pill {
          flex: 0 0 auto;
          height: 1.5em;
          display: flex;
          align-items: center;
          padding: 0 0.7em;
          border: 0;
          border-radius: 0;
          background: rgba(17, 17, 17, 0.06);
          color: inherit;
          font: inherit;
          letter-spacing: inherit;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          opacity: 0.55;
          transition: opacity 180ms ease;
        }
        .cst-pill:first-child { border-radius: 999px 0 0 999px; }
        .cst-pill:last-child  { border-radius: 0 999px 999px 0; }
        .cst-pill:hover,
        .cst-pill:focus-visible { opacity: 1; outline: none; }
        .cst-pill.is-active { opacity: 1; }

        @media (prefers-reduced-motion: reduce) {
          .cst, .cst-pill { transition: none; }
        }
      `}</style>
    </div>
  );
}
