"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useOptimizedMedia } from "@/hooks/useOptimizedMedia";

// ─── AquaSlider shaders ────────────────────────────────────────────────────────
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

  struct LensDistortion {
    vec2 distortedUV;
    float inside;
  };

  LensDistortion getLensDistortion(
    vec2 p, vec2 uv, vec2 sphereCenter,
    float sphereRadius, float focusFactor
  ) {
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

// ─── Image group definitions ───────────────────────────────────────────────────
const IMAGE_NAMES = [
  ["story1.png",  "story2.png",  "story3.png"],
  ["story4.png",  "story5.png",  "story6.png"],
  ["story7.png",  "story8.png",  "story9.png"],
  ["story10.png", "story11.png", "story12.png"],
  ["story13.png", "story14.png", "story15.png"],
];

// ─── AquaSlider factory ────────────────────────────────────────────────────────
const createAquaSlider = (resolvedPaths, offW, offH) => {
  const offCanvas  = document.createElement("canvas");
  offCanvas.width  = offW;
  offCanvas.height = offH;

  const aquaRenderer = new THREE.WebGLRenderer({
    canvas: offCanvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  aquaRenderer.setSize(offW, offH);

  const aquaScene  = new THREE.Scene();
  const aquaCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const aquaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture1:     { value: null },
      uTexture2:     { value: null },
      uProgress:     { value: 0.0 },
      uResolution:   { value: new THREE.Vector2(offW, offH) },
      uTexture1Size: { value: new THREE.Vector2(1, 1) },
      uTexture2Size: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader:   aquaVertexShader,
    fragmentShader: aquaFragmentShader,
  });

  aquaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aquaMaterial));

  const loader    = new THREE.TextureLoader();
  const textures  = new Array(resolvedPaths.length).fill(null);
  let loadedCount = 0;

  resolvedPaths.forEach((src, i) => {
    loader.load(
      src,
      (tex) => {
        tex.minFilter  = tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.userData   = { size: new THREE.Vector2(tex.image.width, tex.image.height) };
        textures[i]    = tex;
        loadedCount++;
        if (loadedCount === resolvedPaths.length) {
          aquaMaterial.uniforms.uTexture1.value     = textures[0];
          aquaMaterial.uniforms.uTexture2.value     = textures[1 % textures.length];
          aquaMaterial.uniforms.uTexture1Size.value = textures[0].userData.size;
          aquaMaterial.uniforms.uTexture2Size.value = textures[1 % textures.length].userData.size;
        }
      },
      undefined,
      (err) => console.warn(`AquaSlider: couldn't load ${src}`, err)
    );
  });

  let currentIndex    = 0;
  let isTransitioning = false;

  const advance = () => {
    if (isTransitioning || textures.some((t) => !t)) return;
    isTransitioning     = true;
    const nextIndex     = (currentIndex + 1) % textures.length;

    aquaMaterial.uniforms.uTexture1.value     = textures[currentIndex];
    aquaMaterial.uniforms.uTexture2.value     = textures[nextIndex];
    aquaMaterial.uniforms.uTexture1Size.value = textures[currentIndex].userData.size;
    aquaMaterial.uniforms.uTexture2Size.value = textures[nextIndex].userData.size;

    gsap.fromTo(
      aquaMaterial.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration: 2.5,
        ease: "power2.inOut",
        onComplete: () => {
          aquaMaterial.uniforms.uProgress.value     = 0;
          aquaMaterial.uniforms.uTexture1.value     = textures[nextIndex];
          aquaMaterial.uniforms.uTexture1Size.value = textures[nextIndex].userData.size;
          currentIndex    = nextIndex;
          isTransitioning = false;
        },
      }
    );
  };

  const render = () => {
    if (aquaMaterial.uniforms.uTexture1.value) {
      aquaRenderer.render(aquaScene, aquaCamera);
    }
  };

  const dispose = () => {
    textures.forEach((t) => t?.dispose());
    aquaMaterial.dispose();
    aquaScene.children.forEach((c) => c.geometry?.dispose());
    aquaRenderer.dispose();
  };

  return { canvas: offCanvas, render, advance, dispose };
};

// ─── Main component ────────────────────────────────────────────────────────────
const AquaSliderWithHero2 = () => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  // ── Resolve optimised image paths (WebP on supported browsers, fallback jpg/png)
  const { getImage, isLoaded } = useOptimizedMedia();

  const resolvedGroups = useMemo(() => {
    if (!isLoaded) return null;
    return IMAGE_NAMES.map((group) =>
      group.map((name) => getImage(name).src)
    );
  }, [isLoaded, getImage]);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Three.js — only initialise once resolvedGroups is ready ───────────────
  useEffect(() => {
    if (!resolvedGroups) return;

    const canvas = canvasRef.current;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // near=0.01 (was 0.1) — prevents distorted vertices from clipping at near plane
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.01,
      100
    );
    camera.position.z = isMobile ? 9.5 : 5;

    const settings = {
      wheelSensitivity:      0.01,
      touchSensitivity:      0.01,
      momentumMultiplier:    2,
      smoothing:             0.1,
      slideLerp:             0.075,
      distortionDecay:       0.95,
      maxDistortion:         isMobile ? 1.6 : 2.5,
      distortionSensitivity: 0.15,
      distortionSmoothing:   0.075,
    };

    const slideWidth  = isMobile ? 4.0 : 2.0;
    const slideHeight = isMobile ? 4.5 : 2.5;
    const gap         = isMobile ? 0.2 : 0.05;
    const isVertical  = isMobile;

    // 3× repetition of the 5 groups → 15 virtual slots, same density as original
    const REPEAT      = 3;
    const GROUP_COUNT = resolvedGroups.length; // 5
    const slideCount  = GROUP_COUNT * REPEAT;  // 15
    const slideUnit   = isVertical ? slideHeight + gap : slideWidth + gap;
    const totalSize   = slideCount * slideUnit;

    const widthSegments  = isMobile ? 16 : 32;
    const heightSegments = isMobile ? 8  : 16;

    // Offscreen size matches slide aspect ratio exactly
    const offW = 512;
    const offH = isMobile ? 576 : 640;

    // 5 AquaSliders (one per unique group), each shared across 3 virtual slots
    const aquaSliders    = resolvedGroups.map((g) => createAquaSlider(g, offW, offH));
    const canvasTextures = aquaSliders.map((s) => {
      const ct      = new THREE.CanvasTexture(s.canvas);
      ct.minFilter  = THREE.LinearFilter;
      ct.magFilter  = THREE.LinearFilter;
      ct.colorSpace = THREE.SRGBColorSpace;
      return ct;
    });

    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const slides    = [];

    for (let i = 0; i < slideCount; i++) {
      const groupIndex = i % GROUP_COUNT;
      const geometry   = new THREE.PlaneGeometry(
        slideWidth, slideHeight, widthSegments, heightSegments
      );
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        map:         canvasTextures[groupIndex],
        side:        THREE.DoubleSide,
        transparent: false,
      }));

      if (isVertical) mesh.position.y = i * slideUnit;
      else            mesh.position.x = i * slideUnit;

      mesh.userData = {
        originalVertices: [...geometry.attributes.position.array],
        index: i, groupIndex,
        targetPos: 0, currentPos: 0,
      };

      scene.add(mesh);
      slides.push(mesh);
    }

    slides.forEach((slide) => {
      if (isVertical) {
        slide.position.y -= totalSize / 2;
        slide.userData.targetPos  = slide.position.y;
        slide.userData.currentPos = slide.position.y;
      } else {
        slide.position.x -= totalSize / 2;
        slide.userData.targetPos  = slide.position.x;
        slide.userData.currentPos = slide.position.x;
      }
    });

    // ── Distortion (original logic preserved) ─────────────────────────────
    const updateCurve = (mesh, worldPosition, distortionFactor) => {
      const positionAttr = mesh.geometry.attributes.position;
      const original     = mesh.userData.originalVertices;

      if (isMobile) {
        const centerRadius   = slideHeight * 0.6;
        const globalRadius   = slideHeight * 2.5;
        const centerStrength = distortionFactor * 2.8;
        const globalStrength = distortionFactor * 1.4;

        for (let i = 0; i < positionAttr.count; i++) {
          const y       = original[i * 3 + 1];
          const axisPos = worldPosition + y;
          let dCenter   = Math.min(Math.abs(axisPos) / centerRadius, 1);
          let bulge     = Math.sin((1 - dCenter) * Math.PI * 0.5) *
                          settings.maxDistortion * centerStrength;
          bulge         = Math.pow(bulge, 1.1);
          let dGlobal   = Math.min(Math.abs(axisPos) / globalRadius, 1);
          const gWave   = Math.sin((1 - dGlobal) * Math.PI) *
                          settings.maxDistortion * globalStrength;
          positionAttr.setZ(i, bulge + gWave);
        }
      } else {
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
      }
      positionAttr.needsUpdate = true;
    };

    // ── Scroll / interaction state ─────────────────────────────────────────
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

    const advanceSliderAt = (clientX, clientY) => {
      mouse.x = (clientX / window.innerWidth)  *  2 - 1;
      mouse.y = (clientY / window.innerHeight) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(slides);
      if (hits.length > 0) {
        aquaSliders[hits[0].object.userData.groupIndex].advance();
      }
    };

    // ── Event handlers ────────────────────────────────────────────────────
    const handleMouseDown = (e) => {
      isDragging    = false;
      dragStartAxis = isVertical ? e.clientY : e.clientX;
    };
    const handleMouseMove = (e) => {
      if (Math.abs((isVertical ? e.clientY : e.clientX) - dragStartAxis) > 8) isDragging = true;
    };
    const handleClick = (e) => {
      if (!isDragging) advanceSliderAt(e.clientX, e.clientY);
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
      clearTimeout(window._heroScrollTO);
      window._heroScrollTO = setTimeout(() => { isScrolling = false; }, 150);
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
      targetDistortionFactor = Math.min(1, targetDistortionFactor + Math.abs(delta) * 0.05);
      targetPosition -= delta * settings.touchSensitivity;
      isScrolling     = true;
    };
    const handleTouchEnd = (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartClient.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartClient.y);
      if (dx < 10 && dy < 10) {
        advanceSliderAt(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        return;
      }
      const velocity = (touchLast - touchStart) * 0.005;
      if (Math.abs(velocity) > 0.5) {
        autoScrollSpeed        = -velocity * settings.momentumMultiplier * 0.05;
        targetDistortionFactor = Math.min(1, Math.abs(velocity) * 3 * settings.distortionSensitivity);
        isScrolling            = true;
        setTimeout(() => { isScrolling = false; }, 800);
      }
    };
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
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

    // ── Render loop ────────────────────────────────────────────────────────
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

      // Tick every AquaSlider → flag texture for GPU upload
      aquaSliders.forEach((slider, i) => {
        slider.render();
        canvasTextures[i].needsUpdate = true;
      });

      slides.forEach((slide, i) => {
        let basePos = i * slideUnit - currentPosition;
        basePos = ((basePos % totalSize) + totalSize) % totalSize;
        if (basePos > totalSize / 2) basePos -= totalSize;

        const threshold = isVertical ? slideHeight : slideWidth;
        if (Math.abs(basePos - slide.userData.targetPos) > threshold * 2) {
          slide.userData.currentPos = basePos;
        }

        slide.userData.targetPos   = basePos;
        slide.userData.currentPos +=
          (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;

        if (isVertical) slide.position.y = slide.userData.currentPos;
        else            slide.position.x = slide.userData.currentPos;

        slide.position.z += (-0.8 - slide.position.z) * 0.1;
        slide.scale.set(1, 1, 1);

        const worldPos = isVertical ? slide.position.y : slide.position.x;
        updateCurve(slide, worldPos, currentDistortionFactor);
      });

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
      aquaSliders.forEach((s) => s.dispose());
      canvasTextures.forEach((t) => t.dispose());
      slides.forEach((s) => { s.geometry.dispose(); s.material.dispose(); });
      renderer.dispose();
    };
  }, [isMobile, resolvedGroups]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top:      0,
        left:     0,
        width:    "100vw",
        height:   "100vh",
        cursor:   "pointer",
      }}
    />
  );
};

export default AquaSliderWithHero2;