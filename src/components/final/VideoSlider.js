"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";
import { ALL_VIDEOS, VIDEO_LABEL_BY_NAME } from "@/data/mediaCatalog";

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

const labelFor = (id) =>
  VIDEO_LABEL_BY_NAME[id] || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const pickSrc = (sources) => {
  if (!sources?.length) return null;
  const v = document.createElement("video");
  return (sources.find((s) => v.canPlayType(s.type) !== "") || sources[0])?.src || null;
};

// 5 en desktop / 4 en móvil: cubre lo visible + 1 que entra ya en play.
// El resto ni src. Paused = sin upload de textura.

const VideoSlider = () => {
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );

  const { getVideo, isLoaded, videoIds } = useOptimizedMedia();

  const videoNames = useMemo(() => {
    if (!isLoaded) return null;
    const extras = videoIds.filter((id) => !ALL_VIDEOS.includes(id));
    return extras.length ? [...ALL_VIDEOS, ...extras] : ALL_VIDEOS;
  }, [isLoaded, videoIds]);

  const resolvedVideos = useMemo(() => {
    if (!videoNames) return null;
    return videoNames.map((n) => getVideo(n));
  }, [videoNames, getVideo]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const existing = document.getElementById("slide-caption-styles");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "slide-caption-styles";
    style.textContent = CAPTION_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!resolvedVideos || !videoNames) return;

    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    const VIDEO_COUNT = videoNames.length;

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

    const slideWidth  = isMobile ? 3.8 : 2.0;
    const slideHeight = isMobile ? 4.25 : 2.5;
    const slideAspect = slideWidth / slideHeight;
    const isVertical  = false;
    const slideGap    = isMobile ? 0.02 : 0.05;
    const BORDER_RADIUS = 0;

    const settings = {
      wheelSensitivity: 0.01, touchSensitivity: 0.024, momentumMultiplier: 4.5,
      smoothing: 0.22, slideLerp: 0.18, distortionDecay: 0.95, maxDistortion: 2.5,
      distortionSmoothing: 0.075,
    };

    const captionEls = [];
    for (let uid = 0; uid < VIDEO_COUNT; uid++) {
      const label = labelFor(videoNames[uid]);
      const total = String(VIDEO_COUNT).padStart(2, "0");
      const index = String(uid + 1).padStart(2, "0");

      if (!isMobile) {
        const labelEl = document.createElement("span");
        labelEl.className = "slide-caption__label";
        labelEl.textContent = label;
        overlay.appendChild(labelEl);

        const counterEl = document.createElement("span");
        counterEl.className = "slide-caption__counter";
        counterEl.textContent = `${index} / ${total}`;
        overlay.appendChild(counterEl);

        captionEls.push({ label: labelEl, counter: counterEl, mobileEl: null });
      } else {
        const mobileEl = document.createElement("div");
        mobileEl.className = "slide-caption--mobile";

        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        mobileEl.appendChild(labelSpan);

        const counterSpan = document.createElement("span");
        counterSpan.className = "slide-caption__counter";
        counterSpan.textContent = `${uid + 1}/${VIDEO_COUNT}`;
        mobileEl.appendChild(counterSpan);

        document.body.appendChild(mobileEl);
        captionEls.push({ label: null, counter: counterSpan, mobileEl });
      }
    }

    // Placeholder + posters (JPEG, baratos). Los <video> nacen sin src.
    const phC = document.createElement("canvas"); phC.width = phC.height = 64;
    const phCtx = phC.getContext("2d"); phCtx.fillStyle = "#ffffff"; phCtx.fillRect(0, 0, 64, 64);
    const placeholderTex = new THREE.CanvasTexture(phC);
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    const videos = [];
    const videoTextures = [];
    const videoSrcs = [];
    const videoLoaded = [];
    const videoLoading = [];
    const videoBaseScale = videoNames.map(() => ({ x: 1, y: 1 }));
    const videoMetaListeners = [];
    const posterTextures = resolvedVideos.map(() => placeholderTex.clone());

    resolvedVideos.forEach(({ sources }, vi) => {
      videoSrcs.push(pickSrc(sources));
      videoLoaded.push(false);
      videoLoading.push(false);

      const vid = document.createElement("video");
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.crossOrigin = "anonymous";
      vid.preload = "none";

      const tex = new THREE.VideoTexture(vid);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      // Three sube el frame aunque el vídeo esté en pausa. Eso es GPU tirada.
      tex.update = function updateLiveVideo() {
        if (this.image.paused) return;
        THREE.VideoTexture.prototype.update.call(this);
      };

      const onMeta = () => {
        if (!vid.videoWidth || !vid.videoHeight) return;
        const mediaAspect = vid.videoWidth / vid.videoHeight;
        videoBaseScale[vi] = mediaAspect > slideAspect
          ? { x: 1, y: slideAspect / mediaAspect }
          : { x: mediaAspect / slideAspect, y: 1 };
      };
      vid.addEventListener("loadedmetadata", onMeta);
      videoMetaListeners.push({ vid, onMeta });
      videos.push(vid);
      videoTextures.push(tex);
    });

    resolvedVideos.forEach(({ poster }, vi) => {
      if (!poster) return;
      new THREE.TextureLoader().load(encodeURI(poster), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        const old = posterTextures[vi];
        posterTextures[vi] = tex;
        if (old && old !== placeholderTex) old.dispose();
        const mediaAspect = tex.image.width / tex.image.height;
        videoBaseScale[vi] = mediaAspect > slideAspect
          ? { x: 1, y: slideAspect / mediaAspect }
          : { x: mediaAspect / slideAspect, y: 1 };
        slides.forEach((s) => {
          if (s.userData.videoIndex === vi && s.userData.showingPoster)
            s.material.uniforms.uMap.value = tex;
        });
      });
    });

    // Con 20 piezas, una sola vuelta cubre el wrap sin hueco visible.
    const REPEAT     = VIDEO_COUNT < 12 ? 2 : 1;
    const slideCount = VIDEO_COUNT * REPEAT;
    const slideUnit  = slideWidth + slideGap;
    const totalSize  = slideCount * slideUnit;
    const wSegs = isMobile ? 12 : 24;
    const hSegs = isMobile ? 8 : 12;

    const slides    = [];
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const projVec   = new THREE.Vector3();

    for (let i = 0; i < slideCount; i++) {
      const uid = i % VIDEO_COUNT;
      const geo = new THREE.PlaneGeometry(slideWidth, slideHeight, wSegs, hSegs);
      const slideMat = new THREE.ShaderMaterial({
        uniforms: {
          uMap:         { value: posterTextures[uid] },
          uExpandRange: { value: 0.0 },
          uRadius:      { value: BORDER_RADIUS },
          uAspect:      { value: slideAspect },
        },
        vertexShader: slideVert, fragmentShader: slideFrag,
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, slideMat);
      mesh.position.x = i * slideUnit;
      mesh.userData = {
        originalVertices: [...geo.attributes.position.array],
        index: i, uid, videoIndex: uid,
        targetPos: 0, currentPos: 0,
        showingPoster: true,
      };
      scene.add(mesh);
      slides.push(mesh);
    }

    slides.forEach((s) => {
      s.position.x -= totalSize / 2;
      s.userData.targetPos = s.userData.currentPos = s.position.x;
    });

    const showVideoOnSlides = (vi) => {
      slides.forEach((s) => {
        if (s.userData.videoIndex !== vi) return;
        s.material.uniforms.uMap.value = videoTextures[vi];
        s.material.uniforms.uExpandRange.value = 1;
        s.userData.showingPoster = false;
      });
    };

    const showPosterOnSlides = (vi) => {
      slides.forEach((s) => {
        if (s.userData.videoIndex !== vi) return;
        s.material.uniforms.uMap.value = posterTextures[vi];
        s.material.uniforms.uExpandRange.value = 0;
        s.userData.showingPoster = true;
      });
    };

    const maxPlaying = isMobile ? 4 : 5;
    // Visible ~±2 slides; WARM arranca play justo fuera para que entre ya en movimiento.
    const PLAY_RANGE   = slideUnit * 2.25;
    const WARM_RANGE   = slideUnit * 2.95;
    const LOAD_RANGE   = slideUnit * 3.35;
    const UNLOAD_RANGE = slideUnit * 4.2;
    let lastManageKey = "";
    let playSet = new Set();
    let scrollDir = 1;

    const loadVideo = (vi) => {
      const vid = videos[vi];
      const src = videoSrcs[vi];
      if (!vid || !src || videoLoaded[vi] || videoLoading[vi]) return;
      videoLoading[vi] = true;
      vid.src = encodeURI(src);
      vid.preload = "auto";
      const ok = () => {
        vid.removeEventListener("canplay", ok);
        vid.removeEventListener("error", err);
        videoLoaded[vi] = true;
        videoLoading[vi] = false;
        showVideoOnSlides(vi);
        if (playSet.has(vi)) vid.play().catch(() => {});
        lastManageKey = "";
      };
      const err = () => {
        vid.removeEventListener("canplay", ok);
        vid.removeEventListener("error", err);
        videoLoading[vi] = false;
      };
      vid.addEventListener("canplay", ok);
      vid.addEventListener("error", err);
      vid.load();
    };

    const unloadVideo = (vi) => {
      const vid = videos[vi];
      if (!vid || (!videoLoaded[vi] && !videoLoading[vi])) return;
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
      videoLoaded[vi] = false;
      videoLoading[vi] = false;
      showPosterOnSlides(vi);
    };

    const manageVideos = (dir) => {
      const best = new Array(VIDEO_COUNT);
      slides.forEach((s) => {
        const x = s.userData.currentPos;
        const d = Math.abs(x);
        const vi = s.userData.videoIndex;
        if (!best[vi] || d < best[vi].d) best[vi] = { d, x };
      });

      const ranked = best
        .map((b, vi) => ({ vi, d: b?.d ?? Infinity, x: b?.x ?? 0 }))
        .sort((a, b) => a.d - b.d);

      const shouldPlay = [];
      const shouldLoad = new Set();

      ranked.forEach(({ vi, d, x }) => {
        const incoming = dir !== 0 && Math.sign(x) === dir;
        if (d <= LOAD_RANGE || (incoming && d <= LOAD_RANGE + slideUnit * 0.55))
          shouldLoad.add(vi);
        if (shouldPlay.length >= maxPlaying) return;
        if (d <= PLAY_RANGE || (incoming && d <= WARM_RANGE))
          shouldPlay.push(vi);
      });
      if (!shouldPlay.length && ranked[0] && ranked[0].d < Infinity) {
        shouldPlay.push(ranked[0].vi);
        shouldLoad.add(ranked[0].vi);
      }

      const key = `${shouldPlay.join(",")}|${[...shouldLoad].join(",")}`;
      if (key === lastManageKey) return;
      lastManageKey = key;
      playSet = new Set(shouldPlay);

      for (let vi = 0; vi < VIDEO_COUNT; vi++) {
        const d = best[vi]?.d ?? Infinity;
        if (shouldLoad.has(vi)) loadVideo(vi);
        else if (d > UNLOAD_RANGE) unloadVideo(vi);

        const vid = videos[vi];
        if (!vid || !videoLoaded[vi]) continue;
        if (playSet.has(vi)) {
          if (vid.paused) vid.play().catch(() => {});
        } else if (!vid.paused) {
          vid.pause();
        }
      }
    };

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

    let currentPosition = 0, targetPosition = 0;
    let isScrolling = false, autoScrollSpeed = 0, lastTime = 0;
    let touchStartClient = { x: 0, y: 0 }, touchStart = 0, touchLast = 0;
    let currentDistortionFactor = 0, targetDistortionFactor = 0;
    let peakVelocity = 0, velocityHistory = [0, 0, 0, 0, 0];
    let isDragging = false, dragStartAxis = 0;
    let suppressNextClick = false;
    let touchStartPosition = 0;

    let mobileCaptionUid = -1;
    let mobileCaptionTimer = null;

    const showMobileCaption = (uid, slide) => {
      if (mobileCaptionUid !== -1 && mobileCaptionUid !== uid) {
        captionEls[mobileCaptionUid]?.mobileEl?.classList.remove("visible");
      }
      mobileCaptionUid = uid;
      clearTimeout(mobileCaptionTimer);

      const cap = captionEls[uid];
      if (!cap?.mobileEl) return;

      const bs = videoBaseScale[slide.userData.videoIndex];
      const { left, right } = projectTopCorners(slide, bs);
      cap.mobileEl.style.left   = `${left.x}px`;
      cap.mobileEl.style.top    = `${left.y}px`;
      cap.mobileEl.style.width  = `${right.x - left.x}px`;
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
      let bestHit = hits[0];
      if (hits.length > 1) {
        let minDist = Infinity;
        hits.forEach((h) => {
          const d = Math.abs(h.object.position.x);
          if (d < minDist) { minDist = d; bestHit = h; }
        });
      }
      if (isMobile) showMobileCaption(bestHit.object.userData.uid, bestHit.object);
    };

    const handleMouseDown  = (e) => { isDragging = false; dragStartAxis = e.clientX; };
    const handleMouseMove  = (e) => {
      if (Math.abs(e.clientX - dragStartAxis) > 8) isDragging = true;
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
      if (e.key === "ArrowLeft")  { targetPosition += slideUnit; targetDistortionFactor = Math.min(1, targetDistortionFactor + 0.3); }
      if (e.key === "ArrowRight") { targetPosition -= slideUnit; targetDistortionFactor = Math.min(1, targetDistortionFactor + 0.3); }
    };
    const handleWheel = (e) => {
      e.preventDefault();
      targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(e.deltaY) * 0.001);
      targetPosition -= e.deltaY * settings.wheelSensitivity;
      isScrolling = true;
      autoScrollSpeed = Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);
      clearTimeout(window._videoSliderSTO);
      window._videoSliderSTO = setTimeout(() => { isScrolling = false; }, 150);
    };
    const handleTouchStart = (e) => {
      touchStartClient = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStart = e.touches[0].clientX;
      touchLast  = touchStart; isScrolling = false;
      touchStartPosition = currentPosition;
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      const cur = e.touches[0].clientX;
      const delta = cur - touchLast; touchLast = cur;
      targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(delta) * (isMobile ? 0.12 : 0.05));
      targetPosition -= delta * settings.touchSensitivity; isScrolling = true;
      if (isMobile && mobileCaptionUid !== -1) {
        captionEls[mobileCaptionUid]?.mobileEl?.classList.remove("visible");
        clearTimeout(mobileCaptionTimer);
        mobileCaptionUid = -1;
      }
    };
    const handleTouchEnd = (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartClient.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartClient.y);

      if (dx < 20 && dy < 20) {
        suppressNextClick = true;
        hitSlider(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        return;
      }

      if (isMobile) {
        const swipePx    = touchStart - touchLast;
        const swipeWorld = swipePx * settings.touchSensitivity;
        const threshold  = slideUnit * 0.40;
        const vel        = (touchLast - touchStart) * 0.005;
        const fastSwipe  = Math.abs(vel) > 0.3;

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

        let snapPos = originSnapPos;
        if (Math.abs(swipeWorld) > threshold || fastSwipe) {
          const direction = swipePx > 0 ? 1 : -1;
          snapPos = originSnapPos + direction * slideUnit;
          while (snapPos - targetPosition > totalSize / 2)  snapPos -= totalSize;
          while (snapPos - targetPosition < -totalSize / 2) snapPos += totalSize;
        }

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
        videos.forEach((v) => v.pause());
        lastManageKey = "";
      } else {
        manageVideos(scrollDir);
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

    let animId;
    let readyDispatched = false;
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
      const travel = currentPosition - prevPos;
      if (travel > 0.0004) scrollDir = 1;
      else if (travel < -0.0004) scrollDir = -1;

      {
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

      const uidBestSlide = isMobile ? null : new Map();

      slides.forEach((slide, i) => {
        let basePos = i * slideUnit - currentPosition;
        basePos = ((basePos % totalSize) + totalSize) % totalSize;
        if (basePos > totalSize / 2) basePos -= totalSize;

        if (Math.abs(basePos - slide.userData.targetPos) > slideWidth * 2)
          slide.userData.currentPos = basePos;
        slide.userData.targetPos   = basePos;
        slide.userData.currentPos += (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;
        slide.position.x = slide.userData.currentPos;

        const bs = videoBaseScale[slide.userData.videoIndex];
        slide.scale.set(bs.x, bs.y, 1);

        const onScreen = Math.abs(slide.userData.currentPos) <= slideUnit * 3.1;

        if (isMobile) {
          slide.position.z = 0;
          slide.rotation.x = 0;
          if (onScreen && currentDistortionFactor > 0.001)
            updateCurve(slide, slide.userData.currentPos, currentDistortionFactor * 1.6);
        } else {
          slide.position.z += (-0.8 - slide.position.z) * 0.1;
          if (onScreen) updateCurve(slide, slide.userData.currentPos, currentDistortionFactor);
          const uid  = slide.userData.uid;
          const dist = Math.abs(slide.userData.currentPos);
          const prev = uidBestSlide.get(uid);
          if (!prev || dist < Math.abs(prev.userData.currentPos))
            uidBestSlide.set(uid, slide);
        }
      });

      manageVideos(scrollDir);

      if (!isMobile && hoveredUid !== -1) {
        const bestSlide = uidBestSlide.get(hoveredUid);
        if (bestSlide) {
          const bs = videoBaseScale[bestSlide.userData.videoIndex];
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

      if (!readyDispatched) {
        readyDispatched = true;
        window.dispatchEvent(new CustomEvent("atj-scene-ready"));
      }
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
      slides.forEach((s) => { s.geometry.dispose(); s.material.dispose(); });
      videoMetaListeners.forEach(({ vid, onMeta }) => vid.removeEventListener("loadedmetadata", onMeta));
      videos.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
      videoTextures.forEach((t) => t.dispose());
      posterTextures.forEach((t) => { if (t && t !== placeholderTex) t.dispose(); });
      placeholderTex.dispose();
      renderer.dispose();
      captionEls.forEach((cap) => { cap?.label?.remove(); cap?.counter?.remove(); cap?.mobileEl?.remove(); });
      clearTimeout(mobileCaptionTimer);
    };
  }, [isMobile, resolvedVideos, videoNames]);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor: "pointer", display: "block" }}
        data-aqua-canvas="true"
      />
      <div
        ref={overlayRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
      />
    </div>
  );
};

export default VideoSlider;
