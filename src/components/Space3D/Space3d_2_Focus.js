"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { SPACE_IMAGES, ALL_VIDEOS } from "@/data/mediaCatalog";

const IMAGE_NAMES = SPACE_IMAGES;
const VIDEO_NAMES = ALL_VIDEOS;

// ─── Shaders ───────────────────────────────────────────────────────────────────
// Vertex: billboard por-malla (siempre mira a cámara). El centro del quad es el
// origen del mesh transformado a vista; el quad se extiende en el plano de vista.
const VERT = /* glsl */ `
  uniform vec2 uSize;       // tamaño del quad en mundo (ancho, alto) — ya con aspect real
  varying vec2  vUv;
  varying float vDepth;     // distancia del centro a la cámara

  void main() {
    vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mvPos    = mvCenter + vec4(position.xy * uSize, 0.0, 0.0);
    gl_Position   = projectionMatrix * mvPos;

    vUv    = uv;
    vDepth = -mvCenter.z;
  }
`;

// Fragment: muestrea la textura (imagen o vídeo) y la muestra solo dentro de la
// banda de profundidad. Fuera del rango → discard instantáneo (sin fundido).
// Como el aspect del quad == aspect de la textura, el UV es directo: sin distorsión.
const FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vDepth;

  uniform sampler2D uTex;
  uniform float uVisNear;
  uniform float uVisFarStart;
  uniform float uFlipV;     // 1 = invertir V (VideoTexture con flipY=false)

  void main() {
    if (vDepth < uVisNear || vDepth > uVisFarStart) discard;

    vec2 uv = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, uFlipV));
    vec4 texel = texture2D(uTex, uv);
    gl_FragColor = vec4(texel.rgb, 1.0);
  }
`;

// ─── Componente ────────────────────────────────────────────────────────────────
export default function Space3D_2_Focus({
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
  // Capturamos los resolvers en refs para construir la media UNA vez (cuando carga
  // el manifest) y NO reconstruir toda la escena en cada resize (el hook recalcula
  // capabilities en cada resize, lo que cambiaría la identidad de getImage/getVideo).
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

    // Resolución de media (optimizada por dispositivo) — capturada al construir.
    // Fuente: todas las imágenes del manifiesto (new-assets), no un subconjunto.
    // WebGL: preferimos JPEG. AVIF es HEIF y en Chrome acaba en texImage3D+FLIP_Y.
    const isHeic = (p) => /\.hei[cf]$/i.test(p || "");
    const isWebglSafe = (p) => p && !isHeic(p) && !/\.avif$/i.test(p);
    const imageNames = imageIdsRef.current.length ? imageIdsRef.current : IMAGE_NAMES;
    const imageSrcs = imageNames
      .map((n) => {
        const img = getImageRef.current(n);
        const jpg = isWebglSafe(img.fallback) ? img.fallback : null;
        const src = isWebglSafe(img.src) ? img.src : null;
        return { src: jpg || src, fallback: jpg && src && jpg !== src ? src : null };
      })
      .filter((img) => img.src);
    const videoNames = videoIdsRef.current.length ? videoIdsRef.current : VIDEO_NAMES;
    const videoData = videoNames.map((n) => {
      const v = getVideoRef.current(n);
      return { sources: v.sources, poster: v.poster };
    });

    // ── Renderer ───────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      // Necesario para la captura 2D del modal About (HeaderFooter16).
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xffffff, 1);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      Math.max(box.x, box.z) * 4,
    );

    // ── Recursos compartidos ─────────────────────────────────────────────────────
    const plane = new THREE.PlaneGeometry(1, 1); // una sola geometría para todos
    const loader = new THREE.TextureLoader();

    // Textura placeholder blanca (1×1): invisible sobre el fondo blanco hasta que
    // la imagen real cargue → cero "flash" negro.
    const placeholderTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat,
    );
    placeholderTex.flipY = false;
    placeholderTex.premultiplyAlpha = false;
    placeholderTex.generateMipmaps = false;
    placeholderTex.minFilter = THREE.NearestFilter;
    placeholderTex.magFilter = THREE.NearestFilter;
    placeholderTex.needsUpdate = true;

    // Caché de texturas de imagen por src → se cargan UNA vez y se comparten entre
    // todas las mallas que usan la misma media (mínima memoria de GPU).
    const texCache = new Map();   // src -> { tex, aspect }
    const texWaiting = new Map(); // src -> [cb]

    const configureImageTexture = (tex) => {
      tex.colorSpace        = THREE.SRGBColorSpace;
      tex.anisotropy        = maxAniso;
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

    // Ajusta el tamaño del quad al aspect real, preservando área (sqrt) para que
    // landscapes y portraits ocupen un área visual parecida.
    const applyAspect = (item, aspect) => {
      const ar = Math.min(2.6, Math.max(0.4, aspect));
      const s  = Math.sqrt(ar);
      item.mat.uniforms.uSize.value.set(item.scaleBase * s, item.scaleBase / s);
    };

    // ── Construcción de mallas ───────────────────────────────────────────────────
    // Cada imagen dos veces + todos los vídeos una. Las copias se colocan lejos
    // entre sí (best-candidate); no es random puro, que agrupa gemelos.
    const IMAGE_COPIES = 2;
    const slots = [
      ...imageSrcs.flatMap((img) =>
        Array.from({ length: IMAGE_COPIES }, () => ({
          type: "image",
          src: img.src,
          fallback: img.fallback,
        })),
      ),
      ...videoData.map((vd) => ({ type: "video", sources: vd.sources, poster: vd.poster })),
    ];
    const total = typeof count === "number" ? Math.min(count, slots.length) : slots.length;
    const limitedSlots = slots.slice(0, total);

    const slotKey = (slot) =>
      slot.type === "video"
        ? `v:${slot.sources?.[0]?.src || slot.poster || ""}`
        : `i:${slot.src}`;

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

    for (const { slot, pos } of placed) {
      const scaleBase = 1.15 + Math.random() * 1.35; // 1.15..2.5

      const uniforms = {
        uTex:         { value: placeholderTex },
        uSize:        { value: new THREE.Vector2(scaleBase, scaleBase) },
        uVisNear:     { value: visNear },
        uVisFarStart: { value: visFarStart },
        uFlipV:       { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
      });

      const mesh = new THREE.Mesh(plane, mat);
      mesh.position.copy(pos);
      mesh.frustumCulled = false;
      scene.add(mesh);

      const item = { mesh, mat, scaleBase, type: slot.type, active: false };
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
        item.src = slot.src;
        loadImage(slot.src, ({ tex, aspect }) => {
          item.mat.uniforms.uTex.value = tex;
          applyAspect(item, aspect);
        }, slot.fallback);
      }
    }

    // ── Gestión de vídeo (decodes capados) ───────────────────────────────────────
    // Todos los vídeos están en escena (póster). Decodes en vivo: 2 móvil / 4 desktop.
    // Reproducir todos a la vez satura el decoder (Safari móvil se ahoga con 3+).
    const MAX_ACTIVE_VIDEOS = isMobile ? 2 : 4;

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
        // Chrome WebGL2: FLIP_Y + PREMULTIPLY_ALPHA no están permitidos en
        // texImage3D (ruta interna de algunos vídeos/HEIF). Flip en el shader.
        vtex.flipY = false;
        vtex.premultiplyAlpha = false;

        vid.addEventListener("loadedmetadata", () => {
          if (vid.videoWidth && vid.videoHeight) {
            applyAspect(item, vid.videoWidth / vid.videoHeight);
          }
        });

        item.video = vid;
        item.videoTex = vtex;
        videoEls.push(vid);
      }
      item.active = true;
      item.mat.uniforms.uTex.value = item.videoTex;
      item.mat.uniforms.uFlipV.value = 1;
      item.video.play().catch(() => {});
    };

    const deactivateVideo = (item) => {
      if (!item.active) return;
      item.active = false;
      if (item.video) item.video.pause();
      item.mat.uniforms.uTex.value = item.posterTex || placeholderTex;
      item.mat.uniforms.uFlipV.value = 0;
    };

    const updateActiveVideos = () => {
      if (!videoItems.length) return;
      const cam = camera.position;
      const ranked = videoItems
        .map((it) => ({ it, d: cam.distanceTo(it.mesh.position) }))
        .filter((o) => o.d >= visNear * 0.7 && o.d <= visFarStart * 1.15)
        .sort((a, b) => a.d - b.d);

      const activeSet = new Set(ranked.slice(0, MAX_ACTIVE_VIDEOS).map((o) => o.it));
      for (const it of videoItems) {
        if (activeSet.has(it)) { if (!it.active) activateVideo(it); }
        else { if (it.active) deactivateVideo(it); }
      }
    };

    // ── Cámara orbital con inercia ─────────────────────────────────────────────
    // Zoom hacia dentro hasta un tope delante del origen (nunca lo atraviesa).
    // visNear descarta las fotos que se te echan encima, así el fondo gana protagonismo.
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

    // ── Drag para rotar ────────────────────────────────────────────────────────
    const drag = { active: false, x: 0, y: 0 };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      drag.active = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      const k = 0.005;
      state.targetYaw   -= dx * k;
      state.targetPitch += dy * k;
      state.targetPitch  = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.targetPitch));
    };

    const onPointerUp = (e) => {
      drag.active = false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* ok */ }
      canvas.style.cursor = "grab";
    };

    // ── Wheel: avance lineal por el eje de vista, acotado al tope ──────────────
    const onWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      state.targetDist = Math.max(
        state.minDist,
        Math.min(state.maxDist, state.targetDist + dy * 0.018),
      );
    };

    // ── Pinch zoom móvil ───────────────────────────────────────────────────────
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

    // ── Resize ─────────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Visibility pause ───────────────────────────────────────────────────────
    let visible = !document.hidden;
    const onVisibility = () => {
      visible = !document.hidden;
      // Al ocultar la pestaña pausamos los vídeos activos; al volver, el bucle los
      // reactiva según cercanía.
      if (document.hidden) videoItems.forEach((it) => it.video?.pause());
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── RAF ────────────────────────────────────────────────────────────────────
    let raf = 0;
    let frame = 0;
    let readyDispatched = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;

      state.yaw   += (state.targetYaw   - state.yaw)   * damping;
      state.pitch += (state.targetPitch - state.pitch) * damping;
      state.dist  += (state.targetDist  - state.dist)  * damping;
      applyCamera();

      // Reevaluar qué vídeos están activos cada ~12 frames (evita churn).
      if (frame % 12 === 0) updateActiveVideos();
      // Forzar subida de frame solo de los vídeos activos (1-2 como máximo).
      for (const it of videoItems) {
        if (it.active && it.videoTex) it.videoTex.needsUpdate = true;
      }
      frame++;

      renderer.render(scene, camera);

      // 2b: avisar a RouteTransition de que la escena ya pintó su primer frame.
      if (!readyDispatched) {
        readyDispatched = true;
        window.dispatchEvent(new CustomEvent("atj-scene-ready"));
      }
    };
    raf = requestAnimationFrame(tick);

    canvas.style.cursor = "grab";

    // ── Cleanup ────────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
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
