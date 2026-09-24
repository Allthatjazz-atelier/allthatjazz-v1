"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { onThemeChange, readThemeColor } from "@/hooks/useTheme";
import { buildPieces, GALLERIES } from "@/data/pieces";

// ─── Contenido ─────────────────────────────────────────────────────────────────
// Las piezas y su orden vienen de `@/data/pieces`, la misma lista que recorre el
// slider. Sin polvo: cada sprite es una pieza real, clicable y enfocable, y su
// posición en la lista es su identidad — que es lo que permitirá el morph entre
// vistas. La silueta de cada cúmulo sale del `shape` de su galería.

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

// ─── Movimiento ────────────────────────────────────────────────────────────────
// Respiración: cada pieza deriva por tres senos desfasados con su semilla. Se
// calcula igual en el shader de la nube y en el de las piezas promocionadas
// (si no, una pieza saltaría al promocionarse) y el hit-test lo replica en JS.
const BREATH_AMP = 0.24;
const BREATH_SPEED = [0.21, 0.17, 0.13];

// Cursor magnético: el campo se aparta alrededor del puntero y la pieza
// apuntada se queda quieta y crece un poco. Además de gesto, resuelve el
// problema de selección: separa la pieza de las que la tapan.
const CURSOR_RADIUS = 3.6;
const CURSOR_PUSH = 0.62;
const HOVER_GROW = 0.16;

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

const MOTION_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3  uCursorPoint;
  uniform float uCursorPush;
  uniform float uCursorRadius;

  // Devuelve el desplazamiento de una pieza: respiración + empuje del cursor.
  vec3 motionOf(vec3 wpos, float seed, float isHover) {
    vec3 breath = vec3(
      sin(uTime * ${BREATH_SPEED[0].toFixed(3)} + seed * 6.2831),
      sin(uTime * ${BREATH_SPEED[1].toFixed(3)} + seed * 11.0),
      sin(uTime * ${BREATH_SPEED[2].toFixed(3)} + seed * 17.0)
    ) * ${BREATH_AMP.toFixed(3)};

    vec3 away = wpos - uCursorPoint;
    float d = length(away);
    float k = smoothstep(uCursorRadius, uCursorRadius * 0.15, d) * uCursorPush * (1.0 - isHover);
    return breath + away / max(d, 0.001) * k;
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
  attribute float iSeed;
  attribute float iIndex;
  attribute vec3  iFrom;      // posición de partida del morph (mundo)
  attribute vec2  iFromSize;  // tamaño de partida; 0 = la pieza nace de la nada
  attribute float iDelay;     // escalona la entrada

  uniform float uCloud;
  uniform float uHoverIndex;
  uniform float uMorph;       // 0 = en los rectángulos del slider · 1 = en la galaxia

  varying vec2  vUv;
  varying vec2  vCell;
  varying float vAlpha;

  ${FILTER_GLSL}
  ${DEPTH_GLSL}
  ${MOTION_GLSL}

  void main() {
    float grp = groupFactor(iGroup);
    float isHover = abs(iIndex - uHoverIndex) < 0.5 ? 1.0 : 0.0;
    float grow = 1.0 + ${HOVER_GROW.toFixed(3)} * isHover;

    // Cada pieza recorre su tramo del morph con su propio retardo, así la nube
    // florece en vez de moverse en bloque.
    float m = clamp((uMorph - iDelay) / max(0.0001, 1.0 - iDelay), 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 basePos  = mix(iFrom, iOffset, m);
    vec2 baseSize = mix(iFromSize, iSize, m);

    // El movimiento propio (respiración e imán) entra con el morph: durante la
    // transición las piezas no deben temblar.
    vec4 mvCenter = modelViewMatrix * vec4(basePos + motionOf(basePos, iSeed, isHover) * m, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * baseSize * grp * grow, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    vAlpha = depthFade(-mvCenter.z) * grp * uCloud;
    vUv    = uv;
    vCell  = iCell;
  }
`;

const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uCellScale;
  uniform vec3  uBg;

  varying vec2  vUv;
  varying vec2  vCell;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.012) discard;
    vec2 uv = (vCell + vec2(vUv.x, 1.0 - vUv.y)) * uCellScale;
    vec4 texel = texture2D(uAtlas, uv);
    gl_FragColor = vec4(mix(uBg, texel.rgb, texel.a * vAlpha), 1.0);
  }
`;

const PIECE_VERT = /* glsl */ `
  uniform vec2  uSize;
  uniform float uGroup;
  uniform float uFocused;
  uniform float uOpacity;
  uniform float uSeed;
  uniform float uIsHover;
  uniform vec3  uFrom;       // de dónde viene en el morph
  uniform vec2  uFromSize;
  uniform float uMorph;
  uniform float uDelay;      // mismo escalonado que su instancia en la nube

  varying vec2  vUv;
  varying float vAlpha;

  ${FILTER_GLSL}
  ${DEPTH_GLSL}
  ${MOTION_GLSL}

  void main() {
    float grp = mix(groupFactor(uGroup), 1.0, uFocused);
    float grow = 1.0 + ${HOVER_GROW.toFixed(3)} * uIsHover * (1.0 - uFocused);

    // Las piezas que viajan en el morph se promocionan a mesh propia para que
    // se vean a resolución completa, así que este shader interpola igual que el
    // de la nube. Fuera del morph uMorph vale 1 y todo esto es la identidad.
    float m = clamp((uMorph - uDelay) / max(0.0001, 1.0 - uDelay), 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 target = modelMatrix[3].xyz;
    vec3 basePos = mix(uFrom, target, m);
    vec3 disp = motionOf(target, uSeed, uIsHover) * (1.0 - uFocused) * m;
    vec2 baseSize = mix(uFromSize, uSize, m);
    vec4 mvCenter = viewMatrix * vec4(basePos + disp, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * baseSize * grp * grow, 0.0, 0.0);
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
  uniform vec3  uBg;

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
    gl_FragColor = vec4(mix(uBg, rgb, a), 1.0);
  }
`;

// ─── Reparto ───────────────────────────────────────────────────────────────────
// Agrupa la lista canónica por galería SIN reordenarla: las galerías ya vienen
// seguidas, así que al aplanar los grupos se recupera exactamente el mismo orden.
// De ahí que el índice de instancia coincida con el índice canónico, que es lo
// que hará que la pieza 47 sea la pieza 47 también en el slider.
function groupPieces(pieces) {
  const byId = new Map();
  for (const p of pieces) {
    let g = byId.get(p.gallery);
    if (!g) {
      const meta = GALLERIES.find((x) => x.id === p.gallery);
      g = {
        id: p.gallery,
        label: p.galleryLabel,
        shape: SHAPES[meta?.shape] ? meta.shape : "swarm",
        members: [],
      };
      byId.set(p.gallery, g);
    }
    g.members.push(p);
  }
  return [...byId.values()];
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function NewSpace3dFocus_2({ damping = 0.085, active = true, viewRef } = {}) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const onFocusRef = useRef(null);

  const [lockedId, setLockedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [inFocus, setInFocus] = useState(false);
  const [vvBox, setVvBox] = useState(null);

  useEffect(() => {
    const sync = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setVvBox((prev) => {
        if (prev && prev.top === vv.offsetTop && prev.height === vv.height) return prev;
        return { top: vv.offsetTop, height: vv.height };
      });
    };
    sync();
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  onFocusRef.current = setInFocus;

  const { getImage, getVideo, isLoaded, imageIds, videoIds } = useOptimizedMedia();

  const groups = useMemo(
    () => groupPieces(buildPieces(imageIds, videoIds)),
    [imageIds, videoIds],
  );

  const getImageRef = useRef(getImage);
  const getVideoRef = useRef(getVideo);
  getImageRef.current = getImage;
  getVideoRef.current = getVideo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded || !groups.length) return;

    const isMobile = window.innerWidth <= 768;
    // El DPR no se capa por ancho de ventana: con la regla anterior, cualquier
    // ventana estrecha en una pantalla Retina renderizaba a la mitad de
    // resolución y la galaxia se veía blanda al lado del DOM. Lo que justifica
    // bajar el DPR es un dispositivo táctil de gama media, no una ventana
    // pequeña, así que se decide por puntero.
    const coarsePointer = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ?? false;
    const dprCap = coarsePointer ? 1.5 : 2;
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
          if (v?.sources?.length) {
            videoSrc.set(m.name, {
              sources: v.sources,
              poster: v.poster || null,
              thumb: v.thumbSrc || null,
            });
          }
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
    // El fondo es el mismo token que pinta el DOM: las piezas se funden contra
    // él por profundidad, así que la galaxia y la página comparten un solo valor.
    const bgColor = new THREE.Color(readThemeColor("--atj-bg"));

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
    renderer.setClearColor(bgColor, 1);

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
    // Solo se ve en el padding entre celdas y en el sangrado de los mipmaps: el
    // atlas no se repinta al cambiar de tema porque resubir 21 MB daría tirón.
    atlasCtx.fillStyle = readThemeColor("--atj-bg");
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
      uTime:         { value: 0 },
      uCursorPoint:  { value: new THREE.Vector3(0, 0, 0) },
      uCursorPush:   { value: 0 },
      uCursorRadius: { value: CURSOR_RADIUS },
      uBg:           { value: bgColor },
    };
    const cloudMaster = { value: 1 };
    const morph = { value: 1 };   // 1 = la galaxia en su sitio

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
          // Posición en la lista canónica: es la identidad compartida con el
          // slider. `index` (más abajo) es la posición de instancia, que puede
          // diferir si alguna pieza no resuelve su URL.
          canonical: m.index,
          group: gi,
          pos: new THREE.Vector3(
            cx + bx.x * lx + by.x * ly + bz.x * lz,
            cy + bx.y * lx + by.y * ly + bz.y * lz,
            cz + bx.z * lx + by.z * ly + bz.z * lz,
          ),
          base,
          seed: rnd(),
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
    const seeds = new Float32Array(n);
    const idx = new Float32Array(n);
    const froms = new Float32Array(n * 3);
    const fromSizes = new Float32Array(n * 2);
    const delays = new Float32Array(n);

    pieces.forEach((p, i) => {
      p.index = i;
      offsets[i * 3] = p.pos.x;
      offsets[i * 3 + 1] = p.pos.y;
      offsets[i * 3 + 2] = p.pos.z;
      sizes[i * 2] = p.w;
      sizes[i * 2 + 1] = p.h;
      gIdx[i] = p.group;
      seeds[i] = p.seed;
      idx[i] = i;
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
    cloudGeo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    cloudGeo.setAttribute("iIndex", new THREE.InstancedBufferAttribute(idx, 1));
    const fromAttr = new THREE.InstancedBufferAttribute(froms, 3);
    const fromSizeAttr = new THREE.InstancedBufferAttribute(fromSizes, 2);
    const delayAttr = new THREE.InstancedBufferAttribute(delays, 1);
    cloudGeo.setAttribute("iFrom", fromAttr);
    cloudGeo.setAttribute("iFromSize", fromSizeAttr);
    cloudGeo.setAttribute("iDelay", delayAttr);
    cloudGeo.instanceCount = n;

    const cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uAtlas:      { value: atlasTex },
        uCloud:      cloudMaster,
        uHoverIndex: { value: -1 },
        uMorph:      morph,
        uActive:       shared.uActive,
        uFilterMix:    shared.uFilterMix,
        uFogNear:      shared.uFogNear,
        uFogFar:       shared.uFogFar,
        uFar:          shared.uFar,
        uCellScale:    shared.uCellScale,
        uTime:         shared.uTime,
        uCursorPoint:  shared.uCursorPoint,
        uCursorPush:   shared.uCursorPush,
        uCursorRadius: shared.uCursorRadius,
        uBg:           shared.uBg,
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
    // Relleno mientras la textura real no ha llegado. Va del color de fondo, así
    // que la pieza aún no cargada no parpadea: simplemente no se ve.
    const blankTex = new THREE.DataTexture(
      new Uint8Array(4), 1, 1, THREE.RGBAFormat,
    );
    const paintBlank = () => {
      const px = blankTex.image.data;
      px[0] = Math.round(bgColor.r * 255);
      px[1] = Math.round(bgColor.g * 255);
      px[2] = Math.round(bgColor.b * 255);
      px[3] = 255;
      blankTex.needsUpdate = true;
    };
    paintBlank();

    // `shared.uBg.value` es este mismo objeto: mutarlo ya llega a los dos
    // materiales sin recompilar ni tocar el bucle de render.
    const offTheme = onThemeChange(() => {
      bgColor.set(readThemeColor("--atj-bg"));
      renderer.setClearColor(bgColor, 1);
      paintBlank();
    });

    const loader = new THREE.TextureLoader();
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: PIECE_VERT,
        fragmentShader: PIECE_FRAG,
        uniforms: {
          uTex:         { value: blankTex },
          uUseAtlas:    { value: 0 },
          uCell:        { value: new THREE.Vector2() },
          uSize:        { value: new THREE.Vector2(1, 1) },
          uOpacity:     { value: 1 },
          uGroup:       { value: 0 },
          uFocused:     { value: 0 },
          uFlipV:       { value: 0 },
          uExpandRange: { value: 0 },
          uSeed:        { value: 0 },
          uIsHover:     { value: 0 },
          uFrom:        { value: new THREE.Vector3() },
          uFromSize:    { value: new THREE.Vector2() },
          uDelay:       { value: 0 },
          uMorph:       morph,
          uActive:       shared.uActive,
          uFilterMix:    shared.uFilterMix,
          uFogNear:      shared.uFogNear,
          uFogFar:       shared.uFogFar,
          uFar:          shared.uFar,
          uCellScale:    shared.uCellScale,
          uTime:         shared.uTime,
          uCursorPoint:  shared.uCursorPoint,
          uCursorPush:   shared.uCursorPush,
          uCursorRadius: shared.uCursorRadius,
          uBg:           shared.uBg,
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

    // Hasta que hay un frame decodificado la malla sigue en el póster del atlas.
    // Cambiar ya al VideoTexture deja la casilla negra durante el vuelo al centro.
    const revealVideo = (piece) => {
      const slot = piece.slot;
      if (!slot || slot.piece !== piece || !piece.videoTex) return;
      if (piece.video.readyState < 2) return;
      if (slot.mat.uniforms.uTex.value === piece.videoTex) return;
      piece.videoTex.needsUpdate = true;
      slot.mat.uniforms.uTex.value = piece.videoTex;
      slot.mat.uniforms.uUseAtlas.value = 0;
      slot.mat.uniforms.uFlipV.value = 1;
      slot.mat.uniforms.uExpandRange.value = 1;
    };

    const pickFieldSrc = (sources) => {
      if (!sources?.length) return null;
      const mp4 = sources.find((s) => s.type === "video/mp4");
      // En táctil el H.264 va por hardware. El VP9 (sources[0] si hay WebM)
      // alarga justo la espera del primer frame.
      if (coarsePointer && mp4) return mp4.src;
      const probe = document.createElement("video");
      return (sources.find((s) => probe.canPlayType(s.type) !== "") || sources[0]).src;
    };

    const fieldSrcOf = (name) => {
      const meta = videoSrc.get(name);
      if (!meta) return null;
      return meta.thumb || pickFieldSrc(meta.sources);
    };
    const focusSrcOf = (name) => pickFieldSrc(videoSrc.get(name)?.sources);

    const holdPoster = (piece) => {
      const slot = piece.slot;
      if (!slot) return;
      const cell = cellOf.get(piece.name);
      slot.mat.uniforms.uTex.value = cell ? atlasTex : blankTex;
      slot.mat.uniforms.uUseAtlas.value = cell ? 1 : 0;
      slot.mat.uniforms.uFlipV.value = 0;
      slot.mat.uniforms.uExpandRange.value = 0;
    };

    const playSrc = (piece, src) => {
      if (!piece.video || !src) return;
      let current = piece.video.src || "";
      try { current = decodeURI(current); } catch { /* ok */ }
      if (current.endsWith(src)) {
        piece.wantsVideo = true;
        if (piece.video.paused) piece.video.play().catch(() => { piece.wantsVideo = false; });
        return;
      }
      // Al cambiar de archivo el texture se vacía: el póster del atlas tapa el hueco.
      holdPoster(piece);
      piece.wantsVideo = true;
      piece.video.src = encodeURI(src);
      piece.video.play().catch(() => { piece.wantsVideo = false; });
    };

    const startVideo = (slot, piece) => {
      if (!piece.video) {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = "auto";
        vid.crossOrigin = "anonymous";
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
      playSrc(piece, fieldSrcOf(piece.name));
    };

    const promote = (slot, piece, fieldFirst = false) => {
      slot.piece = piece;
      piece.slot = slot;
      slot.token += 1;
      const token = slot.token;

      slot.mesh.position.copy(piece.pos);
      slot.mesh.visible = true;
      const cell = cellOf.get(piece.name);
      slot.mat.uniforms.uCell.value.set(cell ? cell[0] : 0, cell ? cell[1] : 0);
      slot.mat.uniforms.uTex.value = cell ? atlasTex : blankTex;
      slot.mat.uniforms.uUseAtlas.value = cell ? 1 : 0;
      slot.mat.uniforms.uSize.value.set(piece.w, piece.h);
      slot.mat.uniforms.uGroup.value = piece.group;
      slot.mat.uniforms.uSeed.value = piece.seed;
      slot.mat.uniforms.uIsHover.value = piece === hoverPiece ? 1 : 0;
      slot.mat.uniforms.uOpacity.value = focus.piece && focus.piece !== piece ? 0 : 1;
      slot.mat.uniforms.uFocused.value = 0;
      slot.mat.uniforms.uFlipV.value = 0;
      slot.mat.uniforms.uExpandRange.value = 0;
      // Hereda el morph de su instancia: así se puede promocionar a mitad de
      // transición —que es justo cuando la pieza es grande y necesita su
      // textura— sin que dé un salto.
      const k = piece.index;
      slot.mat.uniforms.uFrom.value.set(froms[k * 3], froms[k * 3 + 1], froms[k * 3 + 2]);
      slot.mat.uniforms.uFromSize.value.set(fromSizes[k * 2], fromSizes[k * 2 + 1]);
      slot.mat.uniforms.uDelay.value = delays[k];
      writeInstance(piece);

      if (piece.type === "video") {
        startVideo(slot, piece);
        return;
      }
      const src = imageSrc.get(piece.name);
      if (!src) return;
      // En el morph la pieza es enorme desde el primer frame, así que se ata
      // primero el derivado que el slider ya tiene en caché —aparece sin espera—
      // y por detrás se pide el grande, que la reemplaza al llegar.
      const upgrade = () => {
        if (!fieldFirst || src.hi === src.field) return;
        loader.load(src.hi, (tex) => {
          if (slot.token === token && slot.piece === piece) bindHiRes(slot, piece, tex);
          else tex.dispose();
        });
      };
      loader.load(
        fieldFirst ? src.field : src.hi,
        (tex) => {
          if (slot.token === token && slot.piece === piece) { bindHiRes(slot, piece, tex); upgrade(); }
          else tex.dispose();
        },
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
      slot.mat.uniforms.uTex.value = blankTex;
      slot.mat.uniforms.uUseAtlas.value = 0;
      slot.mat.uniforms.uFlipV.value = 0;
      slot.mat.uniforms.uExpandRange.value = 0;
      slot.mat.uniforms.uOpacity.value = 1;
      if (piece.type === "video") {
        piece.wantsVideo = false;
        piece.video?.pause();
      }
      writeInstance(piece);
    };

    const visibleGroup = (g) =>
      shared.uFilterMix.value < 0.5 || Math.abs(g - shared.uActive.value) < 0.5;

    // Tamaño y posición efectivos: durante la transición la pieza no está en su
    // sitio de galaxia sino a medio camino, y es ahí donde se pone grande. Sin
    // esto, la promoción mediría el tamaño de destino y dejaría en 186px del
    // atlas justo a las piezas que más resolución necesitan.
    const effPos = new THREE.Vector3();
    const effSize = { w: 0, h: 0 };
    const effectiveOf = (p) => {
      if (!morphing) { effPos.copy(p.pos); effSize.w = p.w; effSize.h = p.h; return effSize; }
      const k = p.index;
      const d = delays[k];
      let m = THREE.MathUtils.clamp((morph.value - d) / Math.max(0.0001, 1 - d), 0, 1);
      m = m * m * (3 - 2 * m);
      effPos.set(
        froms[k * 3] + (p.pos.x - froms[k * 3]) * m,
        froms[k * 3 + 1] + (p.pos.y - froms[k * 3 + 1]) * m,
        froms[k * 3 + 2] + (p.pos.z - froms[k * 3 + 2]) * m,
      );
      effSize.w = fromSizes[k * 2] + (p.w - fromSizes[k * 2]) * m;
      effSize.h = fromSizes[k * 2 + 1] + (p.h - fromSizes[k * 2 + 1]) * m;
      return effSize;
    };

    const updatePool = () => {
      if (focus.piece) return;
      const camPos = camera.position;
      const focal = (renderer.domElement.clientHeight / 2) / Math.tan((camera.fov * Math.PI) / 360);
      for (const p of pieces) {
        const eff = effectiveOf(p);
        p.d = camPos.distanceTo(effPos);
        p.px = (focal * Math.max(eff.w, eff.h)) / Math.max(0.001, p.d);
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
    let sceneActive = true;   // la vista está delante; si no, el loop duerme
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

    const viewSize = () => {
      const vv = window.visualViewport;
      return {
        w: vv?.width || window.innerWidth,
        h: vv?.height || window.innerHeight,
      };
    };

    const fitDistFor = (piece) => {
      const vFov = (camera.fov * Math.PI) / 180;
      const { h } = viewSize();
      // En táctil la pieza cabe entre el navbar y el lockup, no en todo el
      // viewport: al esconderse la barra de Chrome el alto crece y, si se
      // encaja al centro del canvas, el borde bajo entra en el pie.
      const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      const band = coarse ? Math.max(120, h - 88 - 168) : h * 0.68;
      const margin = coarse ? Math.min(0.62, band / h) : 0.68;
      const distH = piece.h / (2 * Math.tan(vFov / 2) * margin);
      const distW = piece.w / (2 * Math.tan(vFov / 2) * camera.aspect * margin);
      return Math.max(distH, distW, 1.6);
    };

    const camUp = new THREE.Vector3();
    // El destino es "delante de la cámara", no el origen: la pieza sale de su
    // órbita y aterriza centrada estés donde estés dentro de la galaxia.
    const placeFocus = (piece, dist) => {
      if (!piece.slot) return;
      const { h } = viewSize();
      const p = forwardOf(new THREE.Vector3(), state.yaw, state.pitch)
        .multiplyScalar(dist)
        .add(camera.position);
      const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (coarse) {
        const liftPx = (168 - 88) / 2;
        const vFov = (camera.fov * Math.PI) / 180;
        const worldPerPx = (2 * dist * Math.tan(vFov / 2)) / Math.max(1, h);
        camera.updateMatrixWorld();
        camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        p.addScaledVector(camUp, liftPx * worldPerPx);
      }
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
      pool.forEach((s) => {
        gsap.killTweensOf(s.mat.uniforms.uOpacity);
        gsap.killTweensOf(s.mat.uniforms.uFocused);
      });

      gsap.to(slot.mat.uniforms.uFocused, { value: 1, duration: 0.5, ease: "power2.out" });
      for (const s of pool) {
        if (s === slot) continue;
        gsap.to(s.mat.uniforms.uOpacity, { value: 0, duration: 0.5, ease: "power2.out" });
      }
      gsap.to(cloudMaster, { value: 0, duration: 0.45, ease: "power2.out" });

      placeFocus(piece, fitDistFor(piece));
      if (piece.type === "video") playSrc(piece, focusSrcOf(piece.name));
      canvas.style.cursor = "default";
      onFocusRef.current?.(true);
    };

    const exitFocus = () => {
      const piece = focus.piece;
      const slot = focus.slot;
      if (!piece || !slot) return;

      gsap.killTweensOf(slot.mesh.position);
      pool.forEach((s) => {
        gsap.killTweensOf(s.mat.uniforms.uOpacity);
        gsap.killTweensOf(s.mat.uniforms.uFocused);
      });

      gsap.to(slot.mat.uniforms.uFocused, { value: 0, duration: 1.2, ease: "power3.inOut" });
      gsap.to(slot.mesh.position, {
        x: piece.pos.x, y: piece.pos.y, z: piece.pos.z,
        duration: 1.2, ease: "power3.inOut",
        onComplete: () => {
          focus.piece = null;
          focus.slot = null;
          focus.locked = false;
          if (piece.type === "video") playSrc(piece, fieldSrcOf(piece.name));
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
    const breath = new THREE.Vector3();
    const hitPos = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    const cursorNdc = new THREE.Vector2();
    let cursorInside = false;
    let hoverPiece = null;

    // Réplica exacta de la respiración del shader: sin esto el clic caería
    // donde la pieza estaba, no donde se ve. El empuje del cursor no se
    // replica a propósito — es cosmético, y así no se realimenta con el hover.
    const breatheOf = (piece, out) => out.set(
      Math.sin(shared.uTime.value * BREATH_SPEED[0] + piece.seed * 6.2831),
      Math.sin(shared.uTime.value * BREATH_SPEED[1] + piece.seed * 11.0),
      Math.sin(shared.uTime.value * BREATH_SPEED[2] + piece.seed * 17.0),
    ).multiplyScalar(BREATH_AMP);

    const setHoverPiece = (piece) => {
      if (hoverPiece === piece) return;
      hoverPiece = piece;
      cloudMat.uniforms.uHoverIndex.value = piece ? piece.index : -1;
      for (const s of pool) s.mat.uniforms.uIsHover.value = s.piece && s.piece === piece ? 1 : 0;
    };

    const setCursorActive = (on) => {
      cursorInside = on;
      gsap.to(shared.uCursorPush, {
        value: on ? CURSOR_PUSH : 0,
        duration: 0.45, ease: "power2.out", overwrite: true,
      });
      if (!on) setHoverPiece(null);
    };

    // El punto de empuje sigue al cursor a la profundidad de la pieza apuntada
    // (o a la del pivote si no hay ninguna), y se recalcula cada frame para que
    // acompañe también a los giros de cámara.
    const updateCursorPoint = () => {
      if (!cursorInside) return;
      rayDir.set(cursorNdc.x, cursorNdc.y, 0.5).unproject(camera).sub(camera.position).normalize();
      const depth = hoverPiece ? camera.position.distanceTo(hoverPiece.pos) : state.dist;
      shared.uCursorPoint.value.copy(camera.position).addScaledVector(rayDir, depth);
    };

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
        hitPos.copy(piece.pos).add(breatheOf(piece, breath));
        ndc.copy(hitPos).project(camera);
        if (ndc.z < -1 || ndc.z > 1) continue;
        const dist = camera.position.distanceTo(hitPos);
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
      setHoverPiece(null);
      if (!focus.piece) canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e) => {
      cursorNdc.set(
        ((e.clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
        -((((e.clientY - canvasRect.top) / canvasRect.height) * 2) - 1),
      );
      if (!cursorInside) { refreshRect(); setCursorActive(true); }

      if (!drag.active) {
        if (!focus.piece) {
          const hit = hitTest(e.clientX, e.clientY);
          setHoverPiece(hit);
          canvas.style.cursor = hit ? "pointer" : "grab";
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
    const onPointerLeave = () => setCursorActive(false);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    const onResize = () => {
      const { w, h } = viewSize();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      refreshRect();
      state.maxDist = Math.max(state.maxDist, fitGalaxyDist(state.yaw, state.pitch) * 1.25);
      if (focus.piece) placeFocus(focus.piece, fitDistFor(focus.piece));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    onResize();

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

    // ── Morph entre vistas ───────────────────────────────────────────────────
    // El puente es puramente geométrico: un rectángulo de pantalla del slider se
    // convierte en posición y tamaño de mundo a una profundidad fija, la pieza
    // arranca ahí y el shader interpola hasta su sitio en la galaxia. No hay
    // captura, ni fundido cruzado, ni doble render: es la misma pieza moviéndose.
    const MORPH_DEPTH = 13;
    const morphTmp = { pos: new THREE.Vector3(), w: 0, h: 0 };
    const mRight = new THREE.Vector3();
    const mUp = new THREE.Vector3();
    let morphTween = null;
    let morphing = false;

    const rectToWorld = (rect, out) => {
      const vw = renderer.domElement.clientWidth || window.innerWidth;
      const vh = renderer.domElement.clientHeight || window.innerHeight;
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const perPx = (2 * MORPH_DEPTH * tanV) / vh;
      const ndcX = ((rect.x + rect.w / 2) / vw) * 2 - 1;
      const ndcY = -(((rect.y + rect.h / 2) / vh) * 2 - 1);

      forwardOf(tmpV, state.yaw, state.pitch);
      mRight.crossVectors(tmpV, UP_AXIS).normalize();
      mUp.crossVectors(mRight, tmpV);

      out.pos.copy(camera.position)
        .addScaledVector(tmpV, MORPH_DEPTH)
        .addScaledVector(mRight, ndcX * tanV * camera.aspect * MORPH_DEPTH)
        .addScaledVector(mUp, ndcY * tanV * MORPH_DEPTH);
      out.w = rect.w * perPx;
      out.h = rect.h * perPx;
      return out;
    };

    // Rellena el estado "de donde viene / a donde va" de cada pieza. Las que el
    // slider tiene en pantalla llevan su rectángulo y van primero; el resto nace
    // en su propio sitio con tamaño cero, escalonado de dentro a fuera, así la
    // galaxia florece alrededor de las que sí viajan.
    const setMorphSource = (rects) => {
      let maxR = 1;
      for (const p of pieces) maxR = Math.max(maxR, p.pos.length());
      for (const p of pieces) {
        const i = p.index;
        const rect = rects?.get?.(p.canonical);
        if (rect) {
          rectToWorld(rect, morphTmp);
          froms[i * 3] = morphTmp.pos.x;
          froms[i * 3 + 1] = morphTmp.pos.y;
          froms[i * 3 + 2] = morphTmp.pos.z;
          fromSizes[i * 2] = morphTmp.w;
          fromSizes[i * 2 + 1] = morphTmp.h;
          delays[i] = 0;
        } else {
          froms[i * 3] = p.pos.x;
          froms[i * 3 + 1] = p.pos.y;
          froms[i * 3 + 2] = p.pos.z;
          fromSizes[i * 2] = 0;
          fromSizes[i * 2 + 1] = 0;
          delays[i] = 0.06 + 0.46 * (p.pos.length() / maxR);
        }
      }
      fromAttr.needsUpdate = true;
      fromSizeAttr.needsUpdate = true;
      delayAttr.needsUpdate = true;
    };

    // Durante la transición todo vuelve a la nube instanciada: las piezas
    // promocionadas tienen mesh propia y no seguirían la interpolación.
    const beginMorph = (rects) => {
      // La escena puede venir de dormir: sin esto, la cámara que usa el puente
      // de coordenadas sería la de la última vez que se pintó.
      applyCamera();
      camera.updateMatrixWorld(true);
      if (focus.piece) exitFocus();
      morphTween?.kill();
      morphing = true;
      setHoverPiece(null);
      for (const slot of pool) release(slot);

      // Las piezas que viajan se sacan de la nube: ahí se verían a la
      // resolución del atlas (186px) y a tamaño de slider eso se nota.
      // `setMorphSource` ya ha escrito el estado de partida de cada pieza, así
      // que promote lo hereda solo.
      for (const piece of pieces) {
        if (!rects?.get?.(piece.canonical)) continue;
        const slot = pool.find((s) => !s.piece);
        if (!slot) break;
        promote(slot, piece, true);
      }
    };

    const endMorph = () => {
      morphing = false;
      morph.value = 1;
    };

    // ── API: las pills la usan por dentro y el escenario por fuera ──────────
    apiRef.current = {
      view: "galaxy",
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
      // Entrada desde el slider: las piezas visibles arrancan en sus
      // rectángulos y el resto florece alrededor.
      morphIn(rects, duration = 1.35) {
        setMorphSource(rects);
        morph.value = 0;
        beginMorph(rects);
        morphTween = gsap.to(morph, {
          value: 1, duration, ease: "power3.inOut", onComplete: endMorph,
        });
        return duration;
      },
      // Salida hacia el slider: mismas piezas, camino inverso. Devuelve una
      // promesa para que el escenario no cambie de capa antes de tiempo.
      morphOut(rects, duration = 1.05) {
        setMorphSource(rects);
        morph.value = 1;
        beginMorph(rects);
        return new Promise((resolve) => {
          morphTween = gsap.to(morph, {
            value: 0, duration, ease: "power3.inOut",
            onComplete: () => { morphing = false; resolve(); },
          });
        });
      },
      // Rectángulos en pantalla de cada pieza, por índice: el equivalente al
      // `getRects` del slider, para que el traspaso funcione en los dos sentidos.
      getRects() {
        const out = new Map();
        applyCamera();
        camera.updateMatrixWorld(true);
        const r = canvas.getBoundingClientRect();
        const v = new THREE.Vector3();
        const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
        for (const p of pieces) {
          v.copy(p.pos).project(camera);
          if (v.z < -1 || v.z > 1) continue;
          const d = camera.position.distanceTo(p.pos);
          const perPx = (2 * d * tanHalf) / r.height;
          const w = p.w / perPx;
          const h = p.h / perPx;
          out.set(p.canonical, {
            x: (v.x * 0.5 + 0.5) * r.width - w / 2,
            y: (-v.y * 0.5 + 0.5) * r.height - h / 2,
            w, h, name: p.name,
          });
        }
        return out;
      },
      // Dormir en vez de desmontar: la escena se queda entera —texturas, atlas,
      // contexto— para que volver a ella sea instantáneo.
      setActive(on) {
        sceneActive = on;
        if (on && !morphing) morph.value = 1;
        for (const slot of pool) {
          const piece = slot.piece;
          if (!piece || piece.type !== "video" || !piece.video) continue;
          if (on) piece.video.play().catch(() => {});
          else piece.video.pause();
        }
      },
    };
    if (viewRef) viewRef.current = apiRef.current;

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    let frame = 0;
    let readyDispatched = false;
    const t0 = performance.now();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || !sceneActive) return;

      if (!focus.locked && !nav.animating) {
        state.yaw += (state.targetYaw - state.yaw) * damping;
        state.pitch += (state.targetPitch - state.pitch) * damping;
        state.dist += (state.targetDist - state.dist) * damping;
        state.pivot.lerp(state.targetPivot, damping);
      }
      applyCamera();
      shared.uTime.value = (performance.now() - t0) / 1000;
      updateCursorPoint();

      const ref = Math.max(state.dist, 6);
      shared.uFogNear.value = ref * FOG_NEAR_K;
      shared.uFogFar.value  = ref * FOG_FAR_K + GALAXY_RADIUS * FOG_FAR_R;
      shared.uFar.value     = ref + GALAXY_RADIUS * FAR_R;

      if (atlasDirty && performance.now() - atlasStamp > 150) {
        atlasTex.needsUpdate = true;
        atlasDirty = false;
        atlasStamp = performance.now();
      }

      if (morphing || frame % 12 === 0) updatePool();
      for (const p of pieces) {
        if (!p.slot || !p.videoTex || !p.video || !p.wantsVideo) continue;
        if (p.video.readyState < 2) continue;
        revealVideo(p);
        if (!p.video.paused) p.videoTex.needsUpdate = true;
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
      if (viewRef) viewRef.current = null;
      onFocusRef.current?.(false);
      filterTween?.kill();
      gsap.killTweensOf(state);
      gsap.killTweensOf(state.pivot);
      gsap.killTweensOf(state.targetPivot);
      gsap.killTweensOf(shared.uFilterMix);
      gsap.killTweensOf(cloudMaster);
      gsap.killTweensOf(shared.uCursorPush);
      pool.forEach((s) => {
        gsap.killTweensOf(s.mat.uniforms.uOpacity);
        gsap.killTweensOf(s.mat.uniforms.uFocused);
        gsap.killTweensOf(s.mesh.position);
      });

      offTheme();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
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
      blankTex.dispose();
      renderer.dispose();
    };
  }, [isLoaded, groups, damping, viewRef]);

  useEffect(() => { apiRef.current?.setActive(active); }, [active]);

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
        left: 0,
        right: 0,
        top: vvBox ? vvBox.top : 0,
        height: vvBox ? vvBox.height : "100dvh",
        background: "var(--atj-bg)",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        data-space3d-canvas="true"
        style={{ display: "block", width: "100%", height: "100%" }}
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
        /* --cst-pill replica --bcn-pill del navbar: misma altura y colocada
           justo debajo de él en cada punto de ruptura. */
        .cst {
          --cst-pill: 1.5em;
          position: fixed;
          top: calc(16px + var(--cst-pill) + 4px);
          left: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          z-index: 9998;
          pointer-events: none;
          font-size: 0.875rem;
          letter-spacing: -0.04em;
          color: var(--atj-fg);
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
          height: var(--cst-pill);
          display: flex;
          align-items: center;
          padding: 0 0.7em;
          border: 0;
          border-radius: 0;
          background: var(--atj-hairline);
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

        @media (max-width: 768px), (pointer: coarse) {
          .cst { --cst-pill: 1.8em; top: calc(16px + var(--cst-pill) + 6px); }
          .cst-pill { padding: 0 0.85em; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cst, .cst-pill { transition: none; }
        }
      `}</style>
    </div>
  );
}
