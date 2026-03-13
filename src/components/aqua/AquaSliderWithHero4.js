"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";

// ─── Aqua image-transition shaders (bubble lens, used on both platforms) ───────
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

  vec2 getCoverUV(vec2 uv, vec2 ts) {
    vec2 s = uResolution / ts;
    float sc = max(s.x, s.y);
    return (uv * uResolution - (uResolution - ts * sc) * 0.5) / (ts * sc);
  }
  vec2 distUv(vec2 uv, vec2 dir, float f) { return uv - vec2(dir.x, dir.y * 2.0) * f; }

  void main() {
    vec2 p  = vUv * uResolution;
    vec2 c  = uResolution * 0.5;
    vec2 uv1 = getCoverUV(vUv, uTexture1Size);
    vec2 uv2 = getCoverUV(vUv, uTexture2Size);

    float r  = uProgress * length(uResolution) * 1.5;
    float d  = length(c - p);
    float mask = step(r, d);

    vec4 cur = texture2D(uTexture1, uv1);

    vec2  dd  = normalize(p - c);
    float fr  = r * 0.25;
    float fs  = r / 3000.0;
    float fd  = length(c - p) - fr;
    float sd  = length(c - p) - r;
    float ins = smoothstep(0.0, 1.0, -sd / (r * 0.001));
    float mf  = pow(clamp(fd / (r - fr) * ins, 0.0, 1.0), 5.0);
    vec2  duv = distUv(uv2, dd, mf * fs);

    vec4 nxt = texture2D(uTexture2, duv);
    gl_FragColor = mix(nxt, cur, max(mask, 1.0 - ins));
  }
`;

// ─── Mobile slide shaders: GPU handles all vertex distortion ───────────────────
// CPU cost per frame = 3 uniform writes per slide (vs 153 Math.sin() iterations)
const mobileSlideVert = `
  uniform float uTime;
  uniform float uDistortion;
  uniform float uWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Amplitude envelope: full at screen centre, fades as slide scrolls away
    float env = pow(max(0.0, 1.0 - abs(uWorldPos) / 7.0), 1.5);

    // Vertical sine wave — single sin() per vertex, no sqrt, no pow per vertex
    pos.z = sin(pos.y * 4.5 - uTime * 3.5) * uDistortion * env;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const mobileSlideFrag = `
  uniform sampler2D uTexture;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(uTexture, vUv); }
`;

// ─── Data ──────────────────────────────────────────────────────────────────────
const IMAGE_GROUPS = [
  ["/story/story1.png",  "/story/story2.png",  "/story/story3.png"],
  ["/story/story4.png",  "/story/story5.png",  "/story/story6.png"],
  ["/story/story7.png",  "/story/story8.png",  "/story/story9.png"],
  ["/story/story10.png", "/story/story11.png", "/story/story12.png"],
  ["/story/story13.png", "/story/story14.png", "/story/story15.png"],
];

const VIDEO_SRCS = [
  "/motion/Allthatjazz cinematic©Feb26.mp4",
  "/motion/ATJ About Cuaderno.mp4",
  "/motion/ATJ_AboutMotion 02.mp4",
  "/motion/Playground_Carhartt-WIP_24012026 (1)_1.mp4",
  "/motion/Portfolio-Gallery-4-5.mp4",
];

// ─── Component ─────────────────────────────────────────────────────────────────
const AquaSliderWithHero4 = () => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    // ── Renderer — single context for everything ───────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scenes ────────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // near=0.01 prevents distorted verts from clipping at near plane
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.position.z = isMobile ? 9.5 : 5;

    const aquaCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ── Slide dimensions ──────────────────────────────────────────────
    const slideWidth  = isMobile ? 4.0 : 2.0;
    const slideHeight = isMobile ? 4.5 : 2.5;
    const gap         = isMobile ? 0.2 : 0.05;
    const isVertical  = isMobile;

    // Offscreen render target size matches slide aspect ratio
    const offW = 512;
    const offH = isMobile ? 576 : 640;

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

    // ── AquaSlider setup (one scene + RenderTarget per group) ──────────
    // All rendered by the SAME main renderer → zero extra WebGL contexts
    const GROUP_COUNT   = IMAGE_GROUPS.length; // 5
    const aquaScenes    = [];
    const aquaMaterials = [];
    const aquaTargets   = [];
    const aquaTextures  = []; // raw THREE.Texture arrays per group
    const aquaStates    = []; // { currentIndex, isTransitioning }

    for (let g = 0; g < GROUP_COUNT; g++) {
      const aquaScene = new THREE.Scene();
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
      aquaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

      const target = new THREE.WebGLRenderTarget(offW, offH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      target.texture.colorSpace = THREE.SRGBColorSpace;

      aquaScenes.push(aquaScene);
      aquaMaterials.push(mat);
      aquaTargets.push(target);
      aquaStates.push({ currentIndex: 0, isTransitioning: false });

      // Load image textures for this group
      const loader  = new THREE.TextureLoader();
      const texArr  = new Array(IMAGE_GROUPS[g].length).fill(null);
      let loaded    = 0;
      aquaTextures.push(texArr);

      IMAGE_GROUPS[g].forEach((src, j) => {
        loader.load(src, (tex) => {
          tex.minFilter  = tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.userData   = { size: new THREE.Vector2(tex.image.width, tex.image.height) };
          texArr[j] = tex;
          if (++loaded === IMAGE_GROUPS[g].length) {
            mat.uniforms.uTexture1.value     = texArr[0];
            mat.uniforms.uTexture2.value     = texArr[1 % texArr.length];
            mat.uniforms.uTexture1Size.value = texArr[0].userData.size;
            mat.uniforms.uTexture2Size.value = texArr[1 % texArr.length].userData.size;
          }
        });
      });
    }

    const advanceAquaGroup = (g) => {
      const state  = aquaStates[g];
      const texArr = aquaTextures[g];
      if (state.isTransitioning || texArr.some((t) => !t)) return;
      state.isTransitioning = true;
      const next = (state.currentIndex + 1) % texArr.length;
      const mat  = aquaMaterials[g];
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

    VIDEO_SRCS.forEach((src) => {
      const video = document.createElement("video");
      video.src         = encodeURI(src);
      video.muted       = true;
      video.loop        = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.preload     = isMobile ? "metadata" : "auto";

      const tex = new THREE.VideoTexture(video);
      tex.colorSpace     = THREE.SRGBColorSpace;
      tex.minFilter      = THREE.LinearFilter;
      tex.magFilter      = THREE.LinearFilter;
      tex.generateMipmaps = false;

      if (!isMobile) video.play().catch(() => {});

      videos.push(video);
      videoTextures.push(tex);
    });

    // ── Carousel layout ───────────────────────────────────────────────
    // 5 aqua groups + 5 videos = 10 unique items
    // REPEAT = 2 → 20 virtual slots (same density as original 20-item carousel)
    const VIDEO_COUNT   = VIDEO_SRCS.length;              // 5
    const UNIQUE_COUNT  = GROUP_COUNT + VIDEO_COUNT;       // 10
    const REPEAT        = 2;
    const slideCount    = UNIQUE_COUNT * REPEAT;           // 20
    const slideUnit     = isVertical ? slideHeight + gap : slideWidth + gap;
    const totalSize     = slideCount * slideUnit;
    const mobileActiveRange = slideUnit * 2.5;

    const wSegs = isMobile ? 24 : 32;
    const hSegs = isMobile ? 12 : 16;

    const slides = [];
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    for (let i = 0; i < slideCount; i++) {
      const uid        = i % UNIQUE_COUNT;
      const isAqua     = uid < GROUP_COUNT;
      const groupIndex = isAqua ? uid : null;
      const videoIndex = isAqua ? null : uid - GROUP_COUNT;

      const geo = new THREE.PlaneGeometry(slideWidth, slideHeight, wSegs, hSegs);
      const tex = isAqua ? aquaTargets[groupIndex].texture : videoTextures[videoIndex];

      let mat;
      if (isMobile) {
        mat = new THREE.ShaderMaterial({
          uniforms: {
            uTexture:    { value: tex },
            uTime:       { value: 0 },
            uDistortion: { value: 0 },
            uWorldPos:   { value: 0 },
          },
          vertexShader:   mobileSlideVert,
          fragmentShader: mobileSlideFrag,
        });
      } else {
        mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      }

      const mesh = new THREE.Mesh(geo, mat);
      if (isVertical) mesh.position.y = i * slideUnit;
      else            mesh.position.x = i * slideUnit;

      mesh.userData = {
        originalVertices: !isMobile ? [...geo.attributes.position.array] : null,
        index: i, uid, isAqua, groupIndex, videoIndex,
        targetPos: 0, currentPos: 0,
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

    // ── Desktop CPU distortion: radial wave ripple ─────────────────────
    const WAVE = { freq: 5.5, speed: 4.5, falloff: 1.8, radius: 3.2, sec: 0.35, secF: 2.1 };

    const updateCurveDesktop = (mesh, worldPos, distFactor, elapsed) => {
      const attr = mesh.geometry.attributes.position;
      const orig = mesh.userData.originalVertices;
      const amp  = settings.maxDistortion * distFactor;
      for (let i = 0; i < attr.count; i++) {
        const wx = worldPos + orig[i * 3];
        const wy = orig[i * 3 + 1];
        const d  = Math.sqrt(wx * wx + wy * wy);
        const env = Math.pow(Math.max(0, 1 - d / WAVE.radius), WAVE.falloff);
        const ph  = d * WAVE.freq - elapsed * WAVE.speed;
        attr.setZ(i, (Math.sin(ph) + Math.sin(ph * WAVE.secF) * WAVE.sec) * amp * env);
      }
      attr.needsUpdate = true;
    };

    // ── Scroll + distortion state ──────────────────────────────────────
    let currentPos = 0, targetPos = 0;
    let isScrolling = false, autoSpeed = 0;
    let lastTime = 0, elapsedTime = 0;
    let touchClientStart = { x: 0, y: 0 };
    let touchStart = 0, touchLast = 0;
    let curDist = 0, tgtDist = 0, peakVel = 0;
    let velHistory = [0, 0, 0, 0, 0];
    let isDragging = false, dragAxis = 0;

    const hitSlider = (cx, cy) => {
      mouse.x = (cx / window.innerWidth)  *  2 - 1;
      mouse.y = (cy / window.innerHeight) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(slides);
      if (hits.length > 0 && hits[0].object.userData.isAqua)
        advanceAquaGroup(hits[0].object.userData.groupIndex);
    };

    // ── Event handlers ────────────────────────────────────────────────
    const onMouseDown = (e) => { isDragging = false; dragAxis = isVertical ? e.clientY : e.clientX; };
    const onMouseMove = (e) => { if (Math.abs((isVertical ? e.clientY : e.clientX) - dragAxis) > 8) isDragging = true; };
    const onClick     = (e) => { if (!isDragging) hitSlider(e.clientX, e.clientY); isDragging = false; };

    const onKeyDown = (e) => {
      const bk = isVertical ? e.key === "ArrowUp"   : e.key === "ArrowLeft";
      const fw = isVertical ? e.key === "ArrowDown" : e.key === "ArrowRight";
      if (bk) { targetPos += slideUnit; tgtDist = Math.min(1, tgtDist + 0.3); }
      if (fw) { targetPos -= slideUnit; tgtDist = Math.min(1, tgtDist + 0.3); }
    };

    const onWheel = (e) => {
      e.preventDefault();
      tgtDist = Math.min(1, tgtDist + Math.abs(e.deltaY) * 0.001);
      targetPos   -= e.deltaY * settings.wheelSensitivity;
      isScrolling  = true;
      autoSpeed    = Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);
      clearTimeout(window._heroSTO);
      window._heroSTO = setTimeout(() => { isScrolling = false; }, 150);
    };

    const onTouchStart = (e) => {
      touchClientStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStart = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      touchLast  = touchStart;
      isScrolling = false;
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      const cur   = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      const delta = cur - touchLast;
      touchLast   = cur;
      tgtDist     = Math.min(1, tgtDist + Math.abs(delta) * 0.05);
      targetPos  -= delta * settings.touchSensitivity;
      isScrolling = true;
    };

    const onTouchEnd = (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchClientStart.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchClientStart.y);
      if (dx < 10 && dy < 10) { hitSlider(e.changedTouches[0].clientX, e.changedTouches[0].clientY); return; }
      const vel = (touchLast - touchStart) * 0.005;
      if (Math.abs(vel) > 0.5) {
        autoSpeed   = -vel * settings.momentumMultiplier * 0.05;
        tgtDist     = Math.min(1, Math.abs(vel) * 3 * settings.distortionSensitivity);
        isScrolling = true;
        setTimeout(() => { isScrolling = false; }, 800);
      }
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const onVisibility = () => { if (document.hidden) videos.forEach((v) => v.pause()); };

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("click",      onClick);
    window.addEventListener("keydown",    onKeyDown);
    window.addEventListener("wheel",      onWheel,      { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove",  onTouchMove,  { passive: false });
    window.addEventListener("touchend",   onTouchEnd);
    window.addEventListener("resize",     onResize);
    document.addEventListener("visibilitychange", onVisibility);

    // ── Render loop ───────────────────────────────────────────────────
    let animId;
    const animate = (time) => {
      animId = requestAnimationFrame(animate);
      if (document.hidden) return;

      const dt  = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime    = time;
      elapsedTime += dt;

      const prevPos = currentPos;

      if (isScrolling) {
        targetPos += autoSpeed;
        autoSpeed *= Math.max(0.92, 0.97 - Math.abs(autoSpeed) * 0.5);
        if (Math.abs(autoSpeed) < 0.001) autoSpeed = 0;
      }

      currentPos += (targetPos - currentPos) * settings.smoothing;

      const vel = Math.abs(currentPos - prevPos) / dt;
      velHistory.push(vel); velHistory.shift();
      const avgVel = velHistory.reduce((s, v) => s + v, 0) / velHistory.length;
      if (avgVel > peakVel) peakVel = avgVel;
      const isDecel = (avgVel / (peakVel + 0.001)) < 0.7 && peakVel > 0.5;
      peakVel *= 0.99;

      if (vel > 0.05) tgtDist = Math.max(tgtDist, Math.min(1, vel * 0.1));
      if (isDecel || avgVel < 0.2)
        tgtDist *= isDecel ? settings.distortionDecay : settings.distortionDecay * 0.9;
      curDist += (tgtDist - curDist) * settings.distortionSmoothing;

      // ── Phase 1: Render each AquaSlider scene into its RenderTarget ──
      // Same renderer, same context — no overhead from context switching
      aquaScenes.forEach((s, g) => {
        if (!aquaMaterials[g].uniforms.uTexture1.value) return;
        renderer.setRenderTarget(aquaTargets[g]);
        renderer.render(s, aquaCamera);
      });
      renderer.setRenderTarget(null);

      // ── Phase 2: Update carousel slide positions + distortion ────────
      slides.forEach((slide, i) => {
        let basePos = i * slideUnit - currentPos;
        basePos = ((basePos % totalSize) + totalSize) % totalSize;
        if (basePos > totalSize / 2) basePos -= totalSize;

        const thresh = isVertical ? slideHeight : slideWidth;
        if (Math.abs(basePos - slide.userData.targetPos) > thresh * 2)
          slide.userData.currentPos = basePos;

        slide.userData.targetPos    = basePos;
        slide.userData.currentPos  += (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;

        if (isVertical) slide.position.y = slide.userData.currentPos;
        else            slide.position.x = slide.userData.currentPos;

        slide.position.z += (-0.8 - slide.position.z) * 0.1;
        slide.scale.set(1, 1, 1);

        const worldPos = isVertical ? slide.position.y : slide.position.x;

        if (isMobile) {
          // GPU: just write 3 uniforms — zero JS vertex work
          const u = slide.material.uniforms;
          u.uTime.value       = elapsedTime;
          u.uDistortion.value = curDist * settings.maxDistortion;
          u.uWorldPos.value   = worldPos;

          // Range-based video playback (saves GPU bandwidth off-screen)
          if (!slide.userData.isAqua) {
            const vid      = videos[slide.userData.videoIndex];
            const inRange  = Math.abs(basePos) <= mobileActiveRange;
            if (inRange  && vid.paused)  vid.play().catch(() => {});
            if (!inRange && !vid.paused) vid.pause();
          }
        } else {
          // Desktop: CPU radial wave ripple (works fine on desktop)
          updateCurveDesktop(slide, worldPos, curDist, elapsedTime);
        }
      });

      // ── Phase 3: Render main scene to screen ─────────────────────────
      renderer.render(scene, camera);
    };

    animate(0);

    // ── Cleanup ───────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("click",      onClick);
      window.removeEventListener("keydown",    onKeyDown);
      window.removeEventListener("wheel",      onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove",  onTouchMove);
      window.removeEventListener("touchend",   onTouchEnd);
      window.removeEventListener("resize",     onResize);
      document.removeEventListener("visibilitychange", onVisibility);

      aquaMaterials.forEach((m) => m.dispose());
      aquaTargets.forEach((t) => t.dispose());
      aquaScenes.forEach((s, g) => {
        s.children.forEach((c) => c.geometry?.dispose());
        aquaTextures[g].forEach((t) => t?.dispose());
      });
      slides.forEach((s) => { s.geometry.dispose(); s.material.dispose(); });
      videos.forEach((v) => { v.pause(); v.src = ""; v.load(); });
      videoTextures.forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, [isMobile]);

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

export default AquaSliderWithHero4;