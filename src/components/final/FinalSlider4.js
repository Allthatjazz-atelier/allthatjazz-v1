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

// ── Etiquetas ─────────────────────────────────────────────────────────────────
const AQUA_LABELS  = ["Quiet Green",   "Crimson Reign", "Gilded Brow",  "Golden Flight", "Silver Mist"];
const VIDEO_LABELS = ["All That Jazz", "ATJ Cuaderno",  "ATJ Motion",   "Carhartt WIP",  "Portfolio"];

// ─── CSS caption styles (inyectadas una sola vez) ──────────────────────────────
const CAPTION_CSS = `
  .slide-caption__label,
  .slide-caption__counter {
    position: fixed;
    pointer-events: none;
    font: 800 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: -0.045em;
    color: #111;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.18s ease;
    z-index: 9999;
    transform: translateY(calc(-100% - 6px));
  }
  .slide-caption__label.visible,
  .slide-caption__counter.visible {
    opacity: 1;
  }
  .slide-caption__counter {
    opacity: 0;
  }
  .slide-caption__counter.visible {
    opacity: 1;
  }
  /* Móvil — misma tipografía, posicionado en esquinas superiores del slide */
  .slide-caption--mobile {
    position: fixed;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font: 800 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: -0.045em;
    color: #111;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.18s ease;
    z-index: 9999;
  }
  .slide-caption--mobile.visible {
    opacity: 1;
  }
  .slide-caption--mobile .slide-caption__counter {
    position: static;
    transform: none;
    opacity: 1;
  }
`;

// ─── Component ─────────────────────────────────────────────────────────────────
const FinalSlider4 = () => {
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);
  // Inicializar con el valor real para evitar el doble ciclo del useEffect
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );

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

  // ── Inyectar CSS una sola vez ─────────────────────────────────────
  useEffect(() => {
    // Siempre reemplazar — garantiza que los estilos móvil estén presentes
    const existing = document.getElementById("slide-caption-styles");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "slide-caption-styles";
    style.textContent = CAPTION_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!resolvedGroups || !resolvedVideos) return;

    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;

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
    camera.position.z = isMobile ? 8.0 : 5;

    // ── Dimensions ───────────────────────────────────────────────────
    const slideWidth  = isMobile ? 4.2 : 2.0;
    const slideHeight = isMobile ? 4.725 : 2.5;
    const slideAspect = slideWidth / slideHeight;
    const isVertical  = false; // horizontal en ambos
    const slideGap    = isMobile ? 0.02 : 0.05;

    const BORDER_RADIUS = 0;

    const settings = {
      wheelSensitivity: 0.01, touchSensitivity: 0.024, momentumMultiplier: 4.5,
      smoothing: 0.22, slideLerp: 0.18, distortionDecay: 0.95, maxDistortion: 2.5,
      distortionSensitivity: 0.15, distortionSmoothing: 0.075,
    };

    // ── Caption HTML elements (uno por uid, solo desktop) ─────────────
    const GROUP_COUNT  = resolvedGroups.length;
    const UNIQUE_COUNT = GROUP_COUNT + VIDEO_NAMES.length; // 10

    // captionEls[uid] → { label, counter } — dos elementos independientes
    // label   → esquina superior izquierda del slide
    // counter → esquina superior derecha del slide (solo slides aqua)
    const captionEls = [];

    for (let uid = 0; uid < UNIQUE_COUNT; uid++) {
      const isAqua = uid < GROUP_COUNT;
      const label  = isAqua ? AQUA_LABELS[uid] : VIDEO_LABELS[uid - GROUP_COUNT];

      if (!isMobile) {
        // Desktop: dos spans independientes en el overlay
        const labelEl = document.createElement("span");
        labelEl.className = "slide-caption__label";
        labelEl.textContent = label;
        overlay.appendChild(labelEl);

        let counterEl = null;
        if (isAqua) {
          counterEl = document.createElement("span");
          counterEl.className = "slide-caption__counter";
          const total = resolvedGroups[uid].length;
          counterEl.textContent = `01 / ${String(total).padStart(2, "0")}`;
          overlay.appendChild(counterEl);
        }

        captionEls.push({ label: labelEl, counter: counterEl, mobileEl: null });
      } else {
        // Movil: un div unico centrado, anadido al body
        const mobileEl = document.createElement("div");
        mobileEl.className = "slide-caption--mobile";

        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        mobileEl.appendChild(labelSpan);

        let counterSpan = null;
        if (isAqua) {
          counterSpan = document.createElement("span");
          counterSpan.className = "slide-caption__counter";
          const total = resolvedGroups[uid].length;
          counterSpan.textContent = `1/${total}`;
          mobileEl.appendChild(counterSpan);
        }

        document.body.appendChild(mobileEl);
        captionEls.push({ label: null, counter: counterSpan, mobileEl });
      }
    }

    // Helper: actualizar counter de un grupo aqua
    const updateCaptionCounter = (g, nextIdx, total) => {
      const counter = captionEls[g]?.counter;
      if (counter)
        counter.textContent = `${nextIdx + 1}/${total}`;
    };

    // ── Simple image switcher ─────────────────────────────────────────
    const aquaTextures   = [];
    const aquaStates     = [];
    const aquaCurrentTex = [];

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
          if (j === 0 || !aquaCurrentTex[g]) {
            aquaCurrentTex[g] = tex;
            // Actualizar slides ya construidos
            slides.forEach((s) => {
              if (s.userData.isAqua && s.userData.groupIndex === g)
                s.material.uniforms.uMap.value = tex;
            });
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

    // ── advanceAquaGroup — cambio instantáneo ─────────────────────────
    const advanceAquaGroup = (g) => {
      const state  = aquaStates[g];
      const texArr = aquaTextures[g];
      if (texArr.some((t) => !t)) return;

      const next  = (state.currentIndex + 1) % texArr.length;
      const total = texArr.length;

      aquaCurrentTex[g] = texArr[next];
      slides.forEach((s) => {
        if (s.userData.isAqua && s.userData.groupIndex === g)
          s.material.uniforms.uMap.value = texArr[next];
      });

      updateCaptionCounter(g, next, total);
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
        if (mediaAspect > slideAspect)
          videoBaseScale[vi] = { x: 1, y: slideAspect / mediaAspect };
        else
          videoBaseScale[vi] = { x: mediaAspect / slideAspect, y: 1 };
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
    const REPEAT     = 2;
    const slideCount = UNIQUE_COUNT * REPEAT; // 20
    const slideUnit  = isVertical ? slideHeight + slideGap : slideWidth + slideGap;
    const totalSize  = slideCount * slideUnit;
    const wSegs = isMobile ? 12 : 32, hSegs = isMobile ? 8 : 16;

    const slides    = [];
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const projVec   = new THREE.Vector3(); // reutilizado para proyección

    for (let i = 0; i < slideCount; i++) {
      const uid        = i % UNIQUE_COUNT;
      const isAqua     = uid < GROUP_COUNT;
      const groupIndex = isAqua ? uid : null;
      const videoIndex = isAqua ? null : uid - GROUP_COUNT;

      const geo = new THREE.PlaneGeometry(slideWidth, slideHeight, wSegs, hSegs);
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
        originalVertices: [...geo.attributes.position.array], // necesario para distorsión en móvil también
        index: i, uid, isAqua, groupIndex, videoIndex,
        targetPos: 0, currentPos: 0,
        showingPoster: isMobile && !isAqua,
      };
      scene.add(mesh); slides.push(mesh);
    }

    // Centrar el strip
    slides.forEach((s) => {
      if (isVertical) { s.position.y -= totalSize / 2; }
      else            { s.position.x -= totalSize / 2; }
      s.userData.targetPos = s.userData.currentPos =
        isVertical ? s.position.y : s.position.x;
    });

    // Asignar texturas aqua que ya hubieran cargado antes de construir los slides
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
          if (mediaAspect > slideAspect)
            videoBaseScale[vi] = { x: 1, y: slideAspect / mediaAspect };
          else
            videoBaseScale[vi] = { x: mediaAspect / slideAspect, y: 1 };
          slides.forEach((s) => {
            if (!s.userData.isAqua && s.userData.videoIndex === vi && s.userData.showingPoster)
              s.material.uniforms.uMap.value = tex;
          });
        });
      });
    }

    // ── Desktop distortion ────────────────────────────────────────────
    const updateCurve = (mesh, worldPosX, distFactor) => {
      const attr = mesh.geometry.attributes.position;
      const orig = mesh.userData.originalVertices;
      const maxC = settings.maxDistortion * distFactor;
      for (let i = 0; i < attr.count; i++) {
        const lx = orig[i * 3];
        const ly = orig[i * 3 + 1];
        const vx = worldPosX + lx;
        const d  = Math.sqrt(vx * vx + ly * ly);
        let s    = Math.max(0, 1 - d / 2.0);
        s        = Math.pow(s, 1.5);
        attr.setZ(i, Math.sin((s * Math.PI) / 2) * maxC);
      }
      attr.needsUpdate = true;
    };

    // ── Proyección 3D → px pantalla: esquinas superiores del slide ─────
    // Proyecta el vértice superior-izquierdo y superior-derecho del slide
    // teniendo en cuenta el scale real (bs) para el ancho y el alto.
    const projectTopCorners = (slide, bs) => {
      const halfW = (slideWidth  / 2) * bs.x;
      const topY  = slide.position.y + (slideHeight / 2) * bs.y;

      projVec.set(slide.position.x - halfW, topY, slide.position.z);
      projVec.project(camera);
      const left = {
        x: ( projVec.x * 0.5 + 0.5) * window.innerWidth,
        y: (-projVec.y * 0.5 + 0.5) * window.innerHeight,
      };

      projVec.set(slide.position.x + halfW, topY, slide.position.z);
      projVec.project(camera);
      const right = {
        x: ( projVec.x * 0.5 + 0.5) * window.innerWidth,
        y: (-projVec.y * 0.5 + 0.5) * window.innerHeight,
      };

      return { left, right };
    };

    // ── Hover state (solo desktop) ────────────────────────────────────
    // Guardamos el uid actualmente bajo el cursor (-1 = ninguno).
    // No se oculta el caption al hacer click — solo al salir el cursor.
    let hoveredUid = -1;

    const updateHover = (cx, cy) => {
      mouse.x = (cx / window.innerWidth)  *  2 - 1;
      mouse.y = (cy / window.innerHeight) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(slides);
      const newUid = hits.length > 0 ? hits[0].object.userData.uid : -1;

      if (newUid !== hoveredUid) {
        if (hoveredUid !== -1) {
          captionEls[hoveredUid]?.label?.classList.remove("visible");
          captionEls[hoveredUid]?.counter?.classList.remove("visible");
        }
        hoveredUid = newUid;
        if (hoveredUid !== -1) {
          captionEls[hoveredUid]?.label?.classList.add("visible");
          captionEls[hoveredUid]?.counter?.classList.add("visible");
        }
      }
    };

    // ── Scroll / input state ──────────────────────────────────────────
    let currentPosition = 0, targetPosition = 0;
    let isScrolling = false, autoScrollSpeed = 0, lastTime = 0;
    let touchStartClient = { x: 0, y: 0 }, touchStart = 0, touchLast = 0;
    let currentDistortionFactor = 0, targetDistortionFactor = 0;
    let peakVelocity = 0, velocityHistory = [0, 0, 0, 0, 0];
    let isDragging = false, dragStartAxis = 0;
    let suppressNextClick = false;
    let touchStartPosition = 0; // posición al inicio del touch — para snap de origen

    // ── Móvil: caption visible al tocar, se oculta tras 2s ───────────
    let mobileCaptionUid = -1;
    let mobileCaptionTimer = null;

    const showMobileCaption = (uid, slide) => {
      // Ocultar el anterior si es diferente
      if (mobileCaptionUid !== -1 && mobileCaptionUid !== uid) {
        captionEls[mobileCaptionUid]?.mobileEl?.classList.remove("visible");
      }
      mobileCaptionUid = uid;
      clearTimeout(mobileCaptionTimer);

      const cap = captionEls[uid];
      if (!cap?.mobileEl) return;

      // Proyectar las esquinas superiores del slide igual que en desktop
      const bs = slide.userData.isAqua
        ? aquaStates[slide.userData.groupIndex].baseScale
        : videoBaseScale[slide.userData.videoIndex];
      const { left, right } = projectTopCorners(slide, bs);

      // Label: esquina superior izquierda
      // Counter: esquina superior derecha (dentro del mismo div flex)
      // Posicionamos el div desde la izquierda y le damos el ancho exacto del slide
      const slideScreenW = right.x - left.x;
      cap.mobileEl.style.left   = `${left.x}px`;
      cap.mobileEl.style.top    = `${left.y}px`;
      cap.mobileEl.style.width  = `${slideScreenW}px`;
      cap.mobileEl.style.transform = `translateY(calc(-100% - 6px))`;
      cap.mobileEl.classList.add("visible");

      mobileCaptionTimer = setTimeout(() => {
        cap.mobileEl.classList.remove("visible");
        mobileCaptionUid = -1;
      }, 2000);
    };

    const hitSlider = (cx, cy) => {
      mouse.x = (cx / window.innerWidth)  *  2 - 1;
      mouse.y = (cy / window.innerHeight) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(slides);
      if (!hits.length) return;

      if (isMobile) {
        // En móvil: mostrar caption del slide tocado (sea aqua o video)
        // Seleccionar el slide más cercano al centro entre todos los hits
        let bestHit = hits[0];
        if (hits.length > 1) {
          let minDist = Infinity;
          hits.forEach((h) => {
            const d = Math.abs(h.object.position.y);
            if (d < minDist) { minDist = d; bestHit = h; }
          });
        }
        const uid = bestHit.object.userData.uid;
        showMobileCaption(uid, bestHit.object);

        // Si es aqua, avanzar la imagen
        if (bestHit.object.userData.isAqua)
          advanceAquaGroup(bestHit.object.userData.groupIndex);
        return;
      }

      // Desktop: solo avanzar aqua
      const aquaHits = hits.filter((h) => h.object.userData.isAqua);
      if (!aquaHits.length) return;
      let best = aquaHits[0];
      advanceAquaGroup(best.object.userData.groupIndex);
    };

    const handleMouseDown  = (e) => { isDragging = false; dragStartAxis = isVertical ? e.clientY : e.clientX; };
    const handleMouseMove  = (e) => {
      if (Math.abs((isVertical ? e.clientY : e.clientX) - dragStartAxis) > 8) isDragging = true;
      if (!isMobile) updateHover(e.clientX, e.clientY);
    };
    const handleMouseLeave = () => {
      if (hoveredUid !== -1) {
        captionEls[hoveredUid]?.label?.classList.remove("visible");
        captionEls[hoveredUid]?.counter?.classList.remove("visible");
        hoveredUid = -1;
      }
    };
    const handleClick = (e) => {
      if (suppressNextClick) { suppressNextClick = false; return; }
      if (!isDragging) hitSlider(e.clientX, e.clientY);
      isDragging = false;
    };
    const handleKeyDown = (e) => {
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
      // Guardar posición exacta al inicio — para calcular el slide de origen
      touchStartPosition = currentPosition;
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      const cur = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      const delta = cur - touchLast; touchLast = cur;
      // Distorsión activa en ambos — más sensible en móvil para efecto pronunciado
      targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(delta) * (isMobile ? 0.12 : 0.05));
      targetPosition -= delta * settings.touchSensitivity; isScrolling = true;
      // Ocultar caption móvil en cuanto hay scroll
      if (isMobile && mobileCaptionUid !== -1) {
        captionEls[mobileCaptionUid]?.mobileEl?.classList.remove("visible");
        clearTimeout(mobileCaptionTimer);
        mobileCaptionUid = -1;
      }
    };
    const handleTouchEnd = (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartClient.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartClient.y);

      // Tap — mostrar caption y avanzar imagen
      if (dx < 20 && dy < 20) {
        suppressNextClick = true;
        hitSlider(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        return;
      }

      if (isMobile) {
        // ── Pull & snap — 1 slide a la vez ──────────────────────────
        // touchStart y touchLast son coordenadas de pantalla en px
        const swipePx    = touchStart - touchLast; // px totales arrastrados
        const swipeWorld = swipePx * settings.touchSensitivity; // en unidades de mundo
        const threshold  = slideUnit * 0.40; // 40% del slide para confirmar cambio
        const vel        = (touchLast - touchStart) * 0.005;
        const fastSwipe  = Math.abs(vel) > 0.3; // gesto rápido = confirmar siempre

        // Encontrar el slide de origen — el que estaba centrado ANTES del swipe
        // touchStartPosition es la posición exacta cuando el dedo tocó la pantalla
        let originBestDist = Infinity;
        let originSnapPos  = touchStartPosition;
        slides.forEach((s) => {
          let basePos = s.userData.index * slideUnit - touchStartPosition;
          basePos = ((basePos % totalSize) + totalSize) % totalSize;
          if (basePos > totalSize / 2) basePos -= totalSize;
          if (Math.abs(basePos) < originBestDist) {
            originBestDist = Math.abs(basePos);
            originSnapPos  = s.userData.index * slideUnit;
            while (originSnapPos - touchStartPosition > totalSize / 2)  originSnapPos -= totalSize;
            while (originSnapPos - touchStartPosition < -totalSize / 2) originSnapPos += totalSize;
          }
        });

        // Decidir destino: origen (rebote) o siguiente/anterior (avance)
        let snapPos = originSnapPos; // por defecto, vuelve al slide actual centrado

        if (Math.abs(swipeWorld) > threshold || fastSwipe) {
          const direction = swipePx > 0 ? 1 : -1; // px>0 = arrastró izq = avanza
          snapPos = originSnapPos + direction * slideUnit;
          while (snapPos - targetPosition > totalSize / 2)  snapPos -= totalSize;
          while (snapPos - targetPosition < -totalSize / 2) snapPos += totalSize;
        }

        // Animar tanto currentPosition como targetPosition al destino
        isScrolling = false;
        const snapObj = { v: currentPosition };
        gsap.to(snapObj, {
          v:        snapPos,
          duration: 0.42,
          ease:     "power3.out",
          onUpdate()  { currentPosition = snapObj.v; targetPosition = snapObj.v; },
          onComplete(){ currentPosition = snapPos;   targetPosition = snapPos;   },
        });
      } else {
        // Desktop: inercia libre original
        const vel = (touchLast - touchStart) * 0.005;
        if (Math.abs(vel) > 0.15) {
          autoScrollSpeed = -vel * settings.momentumMultiplier * 0.05;
          isScrolling = true;
          setTimeout(() => { isScrolling = false; }, 800);
        }
      }
    };
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    const handleVisibility = () => {
      if (document.hidden) {
        // Pausar todos al salir de la pestaña
        videos.forEach((v) => v.pause());
      } else {
        // Al volver: reanudar según dispositivo
        if (!isMobile) {
          // Desktop — todos los vídeos deben estar siempre en play
          videos.forEach((v) => {
            if (v.src) v.play().catch(() => {});
          });
        } else {
          // Móvil — solo reanudar los que están cargados y en rango visible
          slides.forEach((s) => {
            if (s.userData.isAqua) return;
            const vi  = s.userData.videoIndex;
            const vid2 = videos[vi];
            if (!vid2 || !videoLoaded[vi]) return;
            let basePos = s.userData.index * slideUnit - currentPosition;
            basePos = ((basePos % totalSize) + totalSize) % totalSize;
            if (basePos > totalSize / 2) basePos -= totalSize;
            if (Math.abs(basePos) <= slideUnit * 1.5)
              vid2.play().catch(() => {});
          });
        }
      }
    };

    canvas.addEventListener("mousedown",  handleMouseDown);
    canvas.addEventListener("mousemove",  handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
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

      {
        // Distorsión activa en ambos — desktop basada en velocidad, móvil en swipe
        const vel = Math.abs(currentPosition - prevPos) / dt;
        velocityHistory.push(vel); velocityHistory.shift();
        const avg = velocityHistory.reduce((s, v) => s + v, 0) / velocityHistory.length;
        if (avg > peakVelocity) peakVelocity = avg;
        const isDecel = (avg / (peakVelocity + 0.001)) < 0.7 && peakVelocity > 0.5;
        peakVelocity *= 0.99;
        if (vel > 0.05) targetDistortionFactor = Math.max(targetDistortionFactor, Math.min(1, vel * (isMobile ? 0.18 : 0.1)));
        if (isDecel || avg < 0.2) targetDistortionFactor *= isDecel ? settings.distortionDecay : settings.distortionDecay * 0.9;
        currentDistortionFactor += (targetDistortionFactor - currentDistortionFactor) * settings.distortionSmoothing;
      }

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

      // ── Por slide: posición + distorsión + caption ────────────────
      // Para captions desktop: por cada uid, solo actualizamos la posición
      // del slide más cercano al centro (el que es más visible).
      const uidBestSlide = isMobile ? null : new Map(); // uid → slide más cercano al centro

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

        if (isMobile) {
          slide.position.z = 0;
          const bs = slide.userData.isAqua
            ? aquaStates[slide.userData.groupIndex].baseScale
            : videoBaseScale[slide.userData.videoIndex];
          slide.scale.set(bs.x, bs.y, 1);
          slide.rotation.x = 0;
          // Distorsión en móvil — más pronunciada que en desktop
          if (currentDistortionFactor > 0.001 && slide.userData.originalVertices) {
            updateCurve(slide, slide.userData.currentPos, currentDistortionFactor * 1.6);
          }

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
          // Desktop
          slide.position.z += (-0.8 - slide.position.z) * 0.1;
          const bs = slide.userData.isAqua
            ? aquaStates[slide.userData.groupIndex].baseScale
            : videoBaseScale[slide.userData.videoIndex];
          slide.scale.set(bs.x, bs.y, 1);
          updateCurve(slide, slide.userData.currentPos, currentDistortionFactor);

          // Registrar cuál copia de este uid está más centrada
          const uid  = slide.userData.uid;
          const dist = Math.abs(slide.userData.currentPos);
          const prev = uidBestSlide.get(uid);
          if (!prev || dist < Math.abs(prev.userData.currentPos))
            uidBestSlide.set(uid, slide);
        }
      });

      // Posicionar label (izq) y counter (der) del uid bajo hover
      if (!isMobile && hoveredUid !== -1) {
        const bestSlide = uidBestSlide.get(hoveredUid);
        if (bestSlide) {
          const bs = bestSlide.userData.isAqua
            ? aquaStates[bestSlide.userData.groupIndex].baseScale
            : videoBaseScale[bestSlide.userData.videoIndex];
          const { left, right } = projectTopCorners(bestSlide, bs);
          const cap = captionEls[hoveredUid];
          if (cap?.label) {
            cap.label.style.left = `${left.x}px`;
            cap.label.style.top  = `${left.y}px`;
          }
          if (cap?.counter) {
            cap.counter.style.left      = `${right.x}px`;
            cap.counter.style.top       = `${right.y}px`;
            cap.counter.style.transform = `translateX(-100%) translateY(calc(-100% - 6px))`;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate(0);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown",  handleMouseDown);
      canvas.removeEventListener("mousemove",  handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click",      handleClick);
      window.removeEventListener("keydown",    handleKeyDown);
      window.removeEventListener("wheel",      handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove",  handleTouchMove);
      window.removeEventListener("touchend",   handleTouchEnd);
      window.removeEventListener("resize",     handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      aquaTextures.forEach((arr) => arr.forEach((t) => t?.dispose()));
      slides.forEach((s) => { s.geometry.dispose(); s.material.dispose(); });
      videoMetaListeners.forEach(({ vid, onMeta }) => vid.removeEventListener("loadedmetadata", onMeta));
      videos.forEach((v) => { v.pause(); v.src = ""; v.load(); });
      videoTextures.forEach((t) => t.dispose());
      if (posterTextures) posterTextures.forEach((t) => t?.dispose?.());
      placeholderTex.dispose();
      renderer.dispose();
      captionEls.forEach((cap) => { cap?.label?.remove(); cap?.counter?.remove(); cap?.mobileEl?.remove(); });
      clearTimeout(mobileCaptionTimer);
    };
  }, [isMobile, resolvedGroups, resolvedVideos]);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor: "pointer", display: "block" }}
        data-aqua-canvas="true"
      />
      {/* Overlay para captions HTML — pointer-events: none, solo desktop */}
      <div
        ref={overlayRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
      />
    </div>
  );
};

export default FinalSlider4;