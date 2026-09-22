"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { SPACE_IMAGES, ALL_VIDEOS } from "@/data/mediaCatalog";

// ─── Constelaciones ────────────────────────────────────────────────────────────
// PROVISIONAL: reparto inventado para poder verlo funcionando. Sustituir `label`
// y `images` por las galerías reales — es el único bloque que hay que tocar.
// Las imágenes del manifiesto que no aparezcan aquí caen en el último grupo.
const CONSTELLATIONS = [
  {
    id: "adec",
    label: "AdeC",
    images: ["adec-scroll-11", "adec-scroll-12", "adec-scroll-13", "atj-webcontent-002", "atj-webcontent-003"],
  },
  {
    id: "galaxy-bar",
    label: "Galaxy Bar",
    images: ["galaxy-bar-stickers", "galaxybar-explo-serviellets02", "atj-webcontent-001", "atj-webcontent-004", "atj-webcontent-005"],
  },
  {
    id: "johnny",
    label: "Johnny Carretes",
    images: ["atj-webcontent-006", "atj-webcontent-007", "atj-webcontent-008", "atj-webcontent-009", "atj-webcontent-010"],
  },
  {
    id: "bisbis",
    label: "Bis Bis",
    images: ["atj-webcontent-011", "atj-webcontent-012", "atj-webcontent-013", "atj-webcontent-014", "atj-webcontent-015"],
  },
  {
    id: "socarrat",
    label: "Socarrat",
    images: ["atj-webcontent-016", "atj-webcontent-017", "atj-webcontent-018", "atj-webcontent-019", "atj-webcontent-020"],
  },
  {
    id: "dfny",
    label: "DFNY",
    images: ["atj-webcontent-021", "atj-webcontent-022", "atj-webcontent-023", "atj-webcontent-024", "atj-webcontent-025"],
  },
  {
    id: "playground",
    label: "Playground",
    images: ["atj-webcontent-026", "atj-webcontent-027", "atj-webcontent-028", "atj-webcontent-029", "atj-webcontent-030"],
  },
  {
    id: "archive",
    label: "Archive",
    images: ["img-3514", "img-3623", "img-3777-3", "img-5434", "img-5438", "img-5447", "texture-ballon-9-bitmap", "atj-paper-mockup-02-nobg"],
  },
];

// ─── Geometría de la galaxia ───────────────────────────────────────────────────
const R = 22;                 // radio del disco
const ARMS = 2;
const SIG_T = 4.6;            // dispersión tangente al brazo (eje largo del cúmulo)
const SIG_R = 2.3;            // dispersión radial
const SIG_Y = 1.5;            // grosor del disco
const CORE_PULL = 0.26;       // fracción de piezas arrastradas hacia el núcleo

const COPIES_DESKTOP = 12;    // instancias por imagen (1 ancla + resto polvo)
const COPIES_MOBILE = 7;

const ANCHOR_SIZE = [1.9, 2.8];
const MID_SIZE    = [0.85, 1.35];
const DUST_SIZE   = [0.32, 0.74];

// Profundidad / cámara
const MIN_DIST   = 4.5;
const ORBIT_DIST = 14;
const DUST_NEAR  = 11;        // los duplicados se disuelven por debajo de esto
const DUST_FAR   = 26;
// Niebla y corte lejano relativos a la distancia de cámara: si fueran fijos, al
// alejarse a vista de galaxia se comerían la escena entera.
const FOG_NEAR_K = 0.55;
const FOG_FAR_K  = 1.15;
const FOG_FAR_R  = 0.9;
const FAR_R      = 2.8;

// Texturas
const ATLAS_SIZE = 2048;
const ATLAS_COLS = 8;         // 64 celdas de 256px — cubre imágenes + pósters
const ATLAS_CELL = ATLAS_SIZE / ATLAS_COLS;
const ATLAS_CAP  = ATLAS_COLS * ATLAS_COLS;
const HIRES_DIST = 20;        // a partir de aquí una pieza pide su textura completa

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
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = (rnd) => {
  const u = Math.max(1e-6, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};
const between = (rnd, [a, b]) => a + rnd() * (b - a);

// ─── Shaders ───────────────────────────────────────────────────────────────────
// Ambos materiales escriben color opaco (mezcla hacia blanco), así que basta el
// z-buffer y no hay que ordenar. Por eso lo filtrado no se queda en fantasma:
// encoge a cero, si no taparía en blanco lo que tiene detrás.
const FILTER_GLSL = /* glsl */ `
  uniform float uActive;
  uniform float uFilterMix;

  float groupFactor(float g) {
    float on = abs(g - uActive) < 0.5 ? 1.0 : 0.0;
    return mix(1.0, on, uFilterMix);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute vec3  iOffset;
  attribute vec2  iSize;
  attribute vec2  iCell;
  attribute float iGroup;

  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFar;
  uniform float uDustNear;
  uniform float uDustFar;
  uniform float uMaster;

  varying vec2  vUv;
  varying vec2  vCell;
  varying float vAlpha;

  ${FILTER_GLSL}

  void main() {
    float grp = groupFactor(iGroup);

    vec4 mvCenter = modelViewMatrix * vec4(iOffset, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * iSize * grp, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    float d    = -mvCenter.z;
    float fog  = 1.0 - smoothstep(uFogNear, uFogFar, d) * 0.62;
    float near = smoothstep(uDustNear, uDustFar, d);
    float far  = 1.0 - smoothstep(uFar * 0.84, uFar, d);

    vAlpha = fog * near * far * grp * uMaster;
    vUv    = uv;
    vCell  = iCell;
  }
`;

const DUST_FRAG = /* glsl */ `
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
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFar;
  uniform float uOpacity;

  varying vec2  vUv;
  varying float vAlpha;

  ${FILTER_GLSL}

  void main() {
    float grp = mix(groupFactor(uGroup), 1.0, uFocused);

    vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * uSize * grp, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    float d   = -mvCenter.z;
    float fog = 1.0 - smoothstep(uFogNear, uFogFar, d) * 0.62;
    float far = 1.0 - smoothstep(uFar * 0.84, uFar, d);
    float env = mix(fog * far, 1.0, uFocused);

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

// ─── Agrupación ────────────────────────────────────────────────────────────────
function buildGroups(imageNames, videoNames) {
  const pool = new Set(imageNames);
  const groups = CONSTELLATIONS.map((c) => ({
    id: c.id,
    label: c.label,
    images: c.images.filter((n) => pool.has(n)),
    videos: [],
  }));

  const used = new Set(groups.flatMap((g) => g.images));
  const rest = imageNames.filter((n) => !used.has(n));
  if (rest.length && groups.length) groups[groups.length - 1].images.push(...rest);

  // Los vídeos se reparten entre constelaciones para que el filtro los alcance.
  // Si los prefieres sueltos, basta con darles su propio grupo aquí.
  videoNames.forEach((n, i) => {
    if (groups.length) groups[i % groups.length].videos.push(n);
  });

  return groups.filter((g) => g.images.length || g.videos.length);
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function NewSpace3dFocus({ damping = 0.085 } = {}) {
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
    const copies = isMobile ? COPIES_MOBILE : COPIES_DESKTOP;

    // ── Media ────────────────────────────────────────────────────────────────
    const imageSrc = new Map();   // name → { field, hi, hiFb }
    for (const g of groups) {
      for (const name of g.images) {
        const img = getImageRef.current(name);
        const hi = pickWebglUrl(img);
        if (!hi) continue;
        const jpg = isWebglSafe(img.fallback) ? img.fallback : null;
        imageSrc.set(name, {
          field: toFieldUrl(hi),
          hi,
          hiFb: jpg && jpg !== hi ? jpg : null,
        });
      }
    }
    const videoSrc = new Map();   // name → { sources, poster }
    for (const g of groups) {
      for (const name of g.videos) {
        const v = getVideoRef.current(name);
        if (!v?.sources?.length) continue;
        videoSrc.set(name, { sources: v.sources, poster: v.poster || null });
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

    // Distancia a la que el disco entra en pantalla con margen.
    const fitGalaxyDist = () => {
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const tanH = tanV * camera.aspect;
      return THREE.MathUtils.clamp(R / (tanH * 0.63), 30, 78);
    };

    // ── Atlas ────────────────────────────────────────────────────────────────
    // Una sola textura para todo el campo lejano: 64 celdas de 256px ≈ 22 MB de
    // VRAM en vez de ~200 MB de texturas sueltas. Las piezas cercanas y la del
    // focus piden su derivado completo aparte (ver ensureHiRes).
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

    const cellOf = new Map();            // name → [col, row]
    const aspectOf = new Map();          // name → w/h
    let atlasSlot = 0;
    const takeCell = (name) => {
      if (cellOf.has(name)) return cellOf.get(name);
      if (atlasSlot >= ATLAS_CAP) return null;
      const cell = [atlasSlot % ATLAS_COLS, Math.floor(atlasSlot / ATLAS_COLS)];
      atlasSlot += 1;
      cellOf.set(name, cell);
      return cell;
    };

    let atlasDirty = false;
    let atlasStamp = 0;
    const atlasImgs = [];
    const aspectHooks = new Map();       // name → [fn]

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
        const w = img.naturalWidth || 1;
        const h = img.naturalHeight || 1;
        // Se dibuja estirada a la celda cuadrada y el quad la devuelve a su
        // proporción: sin recortes ni bandas, y resolución uniforme.
        atlasCtx.drawImage(img, cell[0] * ATLAS_CELL, cell[1] * ATLAS_CELL, ATLAS_CELL, ATLAS_CELL);
        atlasDirty = true;
        const ar = THREE.MathUtils.clamp(w / h, 0.4, 2.6);
        aspectOf.set(name, ar);
        (aspectHooks.get(name) || []).forEach((fn) => fn(ar));
        aspectHooks.delete(name);
        img.onload = null;
        img.onerror = null;
      };
      img.onerror = () => { img.onload = null; img.onerror = null; };
      img.src = url;
    };

    // Imágenes primero: son las que tienen copias de polvo.
    for (const [name, src] of imageSrc) loadIntoAtlas(name, src.field);
    for (const [name, src] of videoSrc) loadIntoAtlas(name, toFieldUrl(src.poster));

    // ── Uniforms compartidos (mismo objeto en todos los materiales) ──────────
    const shared = {
      uActive:    { value: -1 },
      uFilterMix: { value: 0 },
      uFogNear:   { value: 24 },
      uFogFar:    { value: 66 },
      uFar:       { value: 120 },
      uCellScale: { value: 1 / ATLAS_COLS },
    };
    const dustMaster = { value: 1 };

    // ── Distribución ─────────────────────────────────────────────────────────
    const centers = [];
    const anchorPlan = [];
    const dustPlan = [];
    const lanes = Math.max(1, Math.ceil(groups.length / ARMS) - 0.85);

    groups.forEach((g, gi) => {
      const rnd = mulberry(1000 + gi * 37);
      const arm = gi % ARMS;
      const t = 0.24 + (Math.floor(gi / ARMS) / lanes) * 0.82;
      const rad = R * Math.pow(t, 0.92);
      const theta = (arm * 2 * Math.PI) / ARMS + t * 2.35 + 0.4;
      const cx = Math.cos(theta) * rad;
      const cz = Math.sin(theta) * rad;
      const cy = gauss(rnd) * 1.1 * (1 - t * 0.5);
      const tang = { x: -Math.sin(theta), z: Math.cos(theta) };
      const radl = { x: Math.cos(theta), z: Math.sin(theta) };
      centers.push(new THREE.Vector3(cx, cy, cz));

      const place = (k, total) => {
        // Las copias de una misma pieza se reparten a lo largo del brazo.
        const spread = ((k + 0.5) / total - 0.5 + (rnd() - 0.5) * 0.5) * 2.4 * SIG_T;
        const a = spread + gauss(rnd) * SIG_T * 0.7;
        const b = gauss(rnd) * SIG_R;
        const p = new THREE.Vector3(
          cx + tang.x * a + radl.x * b,
          cy + gauss(rnd) * SIG_Y,
          cz + tang.z * a + radl.z * b,
        );
        if (rnd() < CORE_PULL) {
          const pull = 0.3 + rnd() * 0.45;
          p.x *= pull; p.z *= pull; p.y *= 0.7;
        }
        return p;
      };

      for (const name of g.images) {
        if (!imageSrc.has(name)) continue;
        const hasCell = cellOf.has(name);
        for (let k = 0; k < copies; k++) {
          const pos = place(k, copies);
          if (k === 0) {
            anchorPlan.push({ name, type: "image", group: gi, pos, size: between(rnd, ANCHOR_SIZE) });
          } else if (hasCell) {
            const size = k === 1 ? between(rnd, MID_SIZE) : between(rnd, DUST_SIZE);
            dustPlan.push({ name, group: gi, pos, size });
          }
        }
      }
      for (const name of g.videos) {
        if (!videoSrc.has(name)) continue;
        anchorPlan.push({ name, type: "video", group: gi, pos: place(0, 1), size: between(rnd, ANCHOR_SIZE) });
      }
    });

    // ── Nube de polvo: una instanced mesh, un draw call ──────────────────────
    const plane = new THREE.PlaneGeometry(1, 1);
    let dustMesh = null;

    if (dustPlan.length) {
      const n = dustPlan.length;
      const offsets = new Float32Array(n * 3);
      const sizes = new Float32Array(n * 2);
      const cells = new Float32Array(n * 2);
      const gIdx = new Float32Array(n);
      const rowsOf = new Map();          // name → [índices] para ajustar el aspecto

      dustPlan.forEach((d, i) => {
        offsets[i * 3] = d.pos.x;
        offsets[i * 3 + 1] = d.pos.y;
        offsets[i * 3 + 2] = d.pos.z;
        sizes[i * 2] = d.size;
        sizes[i * 2 + 1] = d.size;
        const cell = cellOf.get(d.name) || [0, 0];
        cells[i * 2] = cell[0];
        cells[i * 2 + 1] = cell[1];
        gIdx[i] = d.group;
        const list = rowsOf.get(d.name) || [];
        list.push(i);
        rowsOf.set(d.name, list);
      });

      const geo = new THREE.InstancedBufferGeometry();
      geo.index = plane.index;
      geo.setAttribute("position", plane.attributes.position);
      geo.setAttribute("uv", plane.attributes.uv);
      geo.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offsets, 3));
      const sizeAttr = new THREE.InstancedBufferAttribute(sizes, 2);
      geo.setAttribute("iSize", sizeAttr);
      geo.setAttribute("iCell", new THREE.InstancedBufferAttribute(cells, 2));
      geo.setAttribute("iGroup", new THREE.InstancedBufferAttribute(gIdx, 1));
      geo.instanceCount = n;

      const dustMat = new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: {
          uAtlas:     { value: atlasTex },
          uDustNear:  { value: DUST_NEAR },
          uDustFar:   { value: DUST_FAR },
          uMaster:    dustMaster,
          uActive:    shared.uActive,
          uFilterMix: shared.uFilterMix,
          uFogNear:   shared.uFogNear,
          uFogFar:    shared.uFogFar,
          uFar:       shared.uFar,
          uCellScale: shared.uCellScale,
        },
        toneMapped: true,
      });

      dustMesh = new THREE.Mesh(geo, dustMat);
      dustMesh.frustumCulled = false;
      scene.add(dustMesh);

      // Cuando la imagen entra en el atlas ya sabemos su proporción real.
      for (const [name, rows] of rowsOf) {
        onAspect(name, (ar) => {
          const s = Math.sqrt(ar);
          for (const i of rows) {
            const base = dustPlan[i].size;
            sizes[i * 2] = base * s;
            sizes[i * 2 + 1] = base / s;
          }
          sizeAttr.needsUpdate = true;
        });
      }
    }

    // ── Piezas ancla: mesh propia, interactivas y enfocables ────────────────
    const items = [];
    const videoItems = [];
    const loader = new THREE.TextureLoader();

    const whiteTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat,
    );
    whiteTex.needsUpdate = true;

    const applyAspect = (item, ar) => {
      const a = THREE.MathUtils.clamp(ar, 0.4, 2.6);
      const s = Math.sqrt(a);
      item.mat.uniforms.uSize.value.set(item.scaleBase * s, item.scaleBase / s);
    };

    for (const plan of anchorPlan) {
      const cell = cellOf.get(plan.name);
      const mat = new THREE.ShaderMaterial({
        vertexShader: PIECE_VERT,
        fragmentShader: PIECE_FRAG,
        uniforms: {
          uTex:         { value: cell ? atlasTex : whiteTex },
          uUseAtlas:    { value: cell ? 1 : 0 },
          uCell:        { value: new THREE.Vector2(cell ? cell[0] : 0, cell ? cell[1] : 0) },
          uSize:        { value: new THREE.Vector2(plan.size, plan.size) },
          uOpacity:     { value: 1 },
          uGroup:       { value: plan.group },
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
      mesh.position.copy(plan.pos);
      mesh.frustumCulled = false;
      scene.add(mesh);

      const item = {
        name: plan.name,
        type: plan.type,
        group: plan.group,
        mesh,
        mat,
        scaleBase: plan.size,
        homePos: plan.pos.clone(),
        hasCell: !!cell,
        hiTex: null,
        hiBound: false,
        hiPending: false,
        lastNear: Infinity,
        active: false,
      };
      items.push(item);
      onAspect(plan.name, (ar) => applyAspect(item, ar));

      if (plan.type === "video") {
        item.sources = videoSrc.get(plan.name).sources;
        item.video = null;
        item.videoTex = null;
        videoItems.push(item);
      } else {
        const src = imageSrc.get(plan.name);
        item.hiSrc = src.hi;
        item.hiFb = src.hiFb;
      }
    }

    // ── Resolución completa por cercanía (y en focus) ────────────────────────
    const MAX_HIRES = isMobile ? 5 : 12;

    const ensureHiRes = (item) => {
      if (item.type !== "image" || item.hiBound || item.hiPending || !item.hiSrc) return;
      item.hiPending = true;
      const bind = (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 1;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.flipY = true;
        tex.premultiplyAlpha = false;
        item.hiTex = tex;
        item.hiBound = true;
        item.hiPending = false;
        item.mat.uniforms.uTex.value = tex;
        item.mat.uniforms.uUseAtlas.value = 0;
        const im = tex.image;
        if (im?.width && im?.height) applyAspect(item, im.width / im.height);
      };
      loader.load(item.hiSrc, bind, undefined, () => {
        if (item.hiFb) loader.load(item.hiFb, bind, undefined, () => { item.hiPending = false; });
        else item.hiPending = false;
      });
    };

    const releaseHiRes = (item) => {
      if (!item.hiBound || focus.item === item || !item.hasCell) return;
      item.hiTex?.dispose();
      item.hiTex = null;
      item.hiBound = false;
      item.mat.uniforms.uTex.value = atlasTex;
      item.mat.uniforms.uUseAtlas.value = 1;
    };

    const updateLod = () => {
      const cam = camera.position;
      const ranked = [];
      for (const it of items) {
        if (it.type !== "image") continue;
        it.lastNear = cam.distanceTo(it.mesh.position);
        ranked.push(it);
      }
      ranked.sort((a, b) => a.lastNear - b.lastNear);
      let budget = MAX_HIRES;
      for (const it of ranked) {
        if (budget > 0 && (it.lastNear < HIRES_DIST || focus.item === it)) {
          ensureHiRes(it);
          budget -= 1;
        } else if (it.hiBound && it.lastNear > HIRES_DIST * 1.6) {
          releaseHiRes(it);
        }
      }
    };

    const visibleGroup = (g) =>
      shared.uFilterMix.value < 0.5 || Math.abs(g - shared.uActive.value) < 0.5;

    // ── Vídeo ────────────────────────────────────────────────────────────────
    const MAX_ACTIVE_VIDEOS = isMobile ? 1 : 3;
    const videoEls = [];

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
            if (focus.item === item) placeFocus(item, fitDistFor(item));
          }
        });

        item.video = vid;
        item.videoTex = vtex;
        videoEls.push(vid);
      }
      item.active = true;
      item.mat.uniforms.uTex.value = item.videoTex;
      item.mat.uniforms.uUseAtlas.value = 0;
      item.mat.uniforms.uFlipV.value = 1;
      item.mat.uniforms.uExpandRange.value = 1;
      item.video.play().catch(() => {});
    };

    const deactivateVideo = (item) => {
      if (!item.active) return;
      item.active = false;
      item.video?.pause();
      item.mat.uniforms.uTex.value = item.hasCell ? atlasTex : whiteTex;
      item.mat.uniforms.uUseAtlas.value = item.hasCell ? 1 : 0;
      item.mat.uniforms.uFlipV.value = 0;
      item.mat.uniforms.uExpandRange.value = 0;
    };

    const updateActiveVideos = () => {
      if (!videoItems.length) return;
      if (focus.item) {
        for (const it of videoItems) {
          if (it === focus.item) { if (!it.active) activateVideo(it); }
          else if (it.active) deactivateVideo(it);
        }
        return;
      }
      const cam = camera.position;
      const ranked = videoItems
        .map((it) => ({ it, d: cam.distanceTo(it.mesh.position) }))
        .filter((o) => o.d < HIRES_DIST * 1.2 && visibleGroup(o.it.group))
        .sort((a, b) => a.d - b.d);
      const keep = new Set(ranked.slice(0, MAX_ACTIVE_VIDEOS).map((o) => o.it));
      for (const it of videoItems) {
        if (keep.has(it)) { if (!it.active) activateVideo(it); }
        else if (it.active) deactivateVideo(it);
      }
    };

    // ── Cámara ───────────────────────────────────────────────────────────────
    const PITCH_LIMIT = Math.PI / 2 - 0.05;
    const startDist = fitGalaxyDist();

    const state = {
      yaw: 0.55, pitch: 0.5, dist: startDist,
      targetYaw: 0.55, targetPitch: 0.5, targetDist: startDist,
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
      const max = R * 1.15;
      if (len > max) state.targetPivot.multiplyScalar(max / len);
    };

    // Al llegar al mínimo el zoom deja de acercar y empieza a volar hacia
    // delante: así se entra de verdad en la galaxia en vez de chocar con ella.
    const zoomBy = (delta) => {
      if (focus.item || nav.animating) return;
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
    const focus = { item: null, locked: false, savedFilter: null };
    const CLICK_PX = 8;

    const fitDistFor = (item) => {
      const sz = item.mat.uniforms.uSize.value;
      const vFov = (camera.fov * Math.PI) / 180;
      const margin = 0.68;
      const distH = sz.y / (2 * Math.tan(vFov / 2) * margin);
      const distW = sz.x / (2 * Math.tan(vFov / 2) * camera.aspect * margin);
      return Math.max(distH, distW, 1.6);
    };

    // El destino del focus es "delante de la cámara", no el origen: la pieza
    // sale de su órbita y aterriza centrada estés donde estés en la galaxia.
    const placeFocus = (item, dist) => {
      const p = forwardOf(new THREE.Vector3(), state.yaw, state.pitch)
        .multiplyScalar(dist)
        .add(camera.position);
      gsap.to(item.mesh.position, {
        x: p.x, y: p.y, z: p.z,
        duration: 1.05, ease: "power3.inOut", overwrite: "auto",
      });
    };

    const enterFocus = (item) => {
      if (focus.item || !item) return;
      focus.item = item;
      focus.locked = true;
      focus.savedFilter = { active: shared.uActive.value, mix: shared.uFilterMix.value };

      gsap.killTweensOf(state);
      for (const it of items) gsap.killTweensOf(it.mat.uniforms.uOpacity);
      gsap.killTweensOf(item.mesh.position);
      filterTween?.kill();

      ensureHiRes(item);
      item.mat.uniforms.uFocused.value = 1;

      for (const it of items) {
        gsap.to(it.mat.uniforms.uOpacity, {
          value: it === item ? 1 : 0,
          duration: it === item ? 0.3 : 0.55,
          ease: "power2.out",
        });
      }
      gsap.to(dustMaster, { value: 0, duration: 0.45, ease: "power2.out" });

      placeFocus(item, fitDistFor(item));
      if (item.type === "video") activateVideo(item);
      canvas.style.cursor = "default";
      onFocusRef.current?.(true);
    };

    const exitFocus = () => {
      const item = focus.item;
      if (!item) return;
      gsap.killTweensOf(item.mesh.position);
      for (const it of items) gsap.killTweensOf(it.mat.uniforms.uOpacity);

      gsap.to(item.mesh.position, {
        x: item.homePos.x, y: item.homePos.y, z: item.homePos.z,
        duration: 1.2, ease: "power3.inOut",
        onComplete: () => {
          item.mat.uniforms.uFocused.value = 0;
          focus.item = null;
          focus.locked = false;
        },
      });
      for (const it of items) {
        gsap.to(it.mat.uniforms.uOpacity, {
          value: 1, duration: 0.9, delay: 0.35, ease: "power2.out",
        });
      }
      gsap.to(dustMaster, { value: 1, duration: 0.8, delay: 0.3, ease: "power2.out" });

      if (focus.savedFilter) {
        shared.uActive.value = focus.savedFilter.active;
        gsap.to(shared.uFilterMix, {
          value: focus.savedFilter.mix, duration: 0.5, delay: 0.3, ease: "power2.out",
        });
        focus.savedFilter = null;
      }
      onFocusRef.current?.(false);
    };

    // ── Hit test (solo anclas) ───────────────────────────────────────────────
    let canvasRect = canvas.getBoundingClientRect();
    const refreshRect = () => { canvasRect = canvas.getBoundingClientRect(); };
    const ndc = new THREE.Vector3();

    const hitTest = (clientX, clientY) => {
      const mx = clientX - canvasRect.left;
      const my = clientY - canvasRect.top;
      const w = canvasRect.width;
      const h = canvasRect.height;
      const vFov = (camera.fov * Math.PI) / 180;
      let best = null;
      let bestD = Infinity;

      for (const item of items) {
        if (item.mat.uniforms.uOpacity.value < 0.05) continue;
        if (!visibleGroup(item.group)) continue;
        ndc.copy(item.mesh.position).project(camera);
        if (ndc.z < -1 || ndc.z > 1) continue;
        const dist = camera.position.distanceTo(item.mesh.position);
        if (dist > shared.uFar.value * 0.92) continue;
        const sx = (ndc.x * 0.5 + 0.5) * w;
        const sy = (-ndc.y * 0.5 + 0.5) * h;
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
      if (focus.item || nav.animating) return;
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
      state.maxDist = Math.max(state.maxDist, fitGalaxyDist() * 1.25);
      if (focus.item) placeFocus(focus.item, fitDistFor(focus.item));
    };
    window.addEventListener("resize", onResize);

    const onKeyDown = (e) => {
      if (e.key === "Escape" && focus.item) exitFocus();
    };
    window.addEventListener("keydown", onKeyDown);

    // Solo pausa vídeos: el loop mira `document.hidden` en cada frame en vez de
    // cachearlo, porque si la visibilidad cambia antes de que exista el listener
    // un flag cacheado deja la escena congelada para siempre.
    const onVisibility = () => {
      if (document.hidden) videoItems.forEach((it) => it.video?.pause());
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── API para las pills ───────────────────────────────────────────────────
    apiRef.current = {
      setHover(id) {
        if (focus.item) return;
        const gi = groups.findIndex((g) => g.id === id);
        if (id != null && gi === -1) return;
        setFilter(id == null ? null : gi);
      },
      lock(id) {
        const gi = groups.findIndex((g) => g.id === id);
        if (gi === -1) return;
        if (focus.item) exitFocus();
        setFilter(gi);
        flyTo(centers[gi], ORBIT_DIST);
      },
      reset() {
        if (focus.item) exitFocus();
        setFilter(null);
        flyTo(new THREE.Vector3(), fitGalaxyDist());
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

      const ref = Math.max(state.dist, 8);
      shared.uFogNear.value = ref * FOG_NEAR_K;
      shared.uFogFar.value  = ref * FOG_FAR_K + R * FOG_FAR_R;
      shared.uFar.value     = ref + R * FAR_R;

      if (atlasDirty && performance.now() - atlasStamp > 150) {
        atlasTex.needsUpdate = true;
        atlasDirty = false;
        atlasStamp = performance.now();
      }

      if (frame % 15 === 0) {
        updateLod();
        updateActiveVideos();
      }
      for (const it of videoItems) {
        if (it.active && it.videoTex) it.videoTex.needsUpdate = true;
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
      gsap.killTweensOf(dustMaster);
      items.forEach((it) => {
        gsap.killTweensOf(it.mat.uniforms.uOpacity);
        gsap.killTweensOf(it.mesh.position);
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
      items.forEach((it) => {
        it.mat.dispose();
        it.hiTex?.dispose();
        if (it.videoTex) it.videoTex.dispose();
        if (it.video) {
          it.video.pause();
          it.video.removeAttribute("src");
          it.video.load?.();
          it.video.remove();
        }
      });
      if (dustMesh) {
        dustMesh.geometry.dispose();
        dustMesh.material.dispose();
      }
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
