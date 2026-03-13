"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";

// ─── Aqua: bubble lens (desktop y móvil, misma animación al hacer click) ───────
const aquaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const aquaFragmentShader = `
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec2 uTexture1Size;
  uniform vec2 uTexture2Size;
  varying vec2 vUv;

  vec2 getCoverUV(vec2 uv, vec2 textureSize) {
    vec2 s = uResolution / textureSize;
    float scale = max(s.x, s.y);
    vec2 scaledSize = textureSize * scale;
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }
  vec2 getDistortedUv(vec2 uv, vec2 direction, float factor) {
    vec2 scaledDirection = direction;
    scaledDirection.y *= 2.0;
    return uv - scaledDirection * factor;
  }
  struct LensDistortion { vec2 distortedUV; float inside; };
  LensDistortion getLensDistortion(vec2 p, vec2 uv, vec2 sphereCenter, float sphereRadius, float focusFactor) {
    vec2  distortionDirection = normalize(p - sphereCenter);
    float focusRadius         = sphereRadius * focusFactor;
    float focusStrength       = sphereRadius / 3000.0;
    float focusSdf            = length(sphereCenter - p) - focusRadius;
    float sphereSdf           = length(sphereCenter - p) - sphereRadius;
    float inside = smoothstep(0.0, 1.0, -sphereSdf / (sphereRadius * 0.001));
    float magnifierFactor = focusSdf / (sphereRadius - focusRadius);
    float mFactor = clamp(magnifierFactor * inside, 0.0, 1.0);
    mFactor = pow(mFactor, 5.0);
    vec2 distortedUV = getDistortedUv(uv, distortionDirection, mFactor * focusStrength);
    return LensDistortion(distortedUV, inside);
  }
  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 p      = vUv * uResolution;
    vec2 uv1    = getCoverUV(vUv, uTexture1Size);
    vec2 uv2    = getCoverUV(vUv, uTexture2Size);
    float maxRadius    = length(uResolution) * 1.5;
    float bubbleRadius = uProgress * maxRadius;
    vec2  sphereCenter = center * uResolution;
    float dist = length(sphereCenter - p);
    float mask = step(bubbleRadius, dist);
    vec4 currentImg = texture2D(uTexture1, uv1);
    LensDistortion distortion = getLensDistortion(p, uv2, sphereCenter, bubbleRadius, 0.25);
    vec4 newImg = texture2D(uTexture2, distortion.distortedUV);
    float finalMask = max(mask, 1.0 - distortion.inside);
    gl_FragColor = mix(newImg, currentImg, finalMask);
  }
`;

// ─── Video: corrección de rango limitado (16-235) → full range (evita colores apagados) ─
const videoVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const videoFrag = `
  uniform sampler2D uMap;
  uniform float uExpandRange;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (uExpandRange > 0.0) {
      c.rgb = (c.rgb - 0.062745) / 0.858824;
      c = clamp(c, 0.0, 1.0);
    }
    gl_FragColor = c;
  }
`;

// ─── Data ──────────────────────────────────────────────────────────────────
const IMAGE_NAMES = [
  ["story1.png",  "story2.png",  "story3.png"],
  ["story4.png",  "story5.png",  "story6.png"],
  ["story7.png",  "story8.png",  "story9.png"],
  ["story10.png", "story11.png", "story12.png"],
  ["story13.png", "story14.png", "story15.png"],
];

const VIDEO_NAMES = [
  "Allthatjazz cinematic©Feb26",
  "ATJ About Cuaderno",
  "ATJ_AboutMotion 02",
  "Playground_Carhartt-WIP_24012026 (1)_1",
  "Portfolio-Gallery-4-5",
];

// ─── Component ─────────────────────────────────────────────────────────────
const AquaSliderWithHero5 = () => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  const { getImage, getVideo, isLoaded } = useOptimizedMedia();

  const resolvedGroups = useMemo(() => {
    if (!isLoaded) return null;
    return IMAGE_NAMES.map((group) =>
      group.map((name) => getImage(name).src)
    );
  }, [isLoaded, getImage]);

  const resolvedVideos = useMemo(() => {
    if (!isLoaded) return null;
    return VIDEO_NAMES.map((name) => getVideo(name));
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
      canvas,
      antialias: !isMobile,
      preserveDrawingBuffer: false,
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

    // ── Dimensions ────────────────────────────────────────────────────
    const slideWidth  = isMobile ? 4.0 : 2.0;
    const slideHeight = isMobile ? 4.5 : 2.5;
    const gap         = isMobile ? 0.2 : 0.05;
    const isVertical  = isMobile;

    const settings = {
      wheelSensitivity:      0.01,
      touchSensitivity:      0.01,
      momentumMultiplier:    2,
      smoothing:             0.1,
      slideLerp:             0.075,
      distortionDecay:       0.95,
      maxDistortion:         2.5,
      distortionSensitivity: 0.15,
      distortionSmoothing:   0.075,
    };

    // ── Aqua: bubble lens en desktop y móvil (misma animación al hacer click) ───
    const GROUP_COUNT   = resolvedGroups.length;
    const aquaTextures  = [];
    const aquaStates    = [];
    const aquaCamera    = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const aquaScenes    = [];
    const aquaMaterials = [];
    const aquaTargets   = [];

    const offW = isMobile ? 384 : 512;
    const offH = isMobile ? 432 : 640;

    for (let g = 0; g < GROUP_COUNT; g++) {
      const texArr = new Array(resolvedGroups[g].length).fill(null);
      let loaded = 0;
      aquaTextures.push(texArr);
      aquaStates.push({ currentIndex: 0, isTransitioning: false });

      const aqScene = new THREE.Scene();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTexture1:     { value: null },
          uTexture2:     { value: null },
          uProgress:     { value: 0 },
          uResolution:   { value: new THREE.Vector2(offW, offH) },
          uTexture1Size: { value: new THREE.Vector2(1, 1) },
          uTexture2Size: { value: new THREE.Vector2(1, 1) },
        },
        vertexShader:   aquaVertexShader,
        fragmentShader: aquaFragmentShader,
      });
      aqScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      const target = new THREE.WebGLRenderTarget(offW, offH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      target.texture.colorSpace = THREE.SRGBColorSpace;
      aquaScenes.push(aqScene);
      aquaMaterials.push(mat);
      aquaTargets.push(target);

      const loader = new THREE.TextureLoader();
      resolvedGroups[g].forEach((src, j) => {
        loader.load(src, (tex) => {
          tex.minFilter  = tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.userData   = { size: new THREE.Vector2(tex.image.width, tex.image.height) };
          texArr[j] = tex;
          if (++loaded === resolvedGroups[g].length) {
            const t0 = texArr[0];
            const t1 = texArr[1 % texArr.length];
            const m = aquaMaterials[g];
            m.uniforms.uTexture1.value     = t0;
            m.uniforms.uTexture2.value     = t1;
            m.uniforms.uTexture1Size.value = t0.userData.size;
            m.uniforms.uTexture2Size.value = t1.userData.size;
          }
        }, undefined, (err) => console.warn(`AquaSlider: couldn't load ${src}`, err));
      });
    }

    // ── advanceAquaGroup (tap/click para cambiar foto — bubble lens en ambos) ───
    const advanceAquaGroup = (g) => {
      const state  = aquaStates[g];
      const texArr = aquaTextures[g];
      if (state.isTransitioning || texArr.some((t) => !t)) return;
      state.isTransitioning = true;
      const next = (state.currentIndex + 1) % texArr.length;

      const mat = aquaMaterials[g];
      mat.uniforms.uTexture1.value     = texArr[state.currentIndex];
      mat.uniforms.uTexture2.value     = texArr[next];
      mat.uniforms.uTexture1Size.value = texArr[state.currentIndex].userData.size;
      mat.uniforms.uTexture2Size.value = texArr[next].userData.size;
      gsap.fromTo(mat.uniforms.uProgress, { value: 0 }, {
        value: 1, duration: 2.5, ease: "power2.inOut",
        onComplete: () => {
          mat.uniforms.uProgress.value     = 0;
          mat.uniforms.uTexture1.value     = texArr[next];
          mat.uniforms.uTexture1Size.value = texArr[next].userData.size;
          state.currentIndex    = next;
          state.isTransitioning = false;
        },
      });
    };

    // ── Video setup ───────────────────────────────────────────────────
    const videos        = [];
    const videoTextures = [];
    const videoSrcs     = []; // para recargar en móvil

    const pickVideoSrc = (sources) => {
      if (!sources?.length) return null;
      const v = document.createElement("video");
      const picked = sources.find((s) => v.canPlayType(s.type) !== "") || sources[0];
      return picked?.src || null;
    };

    resolvedVideos.forEach(({ sources }) => {
      const src = pickVideoSrc(sources);
      videoSrcs.push(src);
      const video = document.createElement("video");
      if (src && !isMobile) video.src = encodeURI(src);
      video.muted       = true;
      video.loop        = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.preload     = isMobile ? "metadata" : "auto";

      const tex = new THREE.VideoTexture(video);
      tex.colorSpace      = THREE.SRGBColorSpace;
      tex.minFilter       = THREE.LinearFilter;
      tex.magFilter       = THREE.LinearFilter;
      tex.generateMipmaps = false;

      if (!isMobile && src) video.play().catch(() => {});

      videos.push(video);
      videoTextures.push(tex);
    });


    // Móvil: posters iniciales (se muestran hasta que el video cargue)
    const placeholderCanvas = document.createElement("canvas");
    placeholderCanvas.width = 64;
    placeholderCanvas.height = 64;
    const phCtx = placeholderCanvas.getContext("2d");
    phCtx.fillStyle = "#1a1a1a";
    phCtx.fillRect(0, 0, 64, 64);
    const placeholderTex = new THREE.CanvasTexture(placeholderCanvas);
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    let posterTextures = null;
    let videoLoaded   = null;
    let videoLoading  = null;
    if (isMobile) {
      posterTextures = resolvedVideos.map(() => placeholderTex.clone());
      videoLoaded   = videoSrcs.map(() => false);
      videoLoading  = videoSrcs.map(() => false);
    }

    // ── Carousel layout ───────────────────────────────────────────────
    const VIDEO_COUNT   = VIDEO_NAMES.length;
    const UNIQUE_COUNT  = GROUP_COUNT + VIDEO_COUNT;
    const REPEAT        = 2;
    const slideCount    = UNIQUE_COUNT * REPEAT;
    const slideUnit     = isVertical ? slideHeight + gap : slideWidth + gap;
    const totalSize     = slideCount * slideUnit;

    // Mobile: 1×1 segments (slider plano), Desktop: 32×16 (para vertex distortion)
    const wSegs = isMobile ? 1 : 32;
    const hSegs = isMobile ? 1 : 16;

    const slides    = [];
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    for (let i = 0; i < slideCount; i++) {
      const uid        = i % UNIQUE_COUNT;
      const isAqua     = uid < GROUP_COUNT;
      const groupIndex = isAqua ? uid : null;
      const videoIndex = isAqua ? null : uid - GROUP_COUNT;

      const geo = new THREE.PlaneGeometry(slideWidth, slideHeight, wSegs, hSegs);

      let mat;
      if (isAqua) {
        mat = new THREE.MeshBasicMaterial({
          map: aquaTargets[groupIndex].texture,
          side: THREE.DoubleSide,
        });
      } else {
        const tex = isMobile ? posterTextures[videoIndex] : videoTextures[videoIndex];
        const isPoster = isMobile;
        mat = new THREE.ShaderMaterial({
          uniforms: {
            uMap:         { value: tex },
            uExpandRange: { value: isPoster ? 0 : 1 },
          },
          vertexShader:   videoVert,
          fragmentShader: videoFrag,
          side: THREE.DoubleSide,
        });
      }

      const mesh = new THREE.Mesh(geo, mat);
      if (isVertical) mesh.position.y = i * slideUnit;
      else            mesh.position.x = i * slideUnit;

      mesh.userData = {
        originalVertices: !isMobile ? [...geo.attributes.position.array] : null,
        index: i, uid, isAqua, groupIndex, videoIndex,
        targetPos: 0, currentPos: 0,
        showingPoster: isMobile && !isAqua,
      };

      scene.add(mesh);
      slides.push(mesh);
    }

    // Centre the strip
    slides.forEach((s) => {
      if (isVertical) {
        s.position.y -= totalSize / 2;
        s.userData.targetPos = s.userData.currentPos = s.position.y;
      } else {
        s.position.x -= totalSize / 2;
        s.userData.targetPos = s.userData.currentPos = s.position.x;
      }
    });

    // Móvil: cargar posters reales (reemplazan placeholder)
    if (isMobile) {
      resolvedVideos.forEach(({ poster }, vi) => {
        if (poster) {
          new THREE.TextureLoader().load(encodeURI(poster), (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = tex.magFilter = THREE.LinearFilter;
            const old = posterTextures[vi];
            posterTextures[vi] = tex;
            if (old) old.dispose();
            slides.forEach((s) => {
              if (!s.userData.isAqua && s.userData.videoIndex === vi && s.userData.showingPoster)
                s.material.uniforms.uMap.value = tex;
            });
          });
        }
      });
    }

    // ── Desktop CPU distortion ────────────────────────────────────────
    const updateCurveDesktop = (mesh, worldPosition, distortionFactor) => {
      const positionAttr = mesh.geometry.attributes.position;
      const original     = mesh.userData.originalVertices;
      const distortionRadius = 2.0;
      const maxCurvature     = settings.maxDistortion * distortionFactor;

      for (let i = 0; i < positionAttr.count; i++) {
        const x              = original[i * 3];
        const y              = original[i * 3 + 1];
        const vertexWorldPos = worldPosition + x;
        const dist           = Math.sqrt(vertexWorldPos ** 2 + y ** 2);
        let strength         = Math.max(0, 1 - dist / distortionRadius);
        strength             = Math.pow(strength, 1.5);
        positionAttr.setZ(i, Math.sin((strength * Math.PI) / 2) * maxCurvature);
      }
      positionAttr.needsUpdate = true;
    };

    // ── Scroll + distortion state ─────────────────────────────────────
    let currentPosition         = 0;
    let targetPosition          = 0;
    let isScrolling             = false;
    let autoScrollSpeed         = 0;
    let lastTime                = 0;
    let touchStartClient        = { x: 0, y: 0 };
    let touchStart              = 0;
    let touchLast               = 0;
    let currentDistortionFactor = 0;
    let targetDistortionFactor  = 0;
    let peakVelocity            = 0;
    let velocityHistory         = [0, 0, 0, 0, 0];
    let isDragging              = false;
    let dragStartAxis           = 0;

    const hitSlider = (cx, cy) => {
      mouse.x = (cx / window.innerWidth)  *  2 - 1;
      mouse.y = (cy / window.innerHeight) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(slides);
      if (hits.length > 0 && hits[0].object.userData.isAqua)
        advanceAquaGroup(hits[0].object.userData.groupIndex);
    };

    // ── Event handlers ────────────────────────────────────────────────
    const handleMouseDown = (e) => {
      isDragging    = false;
      dragStartAxis = isVertical ? e.clientY : e.clientX;
    };
    const handleMouseMove = (e) => {
      if (Math.abs((isVertical ? e.clientY : e.clientX) - dragStartAxis) > 8) isDragging = true;
    };
    const handleClick = (e) => {
      if (!isDragging) hitSlider(e.clientX, e.clientY);
      isDragging = false;
    };
    const handleKeyDown = (e) => {
      const back    = isVertical ? e.key === "ArrowUp"   : e.key === "ArrowLeft";
      const forward = isVertical ? e.key === "ArrowDown" : e.key === "ArrowRight";
      if (back)    { targetPosition += slideUnit; targetDistortionFactor = Math.min(1, targetDistortionFactor + 0.3); }
      if (forward) { targetPosition -= slideUnit; targetDistortionFactor = Math.min(1, targetDistortionFactor + 0.3); }
    };
    const handleWheel = (e) => {
      e.preventDefault();
      targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(e.deltaY) * 0.001);
      targetPosition   -= e.deltaY * settings.wheelSensitivity;
      isScrolling       = true;
      autoScrollSpeed   = Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);
      clearTimeout(window._aquaHeroSTO);
      window._aquaHeroSTO = setTimeout(() => { isScrolling = false; }, 150);
    };
    const handleTouchStart = (e) => {
      touchStartClient = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStart = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      touchLast  = touchStart;
      isScrolling = false;
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      const cur   = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      const delta = cur - touchLast;
      touchLast   = cur;
      if (!isMobile) targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(delta) * 0.05);
      targetPosition -= delta * settings.touchSensitivity;
      isScrolling     = true;
    };
    const handleTouchEnd = (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartClient.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartClient.y);
      if (dx < 10 && dy < 10) {
        hitSlider(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        return;
      }
      const velocity = (touchLast - touchStart) * 0.005;
      if (Math.abs(velocity) > 0.5) {
        autoScrollSpeed = -velocity * settings.momentumMultiplier * 0.05;
        if (!isMobile) targetDistortionFactor = Math.min(1, Math.abs(velocity) * 3 * settings.distortionSensitivity);
        isScrolling    = true;
        setTimeout(() => { isScrolling = false; }, 800);
      }
    };
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    const handleVisibility = () => {
      if (document.hidden) videos.forEach((v) => v.pause());
    };

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

      const deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime = time;
      const prevPos = currentPosition;

      if (isScrolling) {
        targetPosition  += autoScrollSpeed;
        autoScrollSpeed *= Math.max(0.92, 0.97 - Math.abs(autoScrollSpeed) * 0.5);
        if (Math.abs(autoScrollSpeed) < 0.001) autoScrollSpeed = 0;
      }

      currentPosition += (targetPosition - currentPosition) * settings.smoothing;

      // Distorsión solo en desktop
      if (!isMobile) {
        const currentVelocity = Math.abs(currentPosition - prevPos) / deltaTime;
        velocityHistory.push(currentVelocity);
        velocityHistory.shift();
        const avgVelocity = velocityHistory.reduce((s, v) => s + v, 0) / velocityHistory.length;

        if (avgVelocity > peakVelocity) peakVelocity = avgVelocity;
        const isDecelerating = (avgVelocity / (peakVelocity + 0.001)) < 0.7 && peakVelocity > 0.5;
        peakVelocity *= 0.99;

        if (currentVelocity > 0.05)
          targetDistortionFactor = Math.max(targetDistortionFactor, Math.min(1, currentVelocity * 0.1));
        if (isDecelerating || avgVelocity < 0.2)
          targetDistortionFactor *= isDecelerating ? settings.distortionDecay : settings.distortionDecay * 0.9;

        currentDistortionFactor +=
          (targetDistortionFactor - currentDistortionFactor) * settings.distortionSmoothing;
      }

      // ── Render aqua bubble lens a RenderTargets (desktop y móvil) ─────
      aquaScenes.forEach((aqScene, g) => {
        if (!aquaMaterials[g].uniforms.uTexture1.value) return;
        renderer.setRenderTarget(aquaTargets[g]);
        renderer.render(aqScene, aquaCamera);
      });
      renderer.setRenderTarget(null);

      // ── Update slide positions ───────────────────────────────────────
      // Móvil: precalcular si algún slide de cada video está en rango (evita descargar si el otro copy está visible)
      const videoAnyInRange = isMobile ? videoSrcs.map(() => false) : null;
      if (isMobile) {
        slides.forEach((slide) => {
          if (slide.userData.isAqua) return;
          const i = slide.userData.index;
          let basePos = i * slideUnit - currentPosition;
          basePos = ((basePos % totalSize) + totalSize) % totalSize;
          if (basePos > totalSize / 2) basePos -= totalSize;
          const dist = Math.abs(basePos);
          if (dist <= slideUnit * 1.5)
            videoAnyInRange[slide.userData.videoIndex] = true;
        });
      }

      slides.forEach((slide, i) => {
        let basePos = i * slideUnit - currentPosition;
        basePos = ((basePos % totalSize) + totalSize) % totalSize;
        if (basePos > totalSize / 2) basePos -= totalSize;

        const threshold = isVertical ? slideHeight : slideWidth;
        if (Math.abs(basePos - slide.userData.targetPos) > threshold * 2)
          slide.userData.currentPos = basePos;

        slide.userData.targetPos   = basePos;
        slide.userData.currentPos +=
          (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;

        if (isVertical) slide.position.y = slide.userData.currentPos;
        else            slide.position.x = slide.userData.currentPos;

        const worldPos = isVertical ? slide.position.y : slide.position.x;

        if (isMobile) {
          slide.position.z = 0;
          slide.scale.set(1, 1, 1);
          slide.rotation.x = 0;

          if (!slide.userData.isAqua) {
            const vi      = slide.userData.videoIndex;
            const vid     = videos[vi];
            const dist    = Math.abs(basePos);
            const inRange = dist <= slideUnit * 1.5;
            const far     = dist > slideUnit * 2.5;
            const anyInRange = videoAnyInRange[vi];

            if (far && videoLoaded[vi] && !anyInRange) {
              vid.pause();
              vid.src = "";
              vid.load();
              videoLoaded[vi] = false;
              slides.forEach((s) => {
                if (!s.userData.isAqua && s.userData.videoIndex === vi) {
                  s.material.uniforms.uMap.value = posterTextures[vi];
                  s.material.uniforms.uExpandRange.value = 0;
                  s.userData.showingPoster = true;
                }
              });
            } else if (inRange) {
              if (!videoLoaded[vi] && !videoLoading[vi]) {
                const src = videoSrcs[vi];
                if (src) {
                  videoLoading[vi] = true;
                  vid.src = encodeURI(src);
                  vid.load();
                  const onCanPlay = () => {
                    vid.removeEventListener("canplay", onCanPlay);
                    vid.removeEventListener("error", onError);
                    videoLoaded[vi] = true;
                    videoLoading[vi] = false;
                    slides.forEach((s) => {
                      if (!s.userData.isAqua && s.userData.videoIndex === vi) {
                        s.material.uniforms.uMap.value = videoTextures[vi];
                        s.material.uniforms.uExpandRange.value = 1;
                        s.userData.showingPoster = false;
                      }
                    });
                    vid.play().catch(() => {});
                  };
                  const onError = () => {
                    vid.removeEventListener("canplay", onCanPlay);
                    vid.removeEventListener("error", onError);
                    videoLoading[vi] = false;
                  };
                  vid.addEventListener("canplay", onCanPlay);
                  vid.addEventListener("error", onError);
                }
              } else if (videoLoaded[vi] && vid.paused) {
                vid.play().catch(() => {});
              }
            } else if (!inRange && videoLoaded[vi] && !far) {
              if (!vid.paused) vid.pause();
            }
          }
        } else {
          // ── Desktop: CPU vertex distortion ──────────────────────────────
          slide.position.z += (-0.8 - slide.position.z) * 0.1;
          slide.scale.set(1, 1, 1);
          updateCurveDesktop(slide, worldPos, currentDistortionFactor);
        }
      });

      renderer.render(scene, camera);
    };

    animate(0);

    // ── Cleanup ───────────────────────────────────────────────────────
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

      aquaMaterials.forEach((m) => m.dispose());
      aquaTargets.forEach((t) => t.dispose());
      aquaScenes.forEach((s) => s.children.forEach((c) => c.geometry?.dispose()));
      videos.forEach((v) => { v.pause(); v.src = ""; v.load(); });
      aquaTextures.forEach((group) => group.forEach((t) => t?.dispose()));
      if (posterTextures) posterTextures.forEach((t) => t?.dispose?.());

      slides.forEach((s) => {
        s.geometry.dispose();
        s.material.dispose();
      });
      videoTextures.forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, [isMobile, resolvedGroups, resolvedVideos]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        cursor: "pointer",
      }}
    />
  );
};

export default AquaSliderWithHero5;
