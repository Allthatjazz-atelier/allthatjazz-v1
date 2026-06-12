"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";

// ─── Media (misma fuente que la vista slider FinalSlider4) ──────────────────────
const IMAGE_NAMES = Array.from({ length: 15 }, (_, i) => `story${i + 1}`);
const VIDEO_NAMES = [
  "Allthatjazz cinematic©Feb26",
  "ATJ About Cuaderno",
  "ATJ_AboutMotion 02",
  "Playground_Carhartt-WIP_24012026 (1)_1",
  "Portfolio-Gallery-4-5",
];

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

// Fragment: muestrea la textura (imagen o vídeo) y aplica la banda de visibilidad
// por profundidad. Fuera de la banda → invisible (discard, ahorra fillrate). En los
// extremos funde hacia el fondo blanco (mismo lenguaje visual que los placeholders).
// Como el aspect del quad == aspect de la textura, el UV es directo: sin distorsión.
const FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vDepth;

  uniform sampler2D uTex;
  uniform float uVisNearEnd;
  uniform float uVisNear;
  uniform float uVisFarStart;
  uniform float uVisFarEnd;
  uniform vec3  uBgColor;

  void main() {
    float farMask  = 1.0 - smoothstep(uVisFarStart, uVisFarEnd, vDepth);
    float nearMask = smoothstep(uVisNearEnd, uVisNear, vDepth);
    float vis = farMask * nearMask;

    if (vis < 0.005) discard;

    vec4 texel = texture2D(uTex, vUv);
    // Funde la imagen hacia el fondo según visibilidad → opaco, sin problemas de orden.
    vec3 col = mix(uBgColor, texel.rgb, vis);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Componente ────────────────────────────────────────────────────────────────
export default function Space3D({
  count   = 150,
  box     = { x: 40, y: 22, z: 40 },
  damping = 0.085,

  visNearEnd  = 1.0,
  visNear     = 4.0,
  visFarStart = 28.0,
  visFarEnd   = 50.0,
} = {}) {
  const canvasRef = useRef(null);

  const { getImage, getVideo, isLoaded } = useOptimizedMedia();
  // Capturamos los resolvers en refs para construir la media UNA vez (cuando carga
  // el manifest) y NO reconstruir toda la escena en cada resize (el hook recalcula
  // capabilities en cada resize, lo que cambiaría la identidad de getImage/getVideo).
  const getImageRef = useRef(getImage);
  const getVideoRef = useRef(getVideo);
  getImageRef.current = getImage;
  getVideoRef.current = getVideo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded) return;

    const isMobile = window.innerWidth <= 768;

    // Resolución de media (optimizada por dispositivo) — capturada al construir.
    const imageSrcs = IMAGE_NAMES.map((n) => getImageRef.current(n).src);
    const videoData = VIDEO_NAMES.map((n) => {
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
      Math.max(box.x, box.z) * 3,
    );

    // ── Recursos compartidos ─────────────────────────────────────────────────────
    const plane = new THREE.PlaneGeometry(1, 1); // una sola geometría para todos
    const loader = new THREE.TextureLoader();

    // Textura placeholder blanca (1×1): invisible sobre el fondo blanco hasta que
    // la imagen real cargue → cero "flash" negro.
    const placeholderTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat,
    );
    placeholderTex.needsUpdate = true;

    // Caché de texturas de imagen por src → se cargan UNA vez y se comparten entre
    // todas las mallas que usan la misma media (mínima memoria de GPU).
    const texCache = new Map();   // src -> { tex, aspect }
    const texWaiting = new Map(); // src -> [cb]

    const configureImageTexture = (tex) => {
      tex.colorSpace      = THREE.SRGBColorSpace;
      tex.anisotropy      = maxAniso;
      tex.generateMipmaps = true; // calidad al verse pequeñas/lejos (WebGL2: NPOT OK)
      tex.minFilter       = THREE.LinearMipmapLinearFilter;
      tex.magFilter       = THREE.LinearFilter;
    };

    const loadImage = (src, cb) => {
      if (!src) return;
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
        () => texWaiting.delete(src),
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
    // Repartimos: la mayoría imágenes + unos pocos slots de vídeo (cada vídeo ~2
    // veces). Solo 1-2 vídeos se reproducen a la vez (ver gestión más abajo).
    const videoSlotCount = Math.min(count, videoData.length * 2);
    const videoSlots = new Set();
    while (videoSlots.size < videoSlotCount) {
      videoSlots.add(Math.floor(Math.random() * count));
    }
    const slotArr = [...videoSlots];

    const items = [];
    const videoItems = [];
    const videoEls = [];

    for (let i = 0; i < count; i++) {
      const scaleBase = 0.9 + Math.random() * 1.4; // 0.9..2.3

      const uniforms = {
        uTex:         { value: placeholderTex },
        uSize:        { value: new THREE.Vector2(scaleBase, scaleBase) },
        uVisNearEnd:  { value: visNearEnd },
        uVisNear:     { value: visNear },
        uVisFarStart: { value: visFarStart },
        uVisFarEnd:   { value: visFarEnd },
        uBgColor:     { value: new THREE.Color(0xffffff) },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
      });

      const mesh = new THREE.Mesh(plane, mat);
      mesh.position.set(
        (Math.random() - 0.5) * box.x,
        (Math.random() - 0.5) * box.y,
        (Math.random() - 0.5) * box.z,
      );
      mesh.frustumCulled = false;
      scene.add(mesh);

      const item = { mesh, mat, scaleBase, type: "image", active: false };
      items.push(item);

      const vIdx = slotArr.indexOf(i);
      if (vIdx !== -1) {
        const vd = videoData[vIdx % videoData.length];
        item.type    = "video";
        item.sources = vd.sources;
        item.poster  = vd.poster;
        item.posterTex = null;
        item.video     = null;
        item.videoTex  = null;
        videoItems.push(item);
        // Póster estático por defecto (mientras no es uno de los activos).
        if (vd.poster) {
          loadImage(vd.poster, ({ tex, aspect }) => {
            item.posterTex = tex;
            if (!item.active) item.mat.uniforms.uTex.value = tex;
            applyAspect(item, aspect);
          });
        }
      } else {
        const src = imageSrcs[i % imageSrcs.length];
        item.src = src;
        loadImage(src, ({ tex, aspect }) => {
          item.mat.uniforms.uTex.value = tex;
          applyAspect(item, aspect);
        });
      }
    }

    // ── Gestión de vídeo (decodes capados) ───────────────────────────────────────
    const MAX_ACTIVE_VIDEOS = isMobile ? 1 : 2;

    const activateVideo = (item) => {
      if (!item.video) {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = "auto";
        vid.crossOrigin = "anonymous";
        const src = item.sources?.[0]?.src;
        if (src) vid.src = src;
        vid.style.display = "none";
        document.body.appendChild(vid);

        const vtex = new THREE.VideoTexture(vid);
        vtex.colorSpace = THREE.SRGBColorSpace;
        vtex.minFilter = THREE.LinearFilter;
        vtex.magFilter = THREE.LinearFilter;
        vtex.generateMipmaps = false;

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
      item.video.play().catch(() => {});
    };

    const deactivateVideo = (item) => {
      if (!item.active) return;
      item.active = false;
      if (item.video) item.video.pause();
      item.mat.uniforms.uTex.value = item.posterTex || placeholderTex;
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
    const PITCH_LIMIT = Math.PI / 2 - 0.05;
    const startDist = (visNear + visFarStart) * 0.5;
    const maxDist = visFarStart + box.z * 0.5;

    const state = {
      yaw: 0, pitch: 0, dist: startDist,
      targetYaw: 0, targetPitch: 0, targetDist: startDist,
      minDist: 0.8, maxDist,
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

    // ── Wheel: zoom exponencial ────────────────────────────────────────────────
    const onWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(dy * 0.001);
      state.targetDist = Math.max(state.minDist, Math.min(state.maxDist, state.targetDist * factor));
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
        const factor = pinchStartDist / d;
        state.targetDist = Math.max(state.minDist, Math.min(state.maxDist, pinchStartCamDist * factor));
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
