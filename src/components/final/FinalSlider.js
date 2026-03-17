"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";

// ─── Slide: border-radius SDF + optional video range expansion ─────────────────
const slideVert = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const slideFrag = `
  uniform sampler2D uMap;
  uniform float uExpandRange, uRadius, uAspect;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (uExpandRange > 0.5) { c.rgb=(c.rgb-0.062745)/0.858824; c=clamp(c,0.0,1.0); }
    if (uRadius < 0.001) {
      gl_FragColor = c;
    } else {
      vec2 p = (vUv-0.5); p.x *= uAspect;
      vec2 q = abs(p) - vec2(uAspect*0.5, 0.5) + uRadius;
      float a = smoothstep(0.006,-0.006, length(max(q,0.0))-uRadius);
      if (a < 0.01) discard;
      gl_FragColor = vec4(c.rgb, a);
    }
  }
`;

// ─── Header: transparent canvas texture ───────────────────────────────────────
const headerVert = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const headerFrag = `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.02) discard;
    gl_FragColor = c;
  }
`;

// ─── Data ──────────────────────────────────────────────────────────────────────
const IMAGE_NAMES = [
  ["story1",  "story2",  "story3"],
  ["story4",  "story5",  "story6"],
  ["story7",  "story8",  "story9"],
  ["story10", "story11", "story12"],
  ["story13", "story14", "story15"],
];
const VIDEO_NAMES = [
  "Allthatjazz cinematic©Feb26",
  "ATJ About Cuaderno",
  "ATJ_AboutMotion 02",
  "Playground_Carhartt-WIP_24012026 (1)_1",
  "Portfolio-Gallery-4-5",
];

// ── Etiquetas — edita para que coincidan con tus proyectos ────────────────────
const AQUA_LABELS  = ["Quiet Green",   "Crimson Reign", "Gilded Brow",  "Golden Flight", "Silver Mist"];
const VIDEO_LABELS = ["All That Jazz", "ATJ Cuaderno",  "ATJ Motion",   "Carhartt WIP",  "Portfolio"];

// ─── Component ─────────────────────────────────────────────────────────────────
const FinalSlider = () => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  const { getImage, getVideo, isLoaded } = useOptimizedMedia();

  const resolvedGroups = useMemo(() => {
    if (!isLoaded) return null;
    return IMAGE_NAMES.map((g) => g.map((n) => getImage(n).src));
  }, [isLoaded, getImage]);

  const resolvedVideos = useMemo(() => {
    if (!isLoaded) return null;
    return VIDEO_NAMES.map((n) => getVideo(n));
  }, [isLoaded, getVideo]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!resolvedGroups || !resolvedVideos) return;

    const canvas = canvasRef.current;

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: !isMobile,
      preserveDrawingBuffer: true,
      powerPreference: isMobile ? "default" : "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.position.z = isMobile ? 9.5 : 5;

    // ── Dimensions ───────────────────────────────────────────────────
    const slideWidth  = isMobile ? 4.0 : 2.0;
    const slideHeight = isMobile ? 4.5 : 2.5;
    const slideAspect = slideWidth / slideHeight;
    const isVertical  = isMobile;

    // ─── HEADER TUNABLES ──────────────────────────────────────────────
    const HEADER = {
      height:    isMobile ? 0.50 : 0.24,
      gap:       0,
      padLeft:   16,
      padRight:  16,
      fontSize:  20,
      color:     "#111111",
      font:      '600 {SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacingRatio: -0.045,
    };

    const HEADER_H        = HEADER.height;
    const HEADER_GAP      = HEADER.gap;
    const slideGap        = isMobile ? (HEADER_H + HEADER_GAP + 0.1) : 0.05;

    const HDR_W = 512, HDR_H = 64;

    const BORDER_RADIUS = 0;

    const settings = {
      wheelSensitivity: 0.01, touchSensitivity: 0.024, momentumMultiplier: 4.5,
      smoothing: 0.22, slideLerp: 0.18, distortionDecay: 0.95, maxDistortion: 2.5,
      distortionSensitivity: 0.15, distortionSmoothing: 0.075,
    };

    // ── Simple image switcher (reemplaza AquaSlider con RenderTargets) ──
    const GROUP_COUNT    = resolvedGroups.length;
    const aquaTextures   = [];
    const aquaStates     = [];
    const aquaCurrentTex = []; // textura activa por grupo

    for (let g = 0; g < GROUP_COUNT; g++) {
      const texArr = new Array(resolvedGroups[g].length).fill(null);
      aquaTextures.push(texArr);
      aquaStates.push({ currentIndex: 0, baseScale: { x: 1, y: 1 } });
      aquaCurrentTex.push(null);

      const loader = new THREE.TextureLoader();
      resolvedGroups[g].forEach((src, j) => {
        loader.load(src, (tex) => {
          tex.minFilter = tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.userData = { size: new THREE.Vector2(tex.image.width, tex.image.height) };
          texArr[j] = tex;

          // En cuanto carga la primera imagen del grupo, asignarla como activa
          if (j === 0 || !aquaCurrentTex[g]) {
            aquaCurrentTex[g] = tex;
            // Actualizar el uMap de los slides que usan este grupo
            slides.forEach((s) => {
              if (s.userData.isAqua && s.userData.groupIndex === g)
                s.material.uniforms.uMap.value = tex;
            });
            // Calcular baseScale
            const ts = tex.userData.size;
            const mediaAspect = ts.x / ts.y;
            if (mediaAspect > slideAspect)
              aquaStates[g].baseScale = { x: 1, y: slideAspect / mediaAspect };
            else
              aquaStates[g].baseScale = { x: mediaAspect / slideAspect, y: 1 };
          }
        }, undefined, (e) => console.warn(src, e));
      });
    }

    // ── drawHeader ────────────────────────────────────────────────────
    const headerCanvases = [];
    const headerTextures = [];

    const drawHeader = (uid, counterStr) => {
      const isAqua = uid < GROUP_COUNT;
      const label  = isAqua ? AQUA_LABELS[uid] : VIDEO_LABELS[uid - GROUP_COUNT];
      const c   = headerCanvases[uid];
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, HDR_W, HDR_H);

      const fs   = HEADER.fontSize;
      const font = HEADER.font.replace("{SIZE}", fs);
      ctx.font         = font;
      ctx.fillStyle    = HEADER.color;
      ctx.textBaseline = "middle";
      try { ctx.letterSpacing = `${(fs * HEADER.letterSpacingRatio).toFixed(2)}px`; } catch (_) {}

      ctx.textAlign = "left";
      ctx.fillText(label, HEADER.padLeft, HDR_H / 2);

      if (isAqua && counterStr) {
        ctx.textAlign = "right";
        ctx.fillText(counterStr, HDR_W - HEADER.padRight, HDR_H / 2);
      }
      headerTextures[uid].needsUpdate = true;
    };

    const UNIQUE_COUNT = GROUP_COUNT + VIDEO_NAMES.length; // 10

    for (let uid = 0; uid < UNIQUE_COUNT; uid++) {
      const c = document.createElement("canvas");
      c.width = HDR_W; c.height = HDR_H;
      headerCanvases.push(c);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter  = tex.magFilter = THREE.LinearFilter;
      headerTextures.push(tex);
      const isAqua = uid < GROUP_COUNT;
      const total  = isAqua ? resolvedGroups[uid].length : 0;
      drawHeader(uid, isAqua ? `01\u202F/\u202F${String(total).padStart(2, "0")}` : null);
    }

    // ── advanceAquaGroup — cambio instantáneo sin efecto ─────────────
    const advanceAquaGroup = (g) => {
      const state  = aquaStates[g];
      const texArr = aquaTextures[g];
      if (texArr.some((t) => !t)) return; // esperar a que carguen todas

      const next  = (state.currentIndex + 1) % texArr.length;
      const total = texArr.length;

      // Cambio instantáneo de textura
      aquaCurrentTex[g] = texArr[next];
      slides.forEach((s) => {
        if (s.userData.isAqua && s.userData.groupIndex === g)
          s.material.uniforms.uMap.value = texArr[next];
      });

      // Actualizar counter y baseScale
      drawHeader(g, `${String(next + 1).padStart(2, "0")}\u202F/\u202F${String(total).padStart(2, "0")}`);
      state.currentIndex = next;
      const ts = texArr[next].userData.size;
      const mediaAspect = ts.x / ts.y;
      if (mediaAspect > slideAspect)
        state.baseScale = { x: 1, y: slideAspect / mediaAspect };
      else
        state.baseScale = { x: mediaAspect / slideAspect, y: 1 };
    };

    // ── Videos ────────────────────────────────────────────────────────
    const videos = [], videoTextures = [], videoSrcs = [];
    const pickSrc = (sources) => {
      if (!sources?.length) return null;
      const v = document.createElement("video");
      return (sources.find((s) => v.canPlayType(s.type) !== "") || sources[0])?.src || null;
    };
    const videoBaseScale = VIDEO_NAMES.map(() => ({ x: 1, y: 1 }));
    const videoMetaListeners = [];
    resolvedVideos.forEach(({ sources }, vi) => {
      const src = pickSrc(sources); videoSrcs.push(src);
      const vid = document.createElement("video");
      if (src && !isMobile) vid.src = encodeURI(src);
      vid.muted = true; vid.loop = true; vid.playsInline = true;
      vid.crossOrigin = "anonymous"; vid.preload = isMobile ? "metadata" : "auto";
      const tex = new THREE.VideoTexture(vid);
      tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const onMeta = () => {
        const mediaAspect = vid.videoWidth / vid.videoHeight;
        const slideAspect = slideWidth / slideHeight;
        if (mediaAspect > slideAspect) {
          videoBaseScale[vi] = { x: 1, y: slideAspect / mediaAspect };
        } else {
          videoBaseScale[vi] = { x: mediaAspect / slideAspect, y: 1 };
        }
      };
      vid.addEventListener("loadedmetadata", onMeta);
      videoMetaListeners.push({ vid, onMeta });
      if (!isMobile && src) vid.play().catch(() => {});
      videos.push(vid); videoTextures.push(tex);
    });

    // Móvil: placeholder mientras carga el vídeo
    const phC = document.createElement("canvas"); phC.width = phC.height = 64;
    const phCtx = phC.getContext("2d"); phCtx.fillStyle = "#ffffff"; phCtx.fillRect(0, 0, 64, 64);
    const placeholderTex = new THREE.CanvasTexture(phC);
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    let posterTextures = null, videoLoaded = null, videoLoading = null;
    if (isMobile) {
      posterTextures = resolvedVideos.map(() => placeholderTex.clone());
      videoLoaded    = videoSrcs.map(() => false);
      videoLoading   = videoSrcs.map(() => false);
    }

    // ── Carousel layout ───────────────────────────────────────────────
    const VIDEO_COUNT = VIDEO_NAMES.length;
    const REPEAT      = 2;
    const slideCount  = UNIQUE_COUNT * REPEAT; // 20
    const slideUnit   = isVertical ? slideHeight + slideGap : slideWidth + slideGap;
    const totalSize   = slideCount * slideUnit;
    const wSegs = isMobile ? 1 : 32, hSegs = isMobile ? 1 : 16;

    const slides       = [];
    const headerMeshes = [];
    const raycaster    = new THREE.Raycaster();
    const mouse        = new THREE.Vector2();

    for (let i = 0; i < slideCount; i++) {
      const uid        = i % UNIQUE_COUNT;
      const isAqua     = uid < GROUP_COUNT;
      const groupIndex = isAqua ? uid : null;
      const videoIndex = isAqua ? null : uid - GROUP_COUNT;

      // ── Slide ──────────────────────────────────────────────────────
      const geo = new THREE.PlaneGeometry(slideWidth, slideHeight, wSegs, hSegs);

      // Textura inicial: para aqua usamos placeholderTex hasta que cargue la imagen real
      const slideTex = isAqua
        ? (aquaCurrentTex[groupIndex] ?? placeholderTex)
        : (isMobile ? posterTextures[videoIndex] : videoTextures[videoIndex]);

      const slideMat = new THREE.ShaderMaterial({
        uniforms: {
          uMap:         { value: slideTex },
          uExpandRange: { value: (!isAqua && !isMobile) ? 1.0 : 0.0 },
          uRadius:      { value: BORDER_RADIUS },
          uAspect:      { value: slideAspect },
        },
        vertexShader: slideVert, fragmentShader: slideFrag,
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, slideMat);
      if (isVertical) mesh.position.y = i * slideUnit;
      else            mesh.position.x = i * slideUnit;

      mesh.userData = {
        originalVertices: !isMobile ? [...geo.attributes.position.array] : null,
        index: i, uid, isAqua, groupIndex, videoIndex,
        targetPos: 0, currentPos: 0,
        showingPoster: isMobile && !isAqua,
      };
      scene.add(mesh); slides.push(mesh);

      // ── Header mesh ────────────────────────────────────────────────
      const hGeo = new THREE.PlaneGeometry(slideWidth, HEADER_H, wSegs, hSegs);
      const hMat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: headerTextures[uid] } },
        vertexShader: headerVert, fragmentShader: headerFrag,
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      const hMesh = new THREE.Mesh(hGeo, hMat);
      hMesh.userData = {
        originalVertices: !isMobile ? [...hGeo.attributes.position.array] : null,
        uid,
      };
      scene.add(hMesh); headerMeshes.push(hMesh);
    }

    // Centrar el strip
    slides.forEach((s) => {
      if (isVertical) { s.position.y -= totalSize / 2; }
      else            { s.position.x -= totalSize / 2; }
      s.userData.targetPos = s.userData.currentPos =
        isVertical ? s.position.y : s.position.x;
    });

    // Ahora que slides existe, asignar texturas aqua que ya habían cargado
    for (let g = 0; g < GROUP_COUNT; g++) {
      if (aquaCurrentTex[g]) {
        slides.forEach((s) => {
          if (s.userData.isAqua && s.userData.groupIndex === g)
            s.material.uniforms.uMap.value = aquaCurrentTex[g];
        });
      }
    }

    // Móvil: cargar posters reales
    if (isMobile) {
      resolvedVideos.forEach(({ poster }, vi) => {
        if (!poster) return;
        new THREE.TextureLoader().load(encodeURI(poster), (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter;
          const old = posterTextures[vi]; posterTextures[vi] = tex; if (old) old.dispose();
          const mediaAspect = tex.image.width / tex.image.height;
          const slideAspect = slideWidth / slideHeight;
          if (mediaAspect > slideAspect) {
            videoBaseScale[vi] = { x: 1, y: slideAspect / mediaAspect };
          } else {
            videoBaseScale[vi] = { x: mediaAspect / slideAspect, y: 1 };
          }
          slides.forEach((s) => {
            if (!s.userData.isAqua && s.userData.videoIndex === vi && s.userData.showingPoster)
              s.material.uniforms.uMap.value = tex;
          });
        });
      });
    }

    // ── Desktop distortion ────────────────────────────────────────────
    const updateCurve = (mesh, worldPosX, distFactor, yWorldOffset = 0) => {
      const attr = mesh.geometry.attributes.position;
      const orig = mesh.userData.originalVertices;
      const maxC = settings.maxDistortion * distFactor;
      for (let i = 0; i < attr.count; i++) {
        const lx = orig[i * 3];
        const ly = orig[i * 3 + 1] + yWorldOffset;
        const vx = worldPosX + lx;
        const d  = Math.sqrt(vx * vx + ly * ly);
        let s    = Math.max(0, 1 - d / 2.0);
        s        = Math.pow(s, 1.5);
        attr.setZ(i, Math.sin((s * Math.PI) / 2) * maxC);
      }
      attr.needsUpdate = true;
    };

    // ── Scroll state ──────────────────────────────────────────────────
    let currentPosition = 0, targetPosition = 0;
    let isScrolling = false, autoScrollSpeed = 0, lastTime = 0;
    let touchStartClient = { x: 0, y: 0 }, touchStart = 0, touchLast = 0;
    let currentDistortionFactor = 0, targetDistortionFactor = 0;
    let peakVelocity = 0, velocityHistory = [0, 0, 0, 0, 0];
    let isDragging = false, dragStartAxis = 0;

    const hitSlider = (cx, cy) => {
      mouse.x = (cx / window.innerWidth)  *  2 - 1;
      mouse.y = (cy / window.innerHeight) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(slides);
      if (!hits.length) return;

      // En móvil (isVertical) todos los slides tienen z=0, por lo que el raycaster
      // puede devolver cualquier slide solapado como primero.
      // Seleccionamos el hit cuyo slide está más cercano al centro de la pantalla.
      const aquaHits = hits.filter((h) => h.object.userData.isAqua);
      if (!aquaHits.length) return;

      let best = aquaHits[0];
      if (isVertical && aquaHits.length > 1) {
        let minDist = Infinity;
        aquaHits.forEach((h) => {
          const pos = isVertical ? h.object.position.y : h.object.position.x;
          const d   = Math.abs(pos);
          if (d < minDist) { minDist = d; best = h; }
        });
      }
      advanceAquaGroup(best.object.userData.groupIndex);
    };

    // En móvil el navegador dispara un click sintético ~300ms después del touchend.
    // Usamos un flag para ignorarlo y evitar que advanceAquaGroup se llame dos veces.
    let suppressNextClick = false;

    const handleMouseDown = (e) => { isDragging = false; dragStartAxis = isVertical ? e.clientY : e.clientX; };
    const handleMouseMove = (e) => { if (Math.abs((isVertical ? e.clientY : e.clientX) - dragStartAxis) > 8) isDragging = true; };
    const handleClick     = (e) => {
      if (suppressNextClick) { suppressNextClick = false; return; }
      if (!isDragging) hitSlider(e.clientX, e.clientY);
      isDragging = false;
    };
    const handleKeyDown   = (e) => {
      const bk = isVertical ? e.key === "ArrowUp"   : e.key === "ArrowLeft";
      const fw = isVertical ? e.key === "ArrowDown" : e.key === "ArrowRight";
      if (bk) { targetPosition += slideUnit; targetDistortionFactor = Math.min(1, targetDistortionFactor + 0.3); }
      if (fw) { targetPosition -= slideUnit; targetDistortionFactor = Math.min(1, targetDistortionFactor + 0.3); }
    };
    const handleWheel = (e) => {
      e.preventDefault();
      targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(e.deltaY) * 0.001);
      targetPosition -= e.deltaY * settings.wheelSensitivity;
      isScrolling = true;
      autoScrollSpeed = Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);
      clearTimeout(window._aqh7STO);
      window._aqh7STO = setTimeout(() => { isScrolling = false; }, 150);
    };
    const handleTouchStart = (e) => {
      touchStartClient = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStart = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      touchLast  = touchStart; isScrolling = false;
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      const cur = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      const delta = cur - touchLast; touchLast = cur;
      if (!isMobile) targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(delta) * 0.05);
      targetPosition -= delta * settings.touchSensitivity; isScrolling = true;
    };
    const handleTouchEnd = (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartClient.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartClient.y);
      if (dx < 10 && dy < 10) { suppressNextClick = true; hitSlider(e.changedTouches[0].clientX, e.changedTouches[0].clientY); return; }
      const vel = (touchLast - touchStart) * 0.005;
      if (Math.abs(vel) > 0.15) {
        autoScrollSpeed = -vel * settings.momentumMultiplier * 0.05;
        if (!isMobile) targetDistortionFactor = Math.min(1, Math.abs(vel) * 3 * settings.distortionSensitivity);
        isScrolling = true; setTimeout(() => { isScrolling = false; }, 800);
      }
    };
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    const handleVisibility = () => { if (document.hidden) videos.forEach((v) => v.pause()); };

    canvas.addEventListener("mousedown",  handleMouseDown);
    canvas.addEventListener("mousemove",  handleMouseMove);
    canvas.addEventListener("click",      handleClick);
    window.addEventListener("keydown",    handleKeyDown);
    window.addEventListener("wheel",      handleWheel,      { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove",  handleTouchMove,  { passive: false });
    window.addEventListener("touchend",   handleTouchEnd);
    window.addEventListener("resize",     handleResize);
    document.addEventListener("visibilitychange", handleVisibility);

    // ── Render loop ───────────────────────────────────────────────────
    let animId;
    const animate = (time) => {
      animId = requestAnimationFrame(animate);
      if (document.hidden) return;

      const dt = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime = time;
      const prevPos = currentPosition;

      if (isScrolling) {
        targetPosition  += autoScrollSpeed;
        autoScrollSpeed *= Math.max(0.96, 0.97 - Math.abs(autoScrollSpeed) * 0.5);
        if (Math.abs(autoScrollSpeed) < 0.001) autoScrollSpeed = 0;
      }
      currentPosition += (targetPosition - currentPosition) * settings.smoothing;

      // Distorsión solo desktop
      if (!isMobile) {
        const vel = Math.abs(currentPosition - prevPos) / dt;
        velocityHistory.push(vel); velocityHistory.shift();
        const avg = velocityHistory.reduce((s, v) => s + v, 0) / velocityHistory.length;
        if (avg > peakVelocity) peakVelocity = avg;
        const isDecel = (avg / (peakVelocity + 0.001)) < 0.7 && peakVelocity > 0.5;
        peakVelocity *= 0.99;
        if (vel > 0.05) targetDistortionFactor = Math.max(targetDistortionFactor, Math.min(1, vel * 0.1));
        if (isDecel || avg < 0.2) targetDistortionFactor *= isDecel ? settings.distortionDecay : settings.distortionDecay * 0.9;
        currentDistortionFactor += (targetDistortionFactor - currentDistortionFactor) * settings.distortionSmoothing;
      }

      // Móvil: precalcular qué vídeos tienen copia en rango
      const videoAnyInRange = isMobile ? videoSrcs.map(() => false) : null;
      if (isMobile) {
        slides.forEach((s) => {
          if (s.userData.isAqua) return;
          let bp = s.userData.index * slideUnit - currentPosition;
          bp = ((bp % totalSize) + totalSize) % totalSize;
          if (bp > totalSize / 2) bp -= totalSize;
          if (Math.abs(bp) <= slideUnit * 1.5) videoAnyInRange[s.userData.videoIndex] = true;
        });
      }

      // Posiciones + distorsión
      slides.forEach((slide, i) => {
        let basePos = i * slideUnit - currentPosition;
        basePos = ((basePos % totalSize) + totalSize) % totalSize;
        if (basePos > totalSize / 2) basePos -= totalSize;

        const thresh = isVertical ? slideHeight : slideWidth;
        if (Math.abs(basePos - slide.userData.targetPos) > thresh * 2) slide.userData.currentPos = basePos;
        slide.userData.targetPos   = basePos;
        slide.userData.currentPos += (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;

        if (isVertical) slide.position.y = slide.userData.currentPos;
        else            slide.position.x = slide.userData.currentPos;

        const worldPos = isVertical ? slide.position.y : slide.position.x;
        const hMesh    = headerMeshes[i];

        if (isMobile) {
          slide.position.z = 0;
          const bs = slide.userData.isAqua ? aquaStates[slide.userData.groupIndex].baseScale : videoBaseScale[slide.userData.videoIndex];
          slide.scale.set(bs.x, bs.y, 1);
          slide.rotation.x = 0;
          const headerY = slide.userData.currentPos + (slideHeight / 2) * bs.y + HEADER_GAP + HEADER_H / 2;
          hMesh.position.set(slide.position.x, headerY, 0);
          hMesh.scale.set(bs.x, 1, 1);

          if (!slide.userData.isAqua) {
            const vi = slide.userData.videoIndex, vid = videos[vi];
            const dist = Math.abs(basePos), inRange = dist <= slideUnit * 1.5, far = dist > slideUnit * 2.5;
            if (far && videoLoaded[vi] && !videoAnyInRange[vi]) {
              vid.pause(); vid.src = ""; vid.load(); videoLoaded[vi] = false;
              slides.forEach((s) => {
                if (!s.userData.isAqua && s.userData.videoIndex === vi) {
                  s.material.uniforms.uMap.value = posterTextures[vi];
                  s.material.uniforms.uExpandRange.value = 0;
                  s.userData.showingPoster = true;
                }
              });
            } else if (inRange && !videoLoaded[vi] && !videoLoading[vi] && videoSrcs[vi]) {
              videoLoading[vi] = true; vid.src = encodeURI(videoSrcs[vi]); vid.load();
              const ok  = () => {
                vid.removeEventListener("canplay", ok); vid.removeEventListener("error", err);
                videoLoaded[vi] = true; videoLoading[vi] = false;
                slides.forEach((s) => {
                  if (!s.userData.isAqua && s.userData.videoIndex === vi) {
                    s.material.uniforms.uMap.value = videoTextures[vi];
                    s.material.uniforms.uExpandRange.value = 1;
                    s.userData.showingPoster = false;
                  }
                });
                vid.play().catch(() => {});
              };
              const err = () => {
                vid.removeEventListener("canplay", ok); vid.removeEventListener("error", err);
                videoLoading[vi] = false;
              };
              vid.addEventListener("canplay", ok); vid.addEventListener("error", err);
            } else if (inRange && videoLoaded[vi] && vid.paused) { vid.play().catch(() => {}); }
            else if (!inRange && videoLoaded[vi] && !far && !vid.paused) { vid.pause(); }
          }
        } else {
          // Desktop: z-push + CPU vertex distortion
          slide.position.z += (-0.8 - slide.position.z) * 0.1;
          const bs = slide.userData.isAqua ? aquaStates[slide.userData.groupIndex].baseScale : videoBaseScale[slide.userData.videoIndex];
          slide.scale.set(bs.x, bs.y, 1);
          updateCurve(slide, worldPos, currentDistortionFactor, 0);

          const headerY = (slideHeight / 2) * bs.y + HEADER_GAP + HEADER_H / 2;
          hMesh.position.set(slide.userData.currentPos, headerY, slide.position.z);
          hMesh.scale.set(bs.x, 1, 1);
          updateCurve(hMesh, worldPos, currentDistortionFactor, headerY);
        }
      });

      // Render
      renderer.render(scene, camera);
    };

    animate(0);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown",  handleMouseDown);
      canvas.removeEventListener("mousemove",  handleMouseMove);
      canvas.removeEventListener("click",      handleClick);
      window.removeEventListener("keydown",    handleKeyDown);
      window.removeEventListener("wheel",      handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove",  handleTouchMove);
      window.removeEventListener("touchend",   handleTouchEnd);
      window.removeEventListener("resize",     handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      // Limpiar texturas aqua
      aquaTextures.forEach((arr) => arr.forEach((t) => t?.dispose()));
      headerTextures.forEach((t) => t.dispose());
      slides.forEach((s)       => { s.geometry.dispose(); s.material.dispose(); });
      headerMeshes.forEach((h) => { h.geometry.dispose(); h.material.dispose(); });
      videoMetaListeners.forEach(({ vid, onMeta }) => vid.removeEventListener("loadedmetadata", onMeta));
      videos.forEach((v) => { v.pause(); v.src = ""; v.load(); });
      videoTextures.forEach((t) => t.dispose());
      if (posterTextures) posterTextures.forEach((t) => t?.dispose?.());
      placeholderTex.dispose();
      renderer.dispose();
    };
  }, [isMobile, resolvedGroups, resolvedVideos]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", cursor: "pointer" }}
      data-aqua-canvas="true"
    />
  );
};

export default FinalSlider;